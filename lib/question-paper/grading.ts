export type NormalizedQuestionSpec = {
  questionId: string;
  type: string;
  sectionName: string;
  marks: number;
  negativeMarks: number;
  answerIndexes: number[];
  optionIndexes: Set<number>;
  matrixAnswers: number[][];
  matrixRowCount: number;
  matrixColumnIndexes: Set<number>;
};

export function arraysEqual(a: number[], b: number[]) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort((left, right) => left - right);
  const sortedB = [...b].sort((left, right) => left - right);

  return sortedA.every((value, index) => value === sortedB[index]);
}

export function normalizeSelectedOptions(value: unknown) {
  if (!Array.isArray(value)) return [] as number[];

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && Number.isFinite(item)),
    ),
  );
}

export function normalizeMatrixSelections(
  value: unknown,
  options?: { rowCount?: number },
) {
  const rows = Array.isArray(value) ? value : [];
  const normalizedRows = rows.map((row) => normalizeSelectedOptions(row));
  const requestedRowCount = Number(options?.rowCount);

  if (!Number.isInteger(requestedRowCount) || requestedRowCount < 0) {
    return normalizedRows;
  }

  return Array.from({ length: requestedRowCount }, (_value, index) =>
    normalizeSelectedOptions(rows[index]),
  );
}

export function hasAnyMatrixSelection(value: unknown) {
  return normalizeMatrixSelections(value).some((row) => row.length > 0);
}

export function matricesEqual(a: number[][], b: number[][]) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }

  return a.every((row, index) => arraysEqual(row, b[index] || []));
}

