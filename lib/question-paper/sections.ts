function toFiniteNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getSectionQuestions(section: any) {
  return Array.isArray(section?.questions) ? section.questions : [];
}

export function calculateSectionTotalMarks(section: any) {
  return getSectionQuestions(section).reduce((sum: number, question: any) => {
    const marks = toFiniteNumber(question?.marks);
    return sum + Math.max(0, marks ?? 0);
  }, 0);
}

export function deriveSectionDefaultMarks(section: any, fallback = 0) {
  const explicit = toFiniteNumber(section?.defaultMarks);
  if (explicit !== null && explicit > 0) {
    return explicit;
  }

  const questions = getSectionQuestions(section);
  const firstQuestionMarks = toFiniteNumber(questions[0]?.marks);
  if (firstQuestionMarks !== null && firstQuestionMarks > 0) {
    return firstQuestionMarks;
  }

  const nextFallback = toFiniteNumber(fallback);
  return nextFallback !== null && nextFallback > 0 ? nextFallback : 0;
}

export function deriveSectionDefaultNegativeMarks(section: any, fallback = 0) {
  const explicit = toFiniteNumber(section?.defaultNegativeMarks);
  if (explicit !== null && explicit >= 0) {
    return explicit;
  }

  const questions = getSectionQuestions(section);
  const firstQuestionNegativeMarks = toFiniteNumber(
    questions[0]?.negativeMarks,
  );
  if (firstQuestionNegativeMarks !== null && firstQuestionNegativeMarks >= 0) {
    return firstQuestionNegativeMarks;
  }

  const nextFallback = toFiniteNumber(fallback);
  return nextFallback !== null && nextFallback >= 0 ? nextFallback : 0;
}
