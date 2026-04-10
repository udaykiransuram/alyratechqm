/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

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
});
