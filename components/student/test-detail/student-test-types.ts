export type StudentQuestion = {
  _id: string;
  content: string;
  type: "single" | "multiple" | "descriptive" | "matrix-match";
  subject?: { _id: string; name: string } | null;
  options: Array<{ content: string }>;
  matrixRows?: string[];
  matrixColumns?: string[];
};

export type StudentPaper = {
  _id: string;
  title: string;
  instructions: string;
  duration: number;
  passingMarks: number;
  totalMarks: number;
  examDate?: string | null;
  onlineStartsAt?: string | null;
  onlineEndsAt?: string | null;
  class?: { _id: string; name: string } | null;
  subject?: { _id: string; name: string } | null;
  subjects?: Array<{ _id: string; name: string }> | null;
  sections: Array<{
    name: string;
    description?: string;
    marks: number;
    questions: Array<{
      question: StudentQuestion;
      marks: number;
      negativeMarks: number;
    }>;
  }>;
};

export type StudentAttempt = {
  _id: string;
  status: string;
  startedAt?: string | null;
  submittedAt?: string | null;
  lastSavedAt?: string | null;
  totalMarksAwarded?: number;
  sectionAnswers?: Array<{
    sectionName: string;
    answers: Array<{
      question: string;
      selectedOptions?: number[];
      answerText?: string;
      matrixSelections?: number[][];
      marksAwarded?: number | null;
    }>;
  }>;
};

export type StudentAnswerState = {
  selectedOptions: number[];
  answerText: string;
  matrixSelections: number[][];
};

export type StudentSectionAnswersPayload = Array<{
  sectionName: string;
  answers: Array<{
    question: string;
    selectedOptions?: number[];
    answerText?: string;
    matrixSelections?: number[][];
  }>;
}>;

export type StudentTestDetailResponse = {
  success: boolean;
  paper: StudentPaper | null;
  attempt: StudentAttempt | null;
  status: string;
  remainingTimeMs: number | null;
  deadlineAt: string | null;
};

export type StudentQuestionListItem = {
  sectionName: string;
  sectionDescription: string;
  sectionMarks: number;
  marks: number;
  negativeMarks: number;
  question: StudentQuestion;
};