export function isOnlineQuestionType(type: unknown) {
  return (
    type === "single" ||
    type === "multiple" ||
    type === "matrix-match" ||
    type === "descriptive"
  );
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function getMaxMatrixIndex(rows: number[][]) {
  let max = -1;

  rows.forEach((row) => {
    row.forEach((value) => {
      if (Number.isInteger(value) && value > max) {
        max = value;
      }
    });
  });

  return max;
}

function getQuestionSpec(
  sectionName: string,
  entry: any,
): NormalizedQuestionSpec | null {
  const questionDoc = entry?.question || {};
  const questionId = normalizeId(questionDoc?._id || questionDoc);
  if (!questionId) return null;

  const options = Array.isArray(questionDoc?.options) ? questionDoc.options : [];
  const matrixOptions = Array.isArray(questionDoc?.matrixOptions)
    ? questionDoc.matrixOptions
    : [];
  const rawMatrixAnswers = normalizeMatrixSelections(questionDoc?.matrixAnswers);
  const matrixRowCount = Math.max(
    matrixOptions.filter((option: any) => String(option?.left || "").trim()).length,
    rawMatrixAnswers.length,
  );
  const matrixColumnCount = Math.max(
    matrixOptions.filter((option: any) => String(option?.right || "").trim()).length,
    getMaxMatrixIndex(rawMatrixAnswers) + 1,
  );

  return {
    questionId,
    type: String(questionDoc?.type || "").trim(),
    sectionName,
    marks: Number(entry?.marks || 0),
    negativeMarks: Number(entry?.negativeMarks || 0),
    answerIndexes: Array.isArray(questionDoc?.answerIndexes)
      ? questionDoc.answerIndexes
          .map((value: any) => Number(value))
          .filter((value: number) => Number.isFinite(value))
      : [],
    optionIndexes: new Set(
      Array.from({ length: options.length }, (_value, index) => index),
    ),
    matrixAnswers: normalizeMatrixSelections(questionDoc?.matrixAnswers, {
      rowCount: matrixRowCount,
    }),
    matrixRowCount,
    matrixColumnIndexes: new Set(
      Array.from({ length: matrixColumnCount }, (_value, index) => index),
    ),
  };
}

export function buildPaperQuestionLookup(paper: any) {
  const lookup = new Map<string, NormalizedQuestionSpec>();

  (Array.isArray(paper?.sections) ? paper.sections : []).forEach((section: any) => {
    const sectionName = String(section?.name || "").trim();
    if (!sectionName) return;

    (Array.isArray(section?.questions) ? section.questions : []).forEach(
      (entry: any) => {
        const spec = getQuestionSpec(sectionName, entry);
        if (!spec) return;
        lookup.set(`${sectionName}::${spec.questionId}`, spec);
      },
    );
  });

  return lookup;
}

export function validateStudentSectionAnswers(
  sectionAnswers: unknown,
  paper: any,
  options?: { allowEmpty?: boolean },
) {
  const allowEmpty = options?.allowEmpty === true;
  const lookup = buildPaperQuestionLookup(paper);
  const issues: string[] = [];
  const normalizedSections: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      matrixSelections?: number[][];
      answerText?: string;
    }>;
  }> = [];

  if (!Array.isArray(sectionAnswers)) {
    if (allowEmpty) {
      return { ok: true as const, sectionAnswers: normalizedSections, issues };
    }

    return {
      ok: false as const,
      sectionAnswers: normalizedSections,
      issues: ["sectionAnswers must be an array."],
    };
  }

  const seenQuestionKeys = new Set<string>();

  sectionAnswers.forEach((sectionAnswer: any, sectionIndex: number) => {
    const sectionName = String(sectionAnswer?.sectionName || "").trim();
    if (!sectionName) {
      issues.push(`Section ${sectionIndex + 1}: sectionName is required.`);
      return;
    }

    if (!Array.isArray(sectionAnswer?.answers)) {
      issues.push(`Section ${sectionName}: answers must be an array.`);
      return;
    }

    const normalizedAnswers: Array<{
      question: string;
      selectedOptions?: number[];
      matrixSelections?: number[][];
      answerText?: string;
    }> = [];

    sectionAnswer.answers.forEach((answer: any, answerIndex: number) => {
      const questionId = normalizeId(answer?.question);
      if (!questionId) {
        issues.push(`Section ${sectionName}: answer ${answerIndex + 1} is missing a question.`);
        return;
      }

      const key = `${sectionName}::${questionId}`;
      if (seenQuestionKeys.has(key)) {
        issues.push(`Section ${sectionName}: question ${questionId} is duplicated.`);
        return;
      }

      const spec = lookup.get(key);
      if (!spec) {
        issues.push(`Section ${sectionName}: question ${questionId} is not part of this paper.`);
        return;
      }

      if (!isOnlineQuestionType(spec.type)) {
        issues.push(`Section ${sectionName}: question ${questionId} is not supported for online tests.`);
        return;
      }

      const selectedOptions = normalizeSelectedOptions(answer?.selectedOptions);
      const answerText = String(answer?.answerText || "").trim();
      const rawMatrixSelections = Array.isArray(answer?.matrixSelections)
        ? answer.matrixSelections
        : [];
      const matrixSelections = normalizeMatrixSelections(rawMatrixSelections, {
        rowCount: spec.matrixRowCount,
      });
      const hasMatrixSelections = matrixSelections.some((row) => row.length > 0);

      if (spec.type === "single" || spec.type === "multiple") {
        if (answerText) {
          issues.push(`Section ${sectionName}: question ${questionId} does not accept text answers.`);
          return;
        }

        if (hasMatrixSelections) {
          issues.push(`Section ${sectionName}: question ${questionId} does not accept matrix selections.`);
          return;
        }

        if (spec.type === "single" && selectedOptions.length > 1) {
          issues.push(`Section ${sectionName}: question ${questionId} accepts only one option.`);
          return;
        }

        const invalidOption = selectedOptions.find(
          (optionIndex) => !spec.optionIndexes.has(optionIndex),
        );
        if (invalidOption !== undefined) {
          issues.push(
            `Section ${sectionName}: question ${questionId} has invalid option index ${invalidOption}.`,
          );
          return;
        }

        seenQuestionKeys.add(key);
        if (selectedOptions.length === 0) {
          return;
        }

        normalizedAnswers.push({
          question: questionId,
          selectedOptions,
        });
        return;
      }

      if (spec.type === "descriptive") {
        if (selectedOptions.length > 0) {
          issues.push(`Section ${sectionName}: descriptive question ${questionId} cannot store selected options.`);
          return;
        }

        if (hasMatrixSelections) {
          issues.push(`Section ${sectionName}: descriptive question ${questionId} cannot store matrix selections.`);
          return;
        }

        seenQuestionKeys.add(key);
        if (!answerText) {
          return;
        }

        normalizedAnswers.push({
          question: questionId,
          answerText,
        });
        return;
      }

      if (selectedOptions.length > 0) {
        issues.push(`Section ${sectionName}: matrix match question ${questionId} cannot store selected options.`);
        return;
      }

      if (answerText) {
        issues.push(`Section ${sectionName}: matrix match question ${questionId} cannot store text answers.`);
        return;
      }

      const extraAnsweredRows = rawMatrixSelections
        .slice(spec.matrixRowCount)
        .some((row: unknown) => normalizeSelectedOptions(row).length > 0);
      if (extraAnsweredRows) {
        issues.push(
          `Section ${sectionName}: question ${questionId} includes answers for unknown matrix rows.`,
        );
        return;
      }

      const invalidMatrixSelection = matrixSelections.find((row) =>
        row.some((optionIndex) => !spec.matrixColumnIndexes.has(optionIndex)),
      );
      if (invalidMatrixSelection) {
        const invalidOption = invalidMatrixSelection.find(
          (optionIndex) => !spec.matrixColumnIndexes.has(optionIndex),
        );
        issues.push(
          `Section ${sectionName}: question ${questionId} has invalid matrix option index ${invalidOption}.`,
        );
        return;
      }

      seenQuestionKeys.add(key);
      if (!hasMatrixSelections) {
        return;
      }

      normalizedAnswers.push({
        question: questionId,
        matrixSelections,
      });
    });

    if (normalizedAnswers.length > 0) {
      normalizedSections.push({
        sectionName,
        answers: normalizedAnswers,
      });
    }
  });

  if (issues.length > 0) {
    return {
      ok: false as const,
      sectionAnswers: normalizedSections,
      issues,
    };
  }

  if (!allowEmpty && normalizedSections.length === 0) {
    return {
      ok: false as const,
      sectionAnswers: normalizedSections,
      issues: ["At least one answered question is required."],
    };
  }

  return {
    ok: true as const,
    sectionAnswers: normalizedSections,
    issues,
  };
}

