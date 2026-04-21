import type {
  QuestionImportAcademicSectionAssignmentMode,
  QuestionImportDraftPayload,
  QuestionImportDraftStatus,
  QuestionImportMathFragment,
  QuestionImportQuestionDraft,
  QuestionImportWarning,
} from "@/lib/question-import/types";

function normalizeToken(value: unknown) {
  return String(value || "").trim();
}

function normalizeComparableToken(value: unknown) {
  return normalizeToken(value).toLowerCase();
}

function normalizeUniqueTokens(values: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => normalizeToken(value))
        .filter(Boolean),
    ),
  );
}

function normalizeAcademicSectionAssignmentMode(
  value: unknown,
): QuestionImportAcademicSectionAssignmentMode | undefined {
  const normalized = normalizeComparableToken(value);
  return normalized === "selected" || normalized === "all"
    ? normalized
    : undefined;
}

function parseQuestionIdFromPath(path: string | undefined) {
  const match = /^questions\.([^.]+)\./.exec(String(path || "").trim());
  return match ? match[1] : "";
}

function findQuestionById(
  payload: QuestionImportDraftPayload,
  questionId: string,
) {
  const normalizedQuestionId = normalizeToken(questionId);
  return (Array.isArray(payload.questions) ? payload.questions : []).find(
    (question) => normalizeToken(question.id) === normalizedQuestionId,
  );
}

function questionIdSetForPayload(payload: QuestionImportDraftPayload) {
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  return new Set(
    questions
      .filter((question) => question.approvalStatus !== "excluded")
      .map((question) => normalizeToken(question.id))
      .filter(Boolean),
  );
}

export function cloneQuestionImportPayload(
  payload: QuestionImportDraftPayload,
): QuestionImportDraftPayload {
  return JSON.parse(JSON.stringify(payload || {})) as QuestionImportDraftPayload;
}

export function collectQuestionImportSubjectTokens(
  payload: QuestionImportDraftPayload,
) {
  return Array.from(
    new Set(
      [
        ...(Array.isArray(payload.paperSections) ? payload.paperSections : []).map(
          (section) => normalizeToken(section.subjectToken),
        ),
        ...(Array.isArray(payload.questions) ? payload.questions : []).map(
          (question) => normalizeToken(question.subjectToken),
        ),
      ].filter(Boolean),
    ),
  );
}

export function collectQuestionImportAcademicSectionTokens(
  payload: QuestionImportDraftPayload,
) {
  return Array.from(
    new Set(
      (Array.isArray(payload.paper?.academicSectionTokens)
        ? payload.paper.academicSectionTokens
        : []
      )
        .map((token) => normalizeToken(token))
        .filter(Boolean),
    ),
  );
}

