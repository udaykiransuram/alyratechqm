export type QuestionPaperDirectoryPaper = Record<string, any>;

export type QuestionPaperDirectoryClassItem = {
  _id: string;
  name: string;
};

export type QuestionPaperDirectoryAcademicSectionItem = {
  _id: string;
  name: string;
  class: { _id: string; name: string } | null;
};

export function getPaperQuestionCount(paper: QuestionPaperDirectoryPaper) {
  if (
    typeof paper?.questionCount === "number" &&
    Number.isFinite(paper.questionCount)
  ) {
    return Math.max(0, Number(paper.questionCount));
  }

  return Array.isArray(paper?.sections)
    ? paper.sections.reduce(
        (total: number, section: any) =>
          total +
          (Array.isArray(section?.questions) ? section.questions.length : 0),
        0,
      )
    : 0;
}

export function getPaperClassId(paper: QuestionPaperDirectoryPaper) {
  return String(paper?.class?._id || paper?.class || "");
}

export function getSectionClassId(section: any) {
  return String(section?.class?._id || section?.class || "");
}

export function normalizeFilterValue(value: string) {
  return value && value !== "all" ? value : "";
}