export function evaluateQuestionAnswer(
  spec: NormalizedQuestionSpec | null | undefined,
  answer: any,
) {
  const selectedOptions = normalizeSelectedOptions(answer?.selectedOptions);
  const matrixSelections = normalizeMatrixSelections(
    answer?.matrixSelections,
    spec?.type === "matrix-match"
      ? { rowCount: spec.matrixRowCount }
      : undefined,
  );
  const answerText = String(answer?.answerText || "").trim();
  const marksAwarded = Number.isFinite(Number(answer?.marksAwarded))
    ? Number(answer?.marksAwarded)
    : null;
  const attempted =
    selectedOptions.length > 0 ||
    matrixSelections.some((row) => row.length > 0) ||
    answerText.length > 0 ||
    marksAwarded !== null;

  let isCorrect = false;
  let requiresManualReview = false;

  if (spec) {
    if (spec.type === "single" || spec.type === "multiple") {
      isCorrect =
        selectedOptions.length > 0 &&
        arraysEqual(selectedOptions, spec.answerIndexes);
    } else if (spec.type === "matrix-match") {
      isCorrect =
        matrixSelections.some((row) => row.length > 0) &&
        matricesEqual(matrixSelections, spec.matrixAnswers);
    } else if (spec.type === "descriptive") {
      requiresManualReview = attempted;
      if (marksAwarded !== null) {
        isCorrect = marksAwarded >= Number(spec.marks || 0);
      }
    } else if (marksAwarded !== null) {
      isCorrect = marksAwarded >= Number(spec.marks || 0);
    }
  }

  return {
    selectedOptions,
    matrixSelections,
    answerText,
    marksAwarded,
    attempted,
    isCorrect,
    requiresManualReview,
  };
}

export function gradeObjectiveSectionAnswers(
  sectionAnswers: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      matrixSelections?: number[][];
      answerText?: string;
    }>;
  }>,
  paper: any,
) {
  const lookup = buildPaperQuestionLookup(paper);
  let totalMarksAwarded = 0;

  const gradedSections = (Array.isArray(sectionAnswers) ? sectionAnswers : [])
    .map((sectionAnswer) => {
      const answers = (Array.isArray(sectionAnswer?.answers)
        ? sectionAnswer.answers
        : []
      )
        .map((answer) => {
          const key = `${String(sectionAnswer?.sectionName || "").trim()}::${normalizeId(answer?.question)}`;
          const spec = lookup.get(key);
          if (!spec) return null;

          const evaluation = evaluateQuestionAnswer(spec, answer);
          if (!evaluation.attempted) return null;

          if (spec.type === "descriptive") {
            return {
              question: spec.questionId,
              answerText: evaluation.answerText,
            };
          }

          const marksAwarded = evaluation.isCorrect
            ? Number(spec.marks || 0)
            : -Math.abs(Number(spec.negativeMarks || 0));
          totalMarksAwarded += marksAwarded;

          if (spec.type === "matrix-match") {
            return {
              question: spec.questionId,
              matrixSelections: evaluation.matrixSelections,
              marksAwarded,
            };
          }

          return {
            question: spec.questionId,
            selectedOptions: evaluation.selectedOptions,
            marksAwarded,
          };
        })
        .filter(Boolean);

      if (answers.length === 0) return null;

      return {
        sectionName: String(sectionAnswer?.sectionName || "").trim(),
        answers,
      };
    })
    .filter(Boolean);

  return {
    sectionAnswers: gradedSections,
    totalMarksAwarded,
  };
}
