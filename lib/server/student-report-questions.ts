import "server-only";

import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveExamRuntimeMongoResponseIdWithCooldown } from "@/lib/exam-runtime-sync-cache";
import {
  buildPaperQuestionLookup,
  evaluateQuestionAnswer,
} from "@/lib/question-paper/grading";
import {
  buildSummerCrashAnswerSummary,
  selectSummerCrashQuestionLabels,
} from "@/lib/summer-crash/diagnostic-report";

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

export type StudentReportQuestionDetail = {
  status: "paper_not_available" | "question_not_found" | "ready";
  paper: any | null;
  questionNumber: number;
  matchedQuestion: any | null;
  matchedSectionName: string;
  matchedSectionDescription: string;
  matchedMarks: number;
  matchedNegativeMarks: number;
  paperSubjectNames: string[];
  metaSubjectName: string;
  metaClassName: string;
  answerStatus: "correct" | "incorrect" | "unattempted";
  studentAnswerSummary: string;
  correctAnswerSummary: string;
  weakAreaLabel: string;
  topicLabel: string;
};

export async function getStudentReportQuestionDetail(params: {
  schoolKey: string;
  studentId: string;
  responseId: string;
  questionId: string;
}) : Promise<StudentReportQuestionDetail> {
  let resolvedResponseId = normalizeId(params.responseId);

  if (
    resolvedResponseId &&
    !mongoose.Types.ObjectId.isValid(resolvedResponseId)
  ) {
    resolvedResponseId =
      (await resolveExamRuntimeMongoResponseIdWithCooldown(
        params.schoolKey,
        resolvedResponseId,
      )) || resolvedResponseId;
  }

  await connectDB();
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Tag: TagModel,
    TagType: TagTypeModel,
    Subject: SubjectModel,
    Class: ClassModel,
  } = await getTenantModels(params.schoolKey, [
    "QuestionPaperResponse",
    "QuestionPaper",
    "Question",
    "Tag",
    "TagType",
    "Subject",
    "Class",
  ]);

  const response =
    resolvedResponseId && mongoose.Types.ObjectId.isValid(resolvedResponseId)
      ? await QuestionPaperResponseModel.findOne({
          _id: resolvedResponseId,
          student: params.studentId,
        })
          .select("paper sectionAnswers")
          .populate({
            path: "paper",
            model: QuestionPaperModel,
            select:
              "title class subject subjectIds sections onlineEnabled onlineEndsAt examDate",
            populate: [
              { path: "class", model: ClassModel, select: "name" },
              { path: "subject", model: SubjectModel, select: "name" },
              { path: "subjectIds", model: SubjectModel, select: "name" },
              {
                path: "sections.questions.question",
                model: QuestionModel,
                select:
                  "content options answerIndexes matrixOptions matrixAnswers explanation marks type subject class tags",
                populate: [
                  {
                    path: "tags",
                    model: TagModel,
                    populate: { path: "type", model: TagTypeModel, select: "name" },
                  },
                  { path: "subject", model: SubjectModel, select: "name" },
                  { path: "class", model: ClassModel, select: "name" },
                ],
              },
            ],
          })
          .lean()
      : null;

  const paper = response?.paper as any;

  if (!paper) {
    return {
      status: "paper_not_available",
      paper: null,
      questionNumber: 0,
      matchedQuestion: null,
      matchedSectionName: "",
      matchedSectionDescription: "",
      matchedMarks: 0,
      matchedNegativeMarks: 0,
      paperSubjectNames: [],
      metaSubjectName: "",
      metaClassName: "",
      answerStatus: "unattempted",
      studentAnswerSummary: "Not answered",
      correctAnswerSummary: "Answer key not available",
      weakAreaLabel: "",
      topicLabel: "",
    };
  }

  let questionNumber = 0;
  let matchedQuestion: any = null;
  let matchedSectionName = "";
  let matchedSectionDescription = "";
  let matchedMarks = 0;
  let matchedNegativeMarks = 0;

  for (const section of Array.isArray(paper.sections) ? paper.sections : []) {
    for (const entry of Array.isArray(section?.questions) ? section.questions : []) {
      questionNumber += 1;
      if (normalizeId(entry?.question?._id) !== normalizeId(params.questionId)) {
        continue;
      }

      matchedQuestion = entry.question;
      matchedSectionName = String(section?.name || "").trim();
      matchedSectionDescription = String(section?.description || "").trim();
      matchedMarks = Number(entry?.marks || matchedQuestion?.marks || 0);
      matchedNegativeMarks = Number(entry?.negativeMarks || 0);
      break;
    }

    if (matchedQuestion) {
      break;
    }
  }

  const paperSubjectNames = [
    paper?.subject?.name,
    ...(Array.isArray(paper?.subjectIds)
      ? paper.subjectIds.map((subject: any) => subject?.name)
      : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const metaSubjectName = String(matchedQuestion?.subject?.name || "").trim();
  const metaClassName =
    String(matchedQuestion?.class?.name || paper?.class?.name || "").trim();
  const questionLookup = buildPaperQuestionLookup(paper);
  const questionId = normalizeId(params.questionId);
  const matchedAnswer =
    (Array.isArray(response?.sectionAnswers) ? response.sectionAnswers : [])
      .flatMap((sectionAnswer: any) =>
        Array.isArray(sectionAnswer?.answers) ? sectionAnswer.answers : [],
      )
      .find((answer: any) => normalizeId(answer?.question) === questionId) || null;
  const spec = matchedQuestion
    ? questionLookup.get(`${matchedSectionName}::${questionId}`)
    : null;
  const evaluation = evaluateQuestionAnswer(spec, matchedAnswer);
  const answerSummary = buildSummerCrashAnswerSummary({
    question: matchedQuestion,
    answer: matchedAnswer,
  });
  const labels = selectSummerCrashQuestionLabels({
    question: matchedQuestion,
    fallbackSectionName: matchedSectionName || matchedSectionDescription,
    fallbackSubjectName: metaSubjectName || paperSubjectNames[0],
  });

  return {
    status: matchedQuestion ? "ready" : "question_not_found",
    paper,
    questionNumber,
    matchedQuestion,
    matchedSectionName,
    matchedSectionDescription,
    matchedMarks,
    matchedNegativeMarks,
    paperSubjectNames,
    metaSubjectName,
    metaClassName,
    answerStatus: !evaluation.attempted
      ? "unattempted"
      : evaluation.isCorrect
        ? "correct"
        : "incorrect",
    studentAnswerSummary: answerSummary.studentAnswerSummary,
    correctAnswerSummary: answerSummary.correctAnswerSummary,
    weakAreaLabel: labels.weakAreaLabel,
    topicLabel: labels.topicLabel,
  };
}
