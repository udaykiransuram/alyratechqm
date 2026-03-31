export type QuestionImportDraftStatus =
  | "uploaded"
  | "parsed"
  | "needs_review"
  | "ready_to_publish"
  | "published"
  | "failed";

export type QuestionImportApprovalStatus =
  | "pending_review"
  | "approved"
  | "needs_fix"
  | "excluded";

export type QuestionImportMathSourceFormat =
  | "plain_latex"
  | "mathpix_latex"
  | "word_omml"
  | "raw_text";

export type QuestionImportMathMappingStatus =
  | "mapped"
  | "unmapped"
  | "resolved_by_reviewer";

export type QuestionImportWarningSeverity = "info" | "warning" | "error";

export type QuestionImportQuestionType =
  | "single"
  | "multiple"
  | "descriptive";

export type QuestionImportAcademicSectionAssignmentMode =
  | "all"
  | "selected";

export type QuestionImportImageRole =
  | "stem"
  | "option"
  | "explanation"
  | "generic";

export interface QuestionImportWarning {
  id: string;
  severity: QuestionImportWarningSeverity;
  code: string;
  message: string;
  path?: string;
  blocking?: boolean;
}

export interface QuestionImportMathFragment {
  id: string;
  path: string;
  sourceFormat: QuestionImportMathSourceFormat;
  rawSource: string;
  normalizedLatex?: string;
  mappingStatus: QuestionImportMathMappingStatus;
  warning?: string;
  displayMode?: boolean;
}

export interface QuestionImportImageAsset {
  id: string;
  fieldPath: string;
  role: QuestionImportImageRole;
  url: string;
  fileName: string;
  sourcePath?: string;
  alt?: string;
  questionId?: string;
  optionKey?: string;
}

export interface QuestionImportTagPair {
  type: string;
  value: string;
}

export interface QuestionImportSubjectMapping {
  token: string;
  subjectId?: string;
  createIfMissing?: boolean;
}

export interface QuestionImportAcademicSectionMapping {
  token: string;
  academicSectionId?: string;
}

export interface QuestionImportOptionDraft {
  id: string;
  key: string;
  contentHtml: string;
}

export interface QuestionImportQuestionMetadata {
  difficulty?: string;
  topic?: string;
  templateId?: string;
  customTags: QuestionImportTagPair[];
}

export interface QuestionImportQuestionDraft {
  id: string;
  order: number;
  numberLabel: string;
  sectionId: string;
  approvalStatus: QuestionImportApprovalStatus;
  type: QuestionImportQuestionType;
  subjectToken?: string;
  marks: number;
  negativeMarks: number;
  contentHtml: string;
  options: QuestionImportOptionDraft[];
  answerIndexes: number[];
  explanationHtml: string;
  metadata: QuestionImportQuestionMetadata;
  warningIds: string[];
  mathFragmentIds: string[];
  imageIds: string[];
}

export interface QuestionImportPaperSectionDraft {
  id: string;
  order: number;
  name: string;
  descriptionHtml: string;
  instructionsHtml: string;
  subjectToken?: string;
  defaultMarks: number;
  defaultNegativeMarks: number;
}

export interface QuestionImportPaperDraft {
  title: string;
  instructionsHtml: string;
  classToken?: string;
  classId?: string;
  durationMinutes: number;
  passingMarks: number;
  examDate?: string;
  onlineEnabled: boolean;
  onlineStartsAt?: string;
  onlineEndsAt?: string;
  academicSectionAssignmentMode: QuestionImportAcademicSectionAssignmentMode;
  assignedAcademicSectionIds: string[];
  academicSectionTokens: string[];
}

export interface QuestionImportDraftPayload {
  templateVersion: string;
  paper: QuestionImportPaperDraft;
  paperSections: QuestionImportPaperSectionDraft[];
  questions: QuestionImportQuestionDraft[];
  images: QuestionImportImageAsset[];
  warnings: QuestionImportWarning[];
  errors: QuestionImportWarning[];
  mappings: {
    subjects: QuestionImportSubjectMapping[];
    academicSections: QuestionImportAcademicSectionMapping[];
  };
  mathFragments: QuestionImportMathFragment[];
}

export interface QuestionImportSourceFile {
  name: string;
  mimeType: string;
  size: number;
}

export interface QuestionImportDraftRecord {
  _id: string;
  status: QuestionImportDraftStatus;
  sourceFile: QuestionImportSourceFile;
  payload: QuestionImportDraftPayload;
  createdBy: string;
  updatedBy?: string;
  publishedQuestionIds?: string[];
  publishedPaperId?: string;
  createdAt: string;
  updatedAt: string;
}