export function syncQuestionImportMappings(
  payload: QuestionImportDraftPayload,
): QuestionImportDraftPayload {
  const nextPayload = cloneQuestionImportPayload(payload);
  const normalizedAssignedAcademicSectionIds = normalizeUniqueTokens(
    nextPayload.paper?.assignedAcademicSectionIds,
  );
  const normalizedAcademicSectionAssignmentMode =
    normalizeAcademicSectionAssignmentMode(
      nextPayload.paper?.academicSectionAssignmentMode,
    );
  const existingSubjectMappings = new Map(
    (Array.isArray(nextPayload.mappings?.subjects)
      ? nextPayload.mappings.subjects
      : []
    )
      .map((mapping) => [normalizeComparableToken(mapping?.token), mapping] as const)
      .filter(([token]) => Boolean(token)),
  );
  const existingAcademicSectionMappings = new Map(
    (Array.isArray(nextPayload.mappings?.academicSections)
      ? nextPayload.mappings.academicSections
      : []
    )
      .map((mapping) => [normalizeComparableToken(mapping?.token), mapping] as const)
      .filter(([token]) => Boolean(token)),
  );
  const inferredAssignedAcademicSectionIds =
    !normalizedAcademicSectionAssignmentMode &&
    normalizedAssignedAcademicSectionIds.length === 0
      ? normalizeUniqueTokens(
          (Array.isArray(nextPayload.mappings?.academicSections)
            ? nextPayload.mappings.academicSections
            : []
          ).map((mapping) => mapping?.academicSectionId),
        )
      : [];
  const assignedAcademicSectionIds =
    normalizedAssignedAcademicSectionIds.length > 0
      ? normalizedAssignedAcademicSectionIds
      : inferredAssignedAcademicSectionIds;
  const academicSectionAssignmentMode =
    normalizedAcademicSectionAssignmentMode ||
    (assignedAcademicSectionIds.length > 0 ? "selected" : "all");

  nextPayload.mappings = {
    subjects: collectQuestionImportSubjectTokens(nextPayload).map((token) => {
      const existing = existingSubjectMappings.get(normalizeComparableToken(token));
      return {
        token,
        subjectId: normalizeToken(existing?.subjectId) || undefined,
        createIfMissing: existing?.createIfMissing === true,
      };
    }),
    academicSections: collectQuestionImportAcademicSectionTokens(nextPayload).map(
      (token) => {
        const existing = existingAcademicSectionMappings.get(
          normalizeComparableToken(token),
        );
        return {
          token,
          academicSectionId:
            normalizeToken(existing?.academicSectionId) || undefined,
        };
      },
    ),
  };

  nextPayload.paper = {
    ...nextPayload.paper,
    academicSectionAssignmentMode,
    assignedAcademicSectionIds,
    academicSectionTokens: collectQuestionImportAcademicSectionTokens(nextPayload),
  };

  return nextPayload;
}

export function getIncludedQuestionImportQuestions(
  payload: QuestionImportDraftPayload,
) {
  return (Array.isArray(payload.questions) ? payload.questions : []).filter(
    (question) => question.approvalStatus !== "excluded",
  );
}

function getIncludedQuestionImportSubjectTokens(
  payload: QuestionImportDraftPayload,
) {
  return new Set(
    getIncludedQuestionImportQuestions(payload)
      .map((question) => normalizeToken(question.subjectToken))
      .filter(Boolean),
  );
}

function isQuestionScopedItemRelevant(
  questionIds: Set<string>,
  pathOrQuestionId: string | undefined,
) {
  const normalizedPathOrQuestionId = normalizeToken(pathOrQuestionId);
  if (!normalizedPathOrQuestionId) {
    return true;
  }

  const scopedQuestionId =
    parseQuestionIdFromPath(normalizedPathOrQuestionId) || normalizedPathOrQuestionId;

  if (!scopedQuestionId) {
    return true;
  }

  return questionIds.has(scopedQuestionId);
}

export function isQuestionImportWarningCurrentlyBlocking(
  payload: QuestionImportDraftPayload,
  warning: QuestionImportWarning | null | undefined,
) {
  if (!warning?.blocking) {
    return false;
  }

  const code = normalizeToken(warning.code);
  const questionId = parseQuestionIdFromPath(warning.path);
  const question = questionId ? findQuestionById(payload, questionId) : null;

  switch (code) {
    case "missing_paper_title":
      return !normalizeToken(payload.paper?.title);
    case "missing_paper_class":
      return !normalizeToken(payload.paper?.classToken) && !normalizeToken(payload.paper?.classId);
    case "insufficient_options":
      return Boolean(
        question &&
          question.approvalStatus !== "excluded" &&
          (question.type === "single" || question.type === "multiple") &&
          (!Array.isArray(question.options) || question.options.length < 2),
      );
    case "missing_correct_answer":
      return Boolean(
        question &&
          question.approvalStatus !== "excluded" &&
          question.type !== "descriptive" &&
          (!Array.isArray(question.answerIndexes) ||
            question.answerIndexes.length === 0),
      );
    case "unmapped_math":
    case "review_math_mapping":
      return (Array.isArray(payload.mathFragments) ? payload.mathFragments : []).some(
        (fragment) =>
          String(fragment?.path || "") === String(warning.path || "") &&
          fragment?.mappingStatus === "unmapped",
      );
    default:
      return true;
  }
}

