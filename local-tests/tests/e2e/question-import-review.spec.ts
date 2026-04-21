/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import {
  approveAllIncludedQuestionImportQuestions,
  summarizeQuestionImportReviewState,
} from "../../../lib/question-import/review";
import type { QuestionImportDraftPayload } from "../../../lib/question-import/types";

function createDraftPayload(): QuestionImportDraftPayload {
  return {
    templateVersion: "v1",
    paper: {
      title: "Diagnostic import",
      instructionsHtml: "",
      classToken: "Class 7",
      classId: "class-7",
      durationMinutes: 60,
      passingMarks: 10,
      examDate: "2026-04-21",
      onlineEnabled: true,
      academicSectionAssignmentMode: "all",
      assignedAcademicSectionIds: [],
      academicSectionTokens: [],
    },
    paperSections: [
      {
        id: "section-a",
        order: 1,
        name: "Section A",
        descriptionHtml: "",
        instructionsHtml: "",
        subjectToken: "Mathematics",
        defaultMarks: 1,
        defaultNegativeMarks: 0,
      },
    ],
    questions: [
      {
        id: "q1",
        order: 1,
        numberLabel: "1",
        sectionId: "section-a",
        approvalStatus: "pending_review",
        type: "single",
        subjectToken: "Mathematics",
        marks: 1,
        negativeMarks: 0,
        contentHtml: "<p>Question 1</p>",
        options: [],
        answerIndexes: [],
        explanationHtml: "",
        metadata: { customTags: [] },
        warningIds: [],
        mathFragmentIds: [],
        imageIds: [],
      },
      {
        id: "q2",
        order: 2,
        numberLabel: "2",
        sectionId: "section-a",
        approvalStatus: "needs_fix",
        type: "single",
        subjectToken: "Mathematics",
        marks: 1,
        negativeMarks: 0,
        contentHtml: "<p>Question 2</p>",
        options: [],
        answerIndexes: [],
        explanationHtml: "",
        metadata: { customTags: [] },
        warningIds: [],
        mathFragmentIds: [],
        imageIds: [],
      },
      {
        id: "q3",
        order: 3,
        numberLabel: "3",
        sectionId: "section-a",
        approvalStatus: "excluded",
        type: "single",
        subjectToken: "Mathematics",
        marks: 1,
        negativeMarks: 0,
        contentHtml: "<p>Question 3</p>",
        options: [],
        answerIndexes: [],
        explanationHtml: "",
        metadata: { customTags: [] },
        warningIds: [],
        mathFragmentIds: [],
        imageIds: [],
      },
      {
        id: "q4",
        order: 4,
        numberLabel: "4",
        sectionId: "section-a",
        approvalStatus: "approved",
        type: "single",
        subjectToken: "Mathematics",
        marks: 1,
        negativeMarks: 0,
        contentHtml: "<p>Question 4</p>",
        options: [],
        answerIndexes: [],
        explanationHtml: "",
        metadata: { customTags: [] },
        warningIds: [],
        mathFragmentIds: [],
        imageIds: [],
      },
    ],
    images: [],
    warnings: [],
    errors: [],
    mappings: {
      subjects: [],
      academicSections: [],
    },
    mathFragments: [],
  };
}

test.describe("Question import review helpers @desktop", () => {
  test("bulk approve marks included review questions approved while preserving excluded questions", async () => {
    const payload = createDraftPayload();

    const updatedCount = approveAllIncludedQuestionImportQuestions(payload);

    expect(updatedCount).toBe(2);
    expect(payload.questions.map((question) => question.approvalStatus)).toEqual([
      "approved",
      "approved",
      "excluded",
      "approved",
    ]);
  });

  test("does not keep the draft blocked for unmapped subject tokens that only belong to excluded questions or section defaults", async () => {
    const payload = createDraftPayload();

    payload.paperSections[0].subjectToken = "Section-only token";
    payload.questions[0].approvalStatus = "approved";
    payload.questions[1].approvalStatus = "excluded";
    payload.questions[1].subjectToken = "Excluded token";
    payload.questions[2].approvalStatus = "excluded";
    payload.questions[2].subjectToken = "Another excluded token";
    payload.questions[3].approvalStatus = "approved";
    payload.mappings.subjects = [
      { token: "Mathematics", subjectId: "subject-math" },
      { token: "Section-only token" },
      { token: "Excluded token" },
      { token: "Another excluded token" },
    ];

    const reviewState = summarizeQuestionImportReviewState(payload);

    expect(reviewState.missingSubjectMappings).toEqual([]);
    expect(reviewState.status).toBe("ready_to_publish");
  });
});
