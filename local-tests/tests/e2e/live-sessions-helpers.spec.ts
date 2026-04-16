/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";
import mongoose from "mongoose";

import {
  buildLiveSessionNotificationDedupeKey,
  buildLiveSessionNotificationEntityId,
  didLiveSessionScheduleChange,
  filterEligibleLiveSessionTeachers,
  isLiveSessionJoinable,
  resolveLiveSessionReminderAvailableAt,
} from "../../../lib/live-sessions/shared";
import {
  MOCK_LIVE_SESSION_TEACHER_ID,
  MOCK_LIVE_SESSION_TEACHER_TWO_ID,
  createMockLiveSession,
  deleteMockLiveSession,
} from "../../../lib/test-fixtures/live-sessions";
import LiveSessionItem from "../../../models/LiveSessionItem";
import LiveSessionResponse from "../../../models/LiveSessionResponse";
import LiveSessionTranscript from "../../../models/LiveSessionTranscript";
import {
  MOCK_CLASS_ID,
  MOCK_SECTION_ID,
  MOCK_SUBJECT_MATH_ID,
  MOCK_SUBJECT_SCIENCE_ID,
} from "../../../lib/test-fixtures/learning-content";

process.env.NEXT_PUBLIC_E2E_MOCK_MODE = "1";
process.env.MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/test";

async function loadLiveSessionServer() {
  return import("../../../lib/server/live-sessions");
}

function buildValidLiveSessionInput() {
  return {
    title: "Live Revision Sprint",
    description: "A quick live revision slot before the weekly assessment.",
    classId: MOCK_CLASS_ID,
    subjectId: MOCK_SUBJECT_MATH_ID,
    assignedAcademicSectionIds: [MOCK_SECTION_ID],
    hostTeacherId: MOCK_LIVE_SESSION_TEACHER_ID,
    scheduledStartAt: "2026-04-15T09:00:00.000Z",
    scheduledEndAt: "2026-04-15T10:00:00.000Z",
    studentJoinUrl: "https://meet.example.com/student/live-revision-sprint",
    hostJoinUrl: "https://meet.example.com/host/live-revision-sprint",
    meetingCode: "REV-101",
    meetingPasscode: "MATH",
    joinInstructions: "Join five minutes early with your notebook ready.",
    status: "scheduled",
  } satisfies Record<string, unknown>;
}