export function getQuestionImportBlockingWarnings(
  payload: QuestionImportDraftPayload,
) {
  const includedQuestionIds = questionIdSetForPayload(payload);
  const candidateWarnings = [
    ...(Array.isArray(payload.errors) ? payload.errors : []),
    ...(Array.isArray(payload.warnings) ? payload.warnings : []),
  ];

  return candidateWarnings.filter(
    (warning) =>
      warning?.blocking === true &&
      isQuestionScopedItemRelevant(includedQuestionIds, warning?.path) &&
      isQuestionImportWarningCurrentlyBlocking(payload, warning),
  );
}

export function getQuestionImportUnmappedMathFragments(
  payload: QuestionImportDraftPayload,
) {
  const includedQuestionIds = questionIdSetForPayload(payload);
  return (Array.isArray(payload.mathFragments) ? payload.mathFragments : []).filter(
    (fragment) =>
      fragment?.mappingStatus === "unmapped" &&
      isQuestionScopedItemRelevant(includedQuestionIds, fragment?.path),
  );
}

export function getQuestionImportMissingMappings(
  payload: QuestionImportDraftPayload,
) {
  const includedQuestionSubjectTokens =
    getIncludedQuestionImportSubjectTokens(payload);
  const missingSubjectMappings = (Array.isArray(payload.mappings?.subjects)
    ? payload.mappings.subjects
    : []
  ).filter(
    (mapping) =>
      includedQuestionSubjectTokens.has(normalizeToken(mapping?.token)) &&
      !normalizeToken(mapping?.subjectId) && mapping?.createIfMissing !== true,
  );
  const missingAcademicSectionMappings = (
    Array.isArray(payload.mappings?.academicSections)
      ? payload.mappings.academicSections
      : []
  ).filter((mapping) => !normalizeToken(mapping?.academicSectionId));

  return {
    missingSubjectMappings,
    missingAcademicSectionMappings,
  };
}

export function getQuestionImportAcademicSectionAssignmentMode(
  payload: QuestionImportDraftPayload,
): QuestionImportAcademicSectionAssignmentMode {
  return payload.paper?.academicSectionAssignmentMode === "selected"
    ? "selected"
    : "all";
}

export function getQuestionImportAssignedAcademicSectionIds(
  payload: QuestionImportDraftPayload,
) {
  return normalizeUniqueTokens(payload.paper?.assignedAcademicSectionIds);
}

export function deriveQuestionImportDraftStatus(
  payload: QuestionImportDraftPayload,
): QuestionImportDraftStatus {
  const syncedPayload = syncQuestionImportMappings(payload);
  const includedQuestions = getIncludedQuestionImportQuestions(syncedPayload);
  const questionsMissingSubjectToken = includedQuestions.filter(
    (question) => !normalizeToken(question.subjectToken),
  );
  const blockingWarnings = getQuestionImportBlockingWarnings(syncedPayload);
  const unmappedMathFragments = getQuestionImportUnmappedMathFragments(syncedPayload);
  const { missingSubjectMappings } = getQuestionImportMissingMappings(
    syncedPayload,
  );
  const requiresSelectedAcademicSections =
    getQuestionImportAcademicSectionAssignmentMode(syncedPayload) === "selected" &&
    getQuestionImportAssignedAcademicSectionIds(syncedPayload).length === 0;

  if (includedQuestions.length === 0) {
    return "needs_review";
  }

  if (
    !normalizeToken(syncedPayload.paper?.title) ||
    !normalizeToken(syncedPayload.paper?.classId) ||
    !normalizeToken(syncedPayload.paper?.examDate) ||
    requiresSelectedAcademicSections ||
    blockingWarnings.length > 0 ||
    unmappedMathFragments.length > 0 ||
    questionsMissingSubjectToken.length > 0 ||
    missingSubjectMappings.length > 0
  ) {
    return "needs_review";
  }

  const hasUnapprovedQuestion = includedQuestions.some(
    (question) => question.approvalStatus !== "approved",
  );

  return hasUnapprovedQuestion ? "needs_review" : "ready_to_publish";
}

