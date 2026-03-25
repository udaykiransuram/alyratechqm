/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import {
  autoSubmitExpiredAttemptIfNeeded,
  deriveStudentTestStatus,
  findOrCreateStudentAttempt,
  getRemainingTimeMs,
  isStudentEligibleForPaper,
  paperSupportsOnlineDelivery,
  sanitizePaperForStudent,
} from "../../../lib/student-tests";

function buildPaper(overrides: Record<string, unknown> = {}) {
  return {
    _id: "paper-1",
    title: "Science Objective Test",
    duration: 30,
    passingMarks: 4,
    totalMarks: 6,
    examDate: "2026-03-20T09:00:00.000Z",
    onlineEnabled: true,
    onlineStartsAt: "2026-03-20T09:00:00.000Z",
    onlineEndsAt: "2026-03-20T10:00:00.000Z",
    class: {
      _id: "class-x",
      name: "Class X",
    },
    assignedAcademicSections: [
      {
        _id: "sec-a",
        name: "Section A",
      },
    ],
    sections: [
      {
        name: "Section A",
        description: "Answer all questions.",
        marks: 6,
        questions: [
          {
            marks: 4,
            negativeMarks: 1,
            question: {
              _id: "q1",
              content: "<p>2 + 2 = ?</p>",
              type: "single",
              options: [
                { content: "<p>4</p>" },
                { content: "<p>5</p>" },
              ],
              answerIndexes: [0],
              explanation: "Basic arithmetic.",
            },
          },
          {
            marks: 2,
            negativeMarks: 0,
            question: {
              _id: "q2",
              content: "<p>Select prime numbers.</p>",
              type: "multiple",
              options: [
                { content: "<p>2</p>" },
                { content: "<p>4</p>" },
                { content: "<p>5</p>" },
              ],
              answerIndexes: [0, 2],
            },
          },
        ],
      },
    ],
    ...overrides,
  };
}

test.describe("Student test helper coverage @desktop", () => {
  test("sanitizes paper payloads, keeps eligibility checks, and rejects unsupported online papers", async () => {
    const paper = buildPaper();
    const student = {
      _id: "student-1",
      class: { _id: "class-x" },
      academicSection: { _id: "sec-a" },
    };
    const differentSectionStudent = {
      ...student,
      academicSection: { _id: "sec-b" },
    };

    expect(paperSupportsOnlineDelivery(paper)).toBe(true);
    expect(isStudentEligibleForPaper(paper, student)).toBe(true);
    expect(isStudentEligibleForPaper(paper, differentSectionStudent)).toBe(false);

    const sanitized = sanitizePaperForStudent(paper);
    expect(sanitized.sections[0].questions[0].question).toEqual({
      _id: "q1",
      content: "<p>2 + 2 = ?</p>",
      type: "single",
      options: [{ content: "<p>4</p>" }, { content: "<p>5</p>" }],
      matrixRows: [],
      matrixColumns: [],
      matrixOptions: [],
    });
    expect(
      "answerIndexes" in (sanitized.sections[0].questions[0].question as Record<string, unknown>),
    ).toBe(false);
    expect(
      "explanation" in (sanitized.sections[0].questions[0].question as Record<string, unknown>),
    ).toBe(false);

    const unsupportedPaper = buildPaper({
      sections: [
        {
          name: "Section A",
          questions: [
            {
              marks: 5,
              negativeMarks: 0,
              question: {
                _id: "essay-1",
                content: "<p>Explain the answer.</p>",
                type: "essay",
                options: [],
              },
            },
          ],
        },
      ],
    });

    expect(paperSupportsOnlineDelivery(unsupportedPaper)).toBe(false);
  });

  test("derives attempt status, remaining time, and auto-submits expired attempts using the server deadline", async () => {
    const paper = buildPaper({
      duration: 20,
      onlineStartsAt: "2026-03-20T09:00:00.000Z",
      onlineEndsAt: "2026-03-20T09:45:00.000Z",
    });

    expect(
      deriveStudentTestStatus(paper, null, new Date("2026-03-20T08:50:00.000Z")),
    ).toBe("upcoming");
    expect(
      deriveStudentTestStatus(paper, null, new Date("2026-03-20T09:05:00.000Z")),
    ).toBe("available");

    const inProgressAttempt = {
      _id: "attempt-1",
      paper: "paper-1",
      student: "student-1",
      status: "in_progress",
      startedAt: "2026-03-20T09:10:00.000Z",
      submittedAt: null,
      sectionAnswers: [
        {
          sectionName: "Section A",
          answers: [{ question: "q1", selectedOptions: [0] }],
        },
      ],
      saveCalls: 0,
      async save() {
        this.saveCalls += 1;
      },
    };

    expect(
      deriveStudentTestStatus(
        paper,
        inProgressAttempt,
        new Date("2026-03-20T09:20:00.000Z"),
      ),
    ).toBe("in_progress");
    expect(
      getRemainingTimeMs(
        paper,
        inProgressAttempt,
        new Date("2026-03-20T09:20:00.000Z"),
      ),
    ).toBe(10 * 60 * 1000);

    const finalizedAttempt = await autoSubmitExpiredAttemptIfNeeded({
      attempt: inProgressAttempt,
      paper,
      now: new Date("2026-03-20T09:35:00.000Z"),
    });

    expect(finalizedAttempt).toBe(inProgressAttempt);
    expect(inProgressAttempt.saveCalls).toBe(1);
    expect(inProgressAttempt.status).toBe("auto_submitted");
    expect(new Date(String(inProgressAttempt.submittedAt)).toISOString()).toBe(
      "2026-03-20T09:30:00.000Z",
    );
    expect(inProgressAttempt.totalMarksAwarded).toBe(4);
    expect(
      deriveStudentTestStatus(
        paper,
        inProgressAttempt,
        new Date("2026-03-20T09:35:00.000Z"),
      ),
    ).toBe("auto_submitted");
  });

  test("creates attempts through a stable one-attempt upsert contract", async () => {
    const now = new Date("2026-03-20T09:00:00.000Z");
    let capturedArgs: unknown[] = [];
    const expectedAttempt = { _id: "attempt-1" };

    const QuestionPaperResponseModel = {
      async findOneAndUpdate(...args: unknown[]) {
        capturedArgs = args;
        return expectedAttempt;
      },
    };

    const result = await findOrCreateStudentAttempt({
      QuestionPaperResponseModel,
      paperId: "paper-1",
      studentId: "student-1",
      now,
    });

    expect(result).toBe(expectedAttempt);
    expect(capturedArgs).toHaveLength(3);
    expect(capturedArgs[0]).toEqual({
      paper: "paper-1",
      student: "student-1",
    });
    expect(capturedArgs[1]).toEqual({
      $setOnInsert: {
        paper: "paper-1",
        student: "student-1",
        startedAt: now,
        status: "in_progress",
        lastSavedAt: now,
        sectionAnswers: [],
      },
    });
    expect(capturedArgs[2]).toEqual({
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    });
  });
});