test.describe("Live sessions helper coverage @desktop", () => {
  test("validates live-item schemas and exposes unique response/transcript indexes", async () => {
    const liveSessionId = new mongoose.Types.ObjectId();
    const itemId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();

    const validSingleItem = new LiveSessionItem({
      liveSession: liveSessionId,
      type: "single",
      promptHtml: "<p>Which result is correct?</p>",
      options: [{ contentHtml: "<p>3</p>" }, { contentHtml: "<p>4</p>" }],
      answerIndexes: [1],
      explanationHtml: "<p>4 is the expected value.</p>",
      status: "draft",
      order: 0,
      createdBy: userId,
      updatedBy: userId,
    });

    await validSingleItem.validate();

    const invalidShortTextItem = new LiveSessionItem({
      liveSession: liveSessionId,
      type: "short-text",
      promptHtml: "<p>Describe your reasoning.</p>",
      options: [{ contentHtml: "<p>Should not be here</p>" }],
      answerIndexes: [0],
      explanationHtml: "",
      status: "draft",
      order: 1,
      createdBy: userId,
      updatedBy: userId,
    });
    const invalidShortTextItemError = (await invalidShortTextItem
      .validate()
      .then(() => null)
      .catch((error) => error)) as
      | {
          errors?: Record<string, { message: string }>;
        }
      | null;
    const invalidShortTextItemMessages = Object.values(
      invalidShortTextItemError?.errors || {},
    ).map((error) => error.message);

    expect(invalidShortTextItemMessages.join(" | ")).toMatch(
      /cannot include answer options/i,
    );
    expect(invalidShortTextItemMessages.join(" | ")).toMatch(
      /cannot include correct answer indexes/i,
    );

    const invalidShortTextResponse = new LiveSessionResponse({
      liveSession: liveSessionId,
      item: itemId,
      student: userId,
      itemType: "short-text",
      selectedOptionIndexes: [],
      answerHtml: "",
      submittedAt: new Date("2026-04-15T09:00:00.000Z"),
    });
    const invalidShortTextResponseError = (await invalidShortTextResponse
      .validate()
      .then(() => null)
      .catch((error) => error)) as
      | {
          errors?: Record<string, { message: string }>;
        }
      | null;

    expect(invalidShortTextResponseError?.errors.answerHtml?.message).toMatch(
      /cannot be empty/i,
    );

    const responseIndexes = LiveSessionResponse.schema.indexes();
    const transcriptIndexes = LiveSessionTranscript.schema.indexes();

    expect(
      responseIndexes.some(
        ([fields, options]) =>
          fields.item === 1 &&
          fields.student === 1 &&
          Boolean(options?.unique),
      ),
    ).toBe(true);
    expect(
      transcriptIndexes.some(
        ([fields, options]) =>
          fields.liveSession === 1 && Boolean(options?.unique),
      ),
    ).toBe(true);
  });

  test("normalizes write input and preserves revision-safe notification keys", async () => {
    const {
      normalizeLiveSessionWriteInput,
      buildLiveSessionNotificationRecordEntityId,
    } = await loadLiveSessionServer();
    const normalized = normalizeLiveSessionWriteInput(buildValidLiveSessionInput());

    expect(normalized.title).toBe("Live Revision Sprint");
    expect(normalized.description).toBe(
      "A quick live revision slot before the weekly assessment.",
    );
    expect(normalized.scheduledStartAt.toISOString()).toBe(
      "2026-04-15T09:00:00.000Z",
    );
    expect(normalized.scheduledEndAt.toISOString()).toBe(
      "2026-04-15T10:00:00.000Z",
    );
    expect(normalized.status).toBe("scheduled");

    expect(() =>
      normalizeLiveSessionWriteInput({
        ...buildValidLiveSessionInput(),
        scheduledEndAt: "2026-04-15T08:30:00.000Z",
      }),
    ).toThrow(/end time must be after the start time/i);

    expect(() =>
      normalizeLiveSessionWriteInput({
        ...buildValidLiveSessionInput(),
        studentJoinUrl: "notaurl",
      }),
    ).toThrow(/valid http or https urls/i);

    const dedupeKey = buildLiveSessionNotificationDedupeKey({
      type: "live_session_scheduled",
      sessionId: "session-1",
      revision: 3,
    });
    expect(dedupeKey).toBe("live_session_scheduled:session-1:3");
    expect(
      buildLiveSessionNotificationEntityId({
        sessionId: "session-1",
        revision: 3,
      }),
    ).toBe("session-1:3");
    expect(buildLiveSessionNotificationRecordEntityId("session-1", 3)).toBe(
      "session-1:3",
    );

    const reminderAt = resolveLiveSessionReminderAvailableAt({
      scheduledStartAt: new Date("2026-04-15T09:00:00.000Z"),
      now: new Date("2026-04-15T08:50:00.000Z"),
    });
    expect(reminderAt?.toISOString()).toBe("2026-04-15T08:50:00.000Z");
  });

  test("detects schedule changes and resolves teacher eligibility for class scope", async () => {
    const { getWorkspaceLiveSessionSupportData } = await loadLiveSessionServer();
    const before = buildValidLiveSessionInput();
    const after = {
      ...before,
      scheduledStartAt: "2026-04-15T09:30:00.000Z",
      scheduledEndAt: "2026-04-15T10:30:00.000Z",
    };

    expect(
      didLiveSessionScheduleChange({
        before,
        after,
      }),
    ).toBe(true);
    expect(
      didLiveSessionScheduleChange({
        before,
        after: {
          ...before,
          assignedAcademicSectionIds: [MOCK_SECTION_ID],
        },
      }),
    ).toBe(false);

    const adminSupportData = await getWorkspaceLiveSessionSupportData({
      schoolKey: "demo-school",
      viewerRole: "admin",
      viewerId: "school-admin-1",
    });

    const eligibleTeachers = filterEligibleLiveSessionTeachers({
      teachers: adminSupportData.teachers,
      classId: MOCK_CLASS_ID,
      subjectId: MOCK_SUBJECT_MATH_ID,
      assignedAcademicSectionIds: [MOCK_SECTION_ID],
    });

    expect(eligibleTeachers.map((teacher) => teacher._id)).toEqual([
      MOCK_LIVE_SESSION_TEACHER_ID,
    ]);

    expect(
      isLiveSessionJoinable({
        status: "scheduled",
        scheduledEndAt: "2026-04-15T10:00:00.000Z",
        now: new Date("2026-04-15T09:05:00.000Z"),
      }),
    ).toBe(true);
    expect(
      isLiveSessionJoinable({
        status: "cancelled",
        scheduledEndAt: "2026-04-15T10:00:00.000Z",
        now: new Date("2026-04-15T09:05:00.000Z"),
      }),
    ).toBe(false);
  });

  test("scopes workspace and student listings for admins, teachers, and students", async () => {
    const {
      getWorkspaceLiveSessionSupportData,
      listStudentLiveSessions,
      listWorkspaceLiveSessions,
    } = await loadLiveSessionServer();
    const adminSupportData = await getWorkspaceLiveSessionSupportData({
      schoolKey: "demo-school",
      viewerRole: "admin",
      viewerId: "school-admin-1",
    });
    expect(adminSupportData.defaultHostTeacherId).toBeNull();
    expect(adminSupportData.classes).toHaveLength(1);
    expect(adminSupportData.subjects).toHaveLength(2);
    expect(adminSupportData.teachers.map((teacher) => teacher._id).sort()).toEqual(
      [MOCK_LIVE_SESSION_TEACHER_ID, MOCK_LIVE_SESSION_TEACHER_TWO_ID].sort(),
    );

    const teacherSupportData = await getWorkspaceLiveSessionSupportData({
      schoolKey: "demo-school",
      viewerRole: "teacher",
      viewerId: MOCK_LIVE_SESSION_TEACHER_ID,
    });
    expect(teacherSupportData.defaultHostTeacherId).toBe(
      MOCK_LIVE_SESSION_TEACHER_ID,
    );
    expect(teacherSupportData.subjects.map((subject) => subject._id)).toEqual([
      MOCK_SUBJECT_MATH_ID,
    ]);
    expect(teacherSupportData.teachers.map((teacher) => teacher._id)).toEqual([
      MOCK_LIVE_SESSION_TEACHER_ID,
    ]);

    const teacherSessions = await listWorkspaceLiveSessions({
      schoolKey: "demo-school",
      viewerRole: "teacher",
      viewerId: MOCK_LIVE_SESSION_TEACHER_ID,
    });
    expect(teacherSessions.length).toBeGreaterThan(0);
    expect(
      teacherSessions.every((session) => session.subject?._id === MOCK_SUBJECT_MATH_ID),
    ).toBe(true);

    const visibleStudentSessions = await listStudentLiveSessions({
      schoolKey: "demo-school",
      studentId: "student-1",
      studentPlacement: {
        classId: MOCK_CLASS_ID,
        academicSectionId: MOCK_SECTION_ID,
      },
    });
    expect(visibleStudentSessions.length).toBeGreaterThan(0);
    expect(visibleStudentSessions.every((session) => session.status !== "draft")).toBe(
      true,
    );

    const hiddenStudentSessions = await listStudentLiveSessions({
      schoolKey: "demo-school",
      studentId: "student-1",
      studentPlacement: {
        classId: MOCK_CLASS_ID,
        academicSectionId: "999999999999999999999999",
      },
    });
    expect(hiddenStudentSessions).toEqual([]);
  });

  test("keeps section-scoped student visibility when live-session sections are populated objects", async () => {
    const { isLiveSessionVisibleToStudent } = await loadLiveSessionServer();

    expect(
      isLiveSessionVisibleToStudent({
        liveSession: {
          class: { _id: MOCK_CLASS_ID, name: "Class X" },
          assignedAcademicSections: [{ _id: MOCK_SECTION_ID, name: "Watson" }],
          status: "scheduled",
        },
        studentPlacement: {
          classId: MOCK_CLASS_ID,
          academicSectionId: MOCK_SECTION_ID,
        },
      }),
    ).toBe(true);

    expect(
      isLiveSessionVisibleToStudent({
        liveSession: {
          class: { _id: MOCK_CLASS_ID, name: "Class X" },
          assignedAcademicSections: [{ _id: MOCK_SECTION_ID, name: "Watson" }],
          status: "scheduled",
        },
        studentPlacement: {
          classId: MOCK_CLASS_ID,
          academicSectionId: "999999999999999999999999",
        },
      }),
    ).toBe(false);
  });

  test("records join activity and allows attendance overrides for a scheduled session", async () => {
    const {
      recordStudentLiveSessionJoinAndResolveTarget,
      updateWorkspaceLiveSessionAttendance,
    } = await loadLiveSessionServer();
    const createdSession = createMockLiveSession({
      title: `Automation Live Class ${Date.now()}`,
      description: "Created inside the helper coverage spec.",
      classId: MOCK_CLASS_ID,
      subjectId: MOCK_SUBJECT_MATH_ID,
      assignedAcademicSectionIds: [MOCK_SECTION_ID],
      hostTeacherId: MOCK_LIVE_SESSION_TEACHER_ID,
      createdBy: "school-admin-1",
      updatedBy: "school-admin-1",
      scheduledStartAt: "2026-04-20T09:00:00.000Z",
      scheduledEndAt: "2026-04-20T10:00:00.000Z",
      studentJoinUrl: "https://meet.example.com/student/automation-live-class",
      hostJoinUrl: "https://meet.example.com/host/automation-live-class",
      meetingCode: "AUTO-201",
      meetingPasscode: "READY",
      joinInstructions: "Open the mock meeting link when instructed.",
      status: "scheduled",
      notificationRevision: 1,
    });

    try {
      const joinResult = await recordStudentLiveSessionJoinAndResolveTarget({
        schoolKey: "demo-school",
        studentId: "student-3",
        studentPlacement: {
          classId: MOCK_CLASS_ID,
          academicSectionId: MOCK_SECTION_ID,
        },
        liveSessionId: createdSession._id,
      });

      expect(joinResult?.redirectUrl).toBe(
        "https://meet.example.com/student/automation-live-class",
      );
      expect(joinResult?.session?.attendanceStatus).toBe("joined");
      expect(joinResult?.session?.joinClicks).toBe(1);

      const attendanceUpdated = await updateWorkspaceLiveSessionAttendance({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        attendance: [
          {
            studentId: "student-3",
            status: "present",
          },
        ],
      });

      const studentAttendance = attendanceUpdated?.attendance.find(
        (item) => item.studentId === "student-3",
      );

      expect(studentAttendance?.joinClicks).toBe(1);
      expect(studentAttendance?.status).toBe("present");
      expect(studentAttendance?.markedByName).toBe("Admin");
    } finally {
      deleteMockLiveSession(createdSession._id);
    }
  });

  test("manages live-item lifecycle, transcript visibility, and student response upserts", async () => {
    const {
      activateWorkspaceLiveSessionItem,
      closeWorkspaceLiveSessionItem,
      createWorkspaceLiveSessionItem,
      getStudentLiveSessionById,
      getWorkspaceLiveSessionById,
      getWorkspaceLiveSessionItemResponses,
      normalizeLiveSessionItemWriteInput,
      normalizeStudentLiveSessionResponseInput,
      submitStudentLiveSessionResponse,
      upsertWorkspaceLiveSessionTranscript,
    } = await loadLiveSessionServer();
    const createdSession = createMockLiveSession({
      title: `Live Session V2 ${Date.now()}`,
      description: "Rich-text item lifecycle coverage for the live-session helper spec.",
      classId: MOCK_CLASS_ID,
      subjectId: MOCK_SUBJECT_MATH_ID,
      assignedAcademicSectionIds: [MOCK_SECTION_ID],
      hostTeacherId: MOCK_LIVE_SESSION_TEACHER_ID,
      createdBy: "school-admin-1",
      updatedBy: "school-admin-1",
      scheduledStartAt: "2026-04-22T09:00:00.000Z",
      scheduledEndAt: "2026-04-22T10:00:00.000Z",
      studentJoinUrl: "https://meet.example.com/student/live-v2-helper",
      hostJoinUrl: "https://meet.example.com/host/live-v2-helper",
      meetingCode: "LIVE-V2",
      meetingPasscode: "HELPER",
      joinInstructions: "Stay on the shared page while the teacher opens each item.",
      status: "scheduled",
      notificationRevision: 1,
    });

    try {
      let teacherDetail = await createWorkspaceLiveSessionItem({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        input: normalizeLiveSessionItemWriteInput({
          type: "multiple",
          promptHtml:
            '<p>Select the two revision habits that help most.</p><p><span data-type="math" data-latex="2+2" data-display-mode="false"></span> is only a formatting check.</p>',
          options: [
            { contentHtml: "<p>Mark the easy questions first.</p>" },
            { contentHtml: "<p>Keep five minutes for review.</p>" },
            { contentHtml: "<p>Leave the paper blank until the end.</p>" },
          ],
          answerIndexes: [0, 1],
          explanationHtml: "<p>Start strong and leave time for checking.</p>",
        }),
      });

      teacherDetail = await createWorkspaceLiveSessionItem({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        input: normalizeLiveSessionItemWriteInput({
          type: "short-text",
          promptHtml: "<p>Write one strategy you will use in the next test.</p>",
          options: [],
          answerIndexes: [],
          explanationHtml: "",
        }),
      });

      const multipleItem = teacherDetail?.items.find((item) => item.type === "multiple");
      const shortTextItem = teacherDetail?.items.find(
        (item) => item.type === "short-text",
      );

      expect(multipleItem?._id).toBeTruthy();
      expect(shortTextItem?._id).toBeTruthy();
      expect(teacherDetail?.shareHref).toBe(`/student/live-classes/${createdSession._id}`);

      await expect(
        upsertWorkspaceLiveSessionTranscript({
          schoolKey: "demo-school",
          viewerRole: "teacher",
          viewerId: MOCK_LIVE_SESSION_TEACHER_TWO_ID,
          liveSessionId: createdSession._id,
          input: {
            rawText: "This should be rejected for an out-of-scope teacher.",
            summaryHtml: "<p>Out-of-scope update.</p>",
            isPublished: true,
          },
        }),
      ).rejects.toThrow(/do not have access/i);

      const studentBeforePublish = await getStudentLiveSessionById({
        schoolKey: "demo-school",
        studentId: "student-1",
        studentPlacement: {
          classId: MOCK_CLASS_ID,
          academicSectionId: MOCK_SECTION_ID,
        },
        liveSessionId: createdSession._id,
      });
      expect(studentBeforePublish?.publishedTranscriptSummary).toBeNull();

      teacherDetail = await upsertWorkspaceLiveSessionTranscript({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        input: {
          rawText: "Teacher reviewed pacing, neat work, and final review time.",
          summaryHtml:
            "<p><strong>Focus:</strong> finish your first pass, then use the last five minutes to check.</p>",
          isPublished: true,
        },
      });

      expect(teacherDetail?.transcript?.isPublished).toBe(true);

      const studentAfterPublish = await getStudentLiveSessionById({
        schoolKey: "demo-school",
        studentId: "student-1",
        studentPlacement: {
          classId: MOCK_CLASS_ID,
          academicSectionId: MOCK_SECTION_ID,
        },
        liveSessionId: createdSession._id,
      });
      expect(studentAfterPublish?.publishedTranscriptSummary?.summaryHtml).toContain(
        "Focus",
      );

      teacherDetail = await activateWorkspaceLiveSessionItem({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        itemId: multipleItem!._id,
      });
      expect(teacherDetail?.activeItem?._id).toBe(multipleItem?._id);

      await Promise.all([
        submitStudentLiveSessionResponse({
          schoolKey: "demo-school",
          studentId: "student-1",
          studentPlacement: {
            classId: MOCK_CLASS_ID,
            academicSectionId: MOCK_SECTION_ID,
          },
          liveSessionId: createdSession._id,
          itemId: multipleItem!._id,
          input: normalizeStudentLiveSessionResponseInput({
            selectedOptionIndexes: [0, 1],
          }),
        }),
        submitStudentLiveSessionResponse({
          schoolKey: "demo-school",
          studentId: "student-1",
          studentPlacement: {
            classId: MOCK_CLASS_ID,
            academicSectionId: MOCK_SECTION_ID,
          },
          liveSessionId: createdSession._id,
          itemId: multipleItem!._id,
          input: normalizeStudentLiveSessionResponseInput({
            selectedOptionIndexes: [0, 1],
          }),
        }),
      ]);

      teacherDetail = await getWorkspaceLiveSessionById({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
      });

      const multipleStats = teacherDetail?.items.find(
        (item) => item._id === multipleItem?._id,
      );
      expect(multipleStats?.responseCount).toBe(1);
      expect(multipleStats?.correctCount).toBe(1);
      expect(multipleStats?.incorrectCount).toBe(0);

      const multipleResponses = await getWorkspaceLiveSessionItemResponses({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        itemId: multipleItem!._id,
        page: 1,
        limit: 10,
      });
      expect(multipleResponses?.total).toBe(1);
      expect(multipleResponses?.responses[0]?.isCorrect).toBe(true);

      teacherDetail = await closeWorkspaceLiveSessionItem({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        itemId: multipleItem!._id,
      });
      expect(teacherDetail?.activeItem).toBeNull();

      await expect(
        submitStudentLiveSessionResponse({
          schoolKey: "demo-school",
          studentId: "student-1",
          studentPlacement: {
            classId: MOCK_CLASS_ID,
            academicSectionId: MOCK_SECTION_ID,
          },
          liveSessionId: createdSession._id,
          itemId: multipleItem!._id,
          input: normalizeStudentLiveSessionResponseInput({
            selectedOptionIndexes: [0],
          }),
        }),
      ).rejects.toThrow(/no longer accepting responses/i);

      teacherDetail = await activateWorkspaceLiveSessionItem({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        itemId: shortTextItem!._id,
      });
      expect(teacherDetail?.activeItem?._id).toBe(shortTextItem?._id);

      const shortTextResult = await submitStudentLiveSessionResponse({
        schoolKey: "demo-school",
        studentId: "student-2",
        studentPlacement: {
          classId: MOCK_CLASS_ID,
          academicSectionId: MOCK_SECTION_ID,
        },
        liveSessionId: createdSession._id,
        itemId: shortTextItem!._id,
        input: normalizeStudentLiveSessionResponseInput({
          answerHtml:
            "<p>I will use <strong>keywords</strong> and remove <script>alert(1)</script> distractions.</p>",
        }),
      });

      expect(shortTextResult?.studentResponse?.answerHtml).toContain(
        "<strong>keywords</strong>",
      );
      expect(shortTextResult?.studentResponse?.answerHtml).not.toContain("<script");

      const shortTextResponses = await getWorkspaceLiveSessionItemResponses({
        schoolKey: "demo-school",
        viewerRole: "admin",
        viewerId: "school-admin-1",
        liveSessionId: createdSession._id,
        itemId: shortTextItem!._id,
        page: 1,
        limit: 10,
      });
      expect(shortTextResponses?.total).toBe(1);
      expect(shortTextResponses?.responses[0]?.answerHtml).toContain("keywords");
      expect(shortTextResponses?.responses[0]?.isCorrect).toBeNull();
    } finally {
      deleteMockLiveSession(createdSession._id);
    }
  });
});