export function summarizeQuestionImportReviewState(
  payload: QuestionImportDraftPayload,
) {
  const syncedPayload = syncQuestionImportMappings(payload);
  const includedQuestions = getIncludedQuestionImportQuestions(syncedPayload);
  const questionsMissingSubjectToken = includedQuestions.filter(
    (question) => !normalizeToken(question.subjectToken),
  );
  const blockingWarnings = getQuestionImportBlockingWarnings(syncedPayload);
  const unmappedMathFragments = getQuestionImportUnmappedMathFragments(
    syncedPayload,
  );
  const { missingSubjectMappings, missingAcademicSectionMappings } =
    getQuestionImportMissingMappings(syncedPayload);
  const unapprovedQuestions = includedQuestions.filter(
    (question) => question.approvalStatus !== "approved",
  );
  const requiresSelectedAcademicSections =
    getQuestionImportAcademicSectionAssignmentMode(syncedPayload) === "selected" &&
    getQuestionImportAssignedAcademicSectionIds(syncedPayload).length === 0;

  return {
    payload: syncedPayload,
    status: deriveQuestionImportDraftStatus(syncedPayload),
    includedQuestions,
    blockingWarnings,
    unmappedMathFragments,
    questionsMissingSubjectToken,
    missingSubjectMappings,
    missingAcademicSectionMappings,
    requiresSelectedAcademicSections,
    unapprovedQuestions,
  };
}

export function getQuestionWarningsForQuestion(
  payload: QuestionImportDraftPayload,
  questionId: string,
) {
  const normalizedQuestionId = normalizeToken(questionId);
  if (!normalizedQuestionId) {
    return [] as QuestionImportWarning[];
  }

  return [
    ...(Array.isArray(payload.errors) ? payload.errors : []),
    ...(Array.isArray(payload.warnings) ? payload.warnings : []),
  ].filter(
    (warning) => parseQuestionIdFromPath(warning?.path) === normalizedQuestionId,
  );
}

export function getQuestionMathFragmentsForQuestion(
  payload: QuestionImportDraftPayload,
  questionId: string,
) {
  const normalizedQuestionId = normalizeToken(questionId);
  if (!normalizedQuestionId) {
    return [] as QuestionImportMathFragment[];
  }

  return (Array.isArray(payload.mathFragments) ? payload.mathFragments : []).filter(
    (fragment) => parseQuestionIdFromPath(fragment?.path) === normalizedQuestionId,
  );
}

export function getQuestionImportApprovalCounts(
  questions: QuestionImportQuestionDraft[],
) {
  return questions.reduce(
    (counts, question) => {
      const key = question.approvalStatus;
      counts[key] += 1;
      return counts;
    },
    {
      pending_review: 0,
      approved: 0,
      needs_fix: 0,
      excluded: 0,
    } satisfies Record<QuestionImportQuestionDraft["approvalStatus"], number>,
  );
}

export function approveAllIncludedQuestionImportQuestions(
  payload: QuestionImportDraftPayload,
) {
  let updatedCount = 0;

  (Array.isArray(payload.questions) ? payload.questions : []).forEach(
    (question) => {
      if (
        question.approvalStatus === "excluded" ||
        question.approvalStatus === "approved"
      ) {
        return;
      }

      question.approvalStatus = "approved";
      updatedCount += 1;
    },
  );

  return updatedCount;
}
