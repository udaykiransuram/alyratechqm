/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import { listStudentTestsData } from "../../lib/server/student-tests";
import { getStudentDashboardData } from "../../lib/server/student-dashboard";
import { runStudentNotificationWorker } from "../../lib/server/student-notification-worker";
import {
  getStudentCourseDetail,
  updateStudentCourseProgress,
} from "../../lib/server/student-courses";
import {
  getWorkspaceCourseById,
  listWorkspaceCourses,
} from "../../lib/server/workspace-courses";
import { listWorkspaceDiaryEntries } from "../../lib/server/diary";
import {
  buildAssessmentBlock,
  buildLessonBlock,
  buildTextBlock,
  cloneForAssertions,
  createLearningContentIntegrationSeed,
  toId,
  withPatchedMethod,
  type LearningContentIntegrationSeed,
} from "./learning-content-integration.helpers";
import StudentNotificationJob from "../../models/StudentNotificationJob";

test.describe.configure({ mode: "serial" });

function buildStudentPlacement(seed: LearningContentIntegrationSeed) {
  return {
    classId: toId(seed.classAlpha),
    academicSectionId: toId(seed.sectionAlphaOne),
  };
}

function buildPastDate(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
}

function buildIsoDate(offsetDays: number) {
  const date = new Date(Date.UTC(2026, 0, 1 + offsetDays, 12, 0, 0));
  return date.toISOString().slice(0, 10);
}

test.describe("Learning content integration (legacy backend)", () => {
  test.skip(
    Boolean(process.env.EXAM_RUNTIME_DATABASE_URL),
    "This suite validates the legacy Mongo-backed learning-content path. Run it with EXAM_RUNTIME_DATABASE_URL unset.",
  );

  let seed!: LearningContentIntegrationSeed;

  test.beforeEach(async () => {
    seed = await createLearningContentIntegrationSeed();
  });

  test.afterEach(async () => {
    if (seed) {
      await seed.cleanup();
    }
  });

  test("merges concurrent first-write progress updates instead of dropping one branch", async () => {
    const course = await seed.createCourse({
      key: "concurrency-first-write",
      blocks: [buildLessonBlock("lesson-1", "Concurrent Lesson")],
    });

    const { CourseProgress: CourseProgressModel } = seed.models;
    let synchronizedReads = 0;
    let releaseBarrier: (() => void) | null = null;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    await withPatchedMethod(
      CourseProgressModel,
      "findOne",
      (originalFindOne) =>
        (...args: any[]) => {
          const query = originalFindOne(...args);
          const originalLean = query.lean.bind(query);

          query.lean = async (...leanArgs: any[]) => {
            const result = await originalLean(...leanArgs);
            if (synchronizedReads < 2) {
              synchronizedReads += 1;
              if (synchronizedReads === 2) {
                releaseBarrier?.();
              }
              await barrier;
            }
            return result;
          };

          return query;
        },
      async () => {
        await Promise.all([
          updateStudentCourseProgress({
            schoolKey: seed.schoolKey,
            studentId: toId(seed.studentPrimary),
            studentPlacement: buildStudentPlacement(seed),
            courseId: toId(course),
            operations: {
              note: {
                blockId: "lesson-1",
                text: "Concurrent note",
              },
            },
          }),
          updateStudentCourseProgress({
            schoolKey: seed.schoolKey,
            studentId: toId(seed.studentPrimary),
            studentPlacement: buildStudentPlacement(seed),
            courseId: toId(course),
            operations: {
              bookmarkedBlockId: "lesson-1",
              bookmarked: true,
            },
          }),
        ]);
      },
    );

    const persisted = await CourseProgressModel.findOne({
      course: course._id,
      student: seed.studentPrimary._id,
    })
      .select("status bookmarkedBlockIds notes")
      .lean();

    expect(String(persisted?.status || "")).toBe("in_progress");
    expect(Array.isArray(persisted?.bookmarkedBlockIds)).toBeTruthy();
    expect(persisted?.bookmarkedBlockIds).toContain("lesson-1");
    expect(
      Array.isArray(persisted?.notes) &&
        persisted.notes.some(
          (note: any) =>
            note?.blockId === "lesson-1" && note?.text === "Concurrent note",
        ),
    ).toBe(true);
  });

  test("merges concurrent updates against an existing progress document", async () => {
    const course = await seed.createCourse({
      key: "concurrency-existing",
      blocks: [
        buildLessonBlock("lesson-1", "Existing Lesson"),
        buildTextBlock("text-1", "Existing text block"),
      ],
    });

    await seed.createCourseProgress({
      course,
      student: seed.studentPrimary,
      status: "in_progress",
      startedAt: new Date(),
      viewedBlockIds: ["lesson-1"],
      lastViewedBlockId: "lesson-1",
    });

    const { CourseProgress: CourseProgressModel } = seed.models;
    let synchronizedReads = 0;
    let releaseBarrier: (() => void) | null = null;
    const barrier = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });

    await withPatchedMethod(
      CourseProgressModel,
      "findOne",
      (originalFindOne) =>
        (...args: any[]) => {
          const query = originalFindOne(...args);
          const originalLean = query.lean.bind(query);

          query.lean = async (...leanArgs: any[]) => {
            const result = await originalLean(...leanArgs);
            if (synchronizedReads < 2) {
              synchronizedReads += 1;
              if (synchronizedReads === 2) {
                releaseBarrier?.();
              }
              await barrier;
            }
            return result;
          };

          return query;
        },
      async () => {
        await Promise.all([
          updateStudentCourseProgress({
            schoolKey: seed.schoolKey,
            studentId: toId(seed.studentPrimary),
            studentPlacement: buildStudentPlacement(seed),
            courseId: toId(course),
            operations: {
              note: {
                blockId: "lesson-1",
                text: "Merged note",
              },
            },
          }),
          updateStudentCourseProgress({
            schoolKey: seed.schoolKey,
            studentId: toId(seed.studentPrimary),
            studentPlacement: buildStudentPlacement(seed),
            courseId: toId(course),
            operations: {
              completedBlockId: "text-1",
              completed: true,
            },
          }),
        ]);
      },
    );

    const persisted = await CourseProgressModel.findOne({
      course: course._id,
      student: seed.studentPrimary._id,
    })
      .select("completedBlockIds notes")
      .lean();

    expect(persisted?.completedBlockIds).toContain("text-1");
    expect(
      Array.isArray(persisted?.notes) &&
        persisted.notes.some(
          (note: any) =>
            note?.blockId === "lesson-1" && note?.text === "Merged note",
        ),
    ).toBe(true);
  });

  test("student test listing returns only requested linked papers", async () => {
    const linkedPaper = await seed.createPaper({
      key: "linked-student-tests",
    });
    await seed.createPaper({
      key: "unlinked-student-tests",
    });

    const tests = await listStudentTestsData({
      schoolKey: seed.schoolKey,
      studentId: toId(seed.studentPrimary),
      studentPlacement: buildStudentPlacement(seed),
      paperIds: [toId(linkedPaper)],
      autoSubmitExpiredAttempts: false,
    });

    expect(tests.map((entry) => entry._id)).toEqual([toId(linkedPaper)]);
  });

  test("course detail reads only linked assessments and never auto-submits expired attempts", async () => {
    const linkedPaper = await seed.createPaper({
      key: "linked-course-detail",
      title: "Linked Detail Paper",
      onlineStartsAt: buildPastDate(4),
      onlineEndsAt: buildPastDate(1),
      examDate: buildPastDate(4),
      duration: 30,
    });
    const unlinkedPaper = await seed.createPaper({
      key: "unlinked-course-detail",
      title: "Unlinked Detail Paper",
      onlineStartsAt: buildPastDate(4),
      onlineEndsAt: buildPastDate(1),
      examDate: buildPastDate(4),
      duration: 30,
    });
    const course = await seed.createCourse({
      key: "course-detail-targeted",
      blocks: [
        buildLessonBlock("lesson-1", "Tracked Lesson"),
        buildAssessmentBlock("assessment-1", toId(linkedPaper)),
      ],
    });

    await seed.createAttempt({
      paper: linkedPaper,
      student: seed.studentPrimary,
      status: "in_progress",
      startedAt: buildPastDate(2),
    });
    await seed.createAttempt({
      paper: unlinkedPaper,
      student: seed.studentPrimary,
      status: "in_progress",
      startedAt: buildPastDate(2),
    });

    const { QuestionPaper: QuestionPaperModel, QuestionPaperResponse: ResponseModel } =
      seed.models;
    const questionPaperQueries: any[] = [];

    const detail = await withPatchedMethod(
      QuestionPaperModel,
      "find",
      (originalFind) =>
        (query: any, ...args: any[]) => {
          questionPaperQueries.push(cloneForAssertions(query));
          return originalFind(query, ...args);
        },
      async () =>
        getStudentCourseDetail({
          schoolKey: seed.schoolKey,
          studentId: toId(seed.studentPrimary),
          studentPlacement: buildStudentPlacement(seed),
          courseId: toId(course),
        }),
    );

    expect(detail).not.toBeNull();
    const assessmentBlock = detail?.blocks.find(
      (block) => block.type === "assessment",
    ) as any;
    expect(assessmentBlock?.assessmentState?.paperId).toBe(toId(linkedPaper));
    expect(assessmentBlock?.assessmentState?.attemptStatus).toBe("expired");
    expect(
      questionPaperQueries.some(
        (query) =>
          Array.isArray(query?._id?.$in) &&
          query._id.$in.map(String).includes(toId(linkedPaper)),
      ),
    ).toBe(true);
    expect(
      questionPaperQueries.some((query) => "class" in (query || {})),
    ).toBe(false);

    const persistedAttempts = await ResponseModel.find({
      student: seed.studentPrimary._id,
      paper: { $in: [linkedPaper._id, unlinkedPaper._id] },
    })
      .select("paper status submittedAt")
      .lean();

    expect(persistedAttempts).toHaveLength(2);
    persistedAttempts.forEach((attempt: any) => {
      expect(String(attempt?.status || "")).toBe("in_progress");
      expect(attempt?.submittedAt ?? null).toBeNull();
    });
  });

  test("course progress updates do not auto-submit expired attempts and stay targeted to linked papers", async () => {
    const linkedPaper = await seed.createPaper({
      key: "linked-course-update",
      title: "Linked Update Paper",
      onlineStartsAt: buildPastDate(4),
      onlineEndsAt: buildPastDate(1),
      examDate: buildPastDate(4),
      duration: 30,
    });
    const unlinkedPaper = await seed.createPaper({
      key: "unlinked-course-update",
      title: "Unlinked Update Paper",
      onlineStartsAt: buildPastDate(4),
      onlineEndsAt: buildPastDate(1),
      examDate: buildPastDate(4),
      duration: 30,
    });
    const course = await seed.createCourse({
      key: "course-update-targeted",
      blocks: [
        buildLessonBlock("lesson-1", "Writable Lesson"),
        buildAssessmentBlock("assessment-1", toId(linkedPaper)),
      ],
    });

    await seed.createAttempt({
      paper: linkedPaper,
      student: seed.studentPrimary,
      status: "in_progress",
      startedAt: buildPastDate(2),
    });
    await seed.createAttempt({
      paper: unlinkedPaper,
      student: seed.studentPrimary,
      status: "in_progress",
      startedAt: buildPastDate(2),
    });

    const { QuestionPaper: QuestionPaperModel, QuestionPaperResponse: ResponseModel } =
      seed.models;
    const questionPaperQueries: any[] = [];

    const progress = await withPatchedMethod(
      QuestionPaperModel,
      "find",
      (originalFind) =>
        (query: any, ...args: any[]) => {
          questionPaperQueries.push(cloneForAssertions(query));
          return originalFind(query, ...args);
        },
      async () =>
        updateStudentCourseProgress({
          schoolKey: seed.schoolKey,
          studentId: toId(seed.studentPrimary),
          studentPlacement: buildStudentPlacement(seed),
          courseId: toId(course),
          operations: {
            note: {
              blockId: "lesson-1",
              text: "Do not auto-submit during note save.",
            },
          },
        }),
    );

    expect(progress).not.toBeNull();
    if (!progress) {
      throw new Error("Expected course progress update to return a progress snapshot.");
    }

    expect(
      Array.isArray(progress.notes) &&
        progress.notes.some(
          (note) =>
            note.blockId === "lesson-1" &&
            note.text === "Do not auto-submit during note save.",
        ),
    ).toBe(true);
    expect(
      questionPaperQueries.some(
        (query) =>
          Array.isArray(query?._id?.$in) &&
          query._id.$in.map(String).includes(toId(linkedPaper)),
      ),
    ).toBe(true);
    expect(
      questionPaperQueries.some((query) => "class" in (query || {})),
    ).toBe(false);

    const persistedAttempts = await ResponseModel.find({
      student: seed.studentPrimary._id,
      paper: { $in: [linkedPaper._id, unlinkedPaper._id] },
    })
      .select("paper status submittedAt")
      .lean();

    expect(persistedAttempts).toHaveLength(2);
    persistedAttempts.forEach((attempt: any) => {
      expect(String(attempt?.status || "")).toBe("in_progress");
      expect(attempt?.submittedAt ?? null).toBeNull();
    });
  });

  test("student dashboard invalidates cached course summaries after progress updates", async () => {
    const course = await seed.createCourse({
      key: "dashboard-course-progress",
      title: "Dashboard Progress Course",
      blocks: [buildLessonBlock("lesson-1", "Dashboard Lesson")],
    });

    const before = await getStudentDashboardData({
      schoolKey: seed.schoolKey,
      studentId: toId(seed.studentPrimary),
      studentPlacement: buildStudentPlacement(seed),
    });
    const beforeCourse = before.courses.items.find(
      (item) => item.id === toId(course),
    );

    expect(beforeCourse?.status).toBe("not_started");
    expect(before.courses.inProgress).toBe(0);

    await updateStudentCourseProgress({
      schoolKey: seed.schoolKey,
      studentId: toId(seed.studentPrimary),
      studentPlacement: buildStudentPlacement(seed),
      courseId: toId(course),
      operations: {
        lastViewedBlockId: "lesson-1",
        viewedBlockId: "lesson-1",
      },
    });

    const after = await getStudentDashboardData({
      schoolKey: seed.schoolKey,
      studentId: toId(seed.studentPrimary),
      studentPlacement: buildStudentPlacement(seed),
    });
    const afterCourse = after.courses.items.find(
      (item) => item.id === toId(course),
    );

    expect(afterCourse?.status).toBe("in_progress");
    expect(after.courses.inProgress).toBe(1);
  });

  test("queued notification worker delivery invalidates cached dashboard notifications", async () => {
    const course = await seed.createCourse({
      key: "dashboard-notification-course",
      title: "Dashboard Notification Course",
      blocks: [buildLessonBlock("lesson-1", "Notification Lesson")],
    });

    const before = await getStudentDashboardData({
      schoolKey: seed.schoolKey,
      studentId: toId(seed.studentPrimary),
      studentPlacement: buildStudentPlacement(seed),
    });

    expect(before.notifications.unreadCount).toBe(0);

    const job = await StudentNotificationJob.create({
      schoolKey: seed.schoolKey,
      type: "course_assigned",
      title: "New course assigned",
      message: "You have a new course waiting.",
      linkUrl: `/student/courses/${toId(course)}`,
      entityId: toId(course),
      entityType: "course",
      targetClassId: seed.classAlpha._id,
      targetAcademicSectionIds: [seed.sectionAlphaOne._id],
      status: "queued",
      attempts: 0,
      maxAttempts: 4,
      nextRetryAt: new Date(),
    });

    const result = await runStudentNotificationWorker({
      schoolKey: seed.schoolKey,
      jobIds: [toId(job)],
    });

    expect(result.completed).toBe(1);
    expect(result.upsertedNotifications).toBe(1);

    const after = await getStudentDashboardData({
      schoolKey: seed.schoolKey,
      studentId: toId(seed.studentPrimary),
      studentPlacement: buildStudentPlacement(seed),
    });

    expect(after.notifications.unreadCount).toBe(1);
    expect(
      after.notifications.items.some(
        (item) =>
          item.type === "course_assigned" &&
          item.linkUrl === `/student/courses/${toId(course)}`,
      ),
    ).toBe(true);
  });

  test("teacher course listing enforces class, subject, and section scope in the query path", async () => {
    const visibleCourse = await seed.createCourse({
      key: "course-visible",
      title: "Visible Course",
      assignedSections: [seed.sectionAlphaOne],
      subjectDocs: [seed.subjectMath],
    });
    const visibleAllSectionsCourse = await seed.createCourse({
      key: "course-visible-all-sections",
      title: "Visible All Sections Course",
      assignedSections: [],
      subjectDocs: [seed.subjectMath],
    });
    await seed.createCourse({
      key: "course-hidden-section",
      title: "Hidden Section Course",
      assignedSections: [seed.sectionAlphaTwo],
      subjectDocs: [seed.subjectMath],
    });
    await seed.createCourse({
      key: "course-hidden-subject",
      title: "Hidden Subject Course",
      assignedSections: [seed.sectionAlphaOne],
      subjectDocs: [seed.subjectScience],
    });
    await seed.createCourse({
      key: "course-hidden-partial-subject",
      title: "Hidden Partial Subject Coverage Course",
      assignedSections: [seed.sectionAlphaOne],
      subjectDocs: [seed.subjectMath, seed.subjectScience],
    });
    await seed.createCourse({
      key: "course-hidden-class",
      title: "Hidden Class Course",
      classDoc: seed.classBeta,
      assignedSections: [seed.sectionBetaOne],
      subjectDocs: [seed.subjectMath],
      blocks: [buildLessonBlock("lesson-beta", "Beta Lesson")],
    });

    const directory = await listWorkspaceCourses({
      schoolKey: seed.schoolKey,
      viewerId: toId(seed.teacherScoped),
      viewerRole: "teacher",
    });

    expect(directory.courses.map((course) => course._id).sort()).toEqual(
      [toId(visibleCourse), toId(visibleAllSectionsCourse)].sort(),
    );
  });

  test("teacher course pagination slices at the query layer and course detail only loads linked papers", async () => {
    const { Course: CourseModel, QuestionPaper: QuestionPaperModel } = seed.models;

    for (let index = 0; index < 23; index += 1) {
      await seed.createCourse({
        key: `paginated-course-${index}`,
        title: `Paginated Course ${String(index).padStart(2, "0")}`,
        assignedSections: [seed.sectionAlphaOne],
        subjectDocs: [seed.subjectMath],
      });
    }

    const recordedCourseQueries: any[] = [];
    const recordedCourseLimits: number[] = [];
    const recordedCourseSkips: number[] = [];

    const [pageOne, pageTwo] = await withPatchedMethod(
      CourseModel,
      "find",
      (originalFind) =>
        (query: any, ...args: any[]) => {
          const mongooseQuery = originalFind(query, ...args);
          recordedCourseQueries.push(cloneForAssertions(query));

          const originalSkip = mongooseQuery.skip.bind(mongooseQuery);
          const originalLimit = mongooseQuery.limit.bind(mongooseQuery);

          mongooseQuery.skip = (value: number) => {
            recordedCourseSkips.push(Number(value));
            return originalSkip(value);
          };
          mongooseQuery.limit = (value: number) => {
            recordedCourseLimits.push(Number(value));
            return originalLimit(value);
          };

          return mongooseQuery;
        },
      async () =>
        Promise.all([
          listWorkspaceCourses({
            schoolKey: seed.schoolKey,
            viewerId: toId(seed.teacherScoped),
            viewerRole: "teacher",
            page: 1,
            limit: 10,
          }),
          listWorkspaceCourses({
            schoolKey: seed.schoolKey,
            viewerId: toId(seed.teacherScoped),
            viewerRole: "teacher",
            page: 2,
            limit: 10,
          }),
        ]),
    );

    expect(pageOne.total).toBe(23);
    expect(pageOne.pages).toBe(3);
    expect(pageOne.courses).toHaveLength(10);
    expect(pageTwo.courses).toHaveLength(10);
    expect(
      pageOne.courses.filter((course) =>
        pageTwo.courses.some((otherCourse) => otherCourse._id === course._id),
      ),
    ).toHaveLength(0);
    expect(recordedCourseLimits).toEqual(expect.arrayContaining([10, 10]));
    expect(recordedCourseSkips).toEqual(expect.arrayContaining([0, 10]));
    expect(
      recordedCourseQueries.some((query) =>
        JSON.stringify(query).includes(toId(seed.classAlpha)),
      ),
    ).toBe(true);

    const linkedPaper = await seed.createPaper({
      key: "course-detail-linked-paper",
    });
    for (let index = 0; index < 12; index += 1) {
      await seed.createPaper({
        key: `course-detail-extra-paper-${index}`,
      });
    }
    const courseWithLinkedAssessment = await seed.createCourse({
      key: "course-detail-linked-paper",
      blocks: [
        buildLessonBlock("lesson-1", "Teacher Detail Lesson"),
        buildAssessmentBlock("assessment-1", toId(linkedPaper)),
      ],
    });

    const questionPaperQueries: any[] = [];
    const detail = await withPatchedMethod(
      QuestionPaperModel,
      "find",
      (originalFind) =>
        (query: any, ...args: any[]) => {
          questionPaperQueries.push(cloneForAssertions(query));
          return originalFind(query, ...args);
        },
      async () =>
        getWorkspaceCourseById({
          schoolKey: seed.schoolKey,
          courseId: toId(courseWithLinkedAssessment),
          viewerId: toId(seed.teacherScoped),
          viewerRole: "teacher",
        }),
    );

    expect(detail).not.toBeNull();
    const assessmentBlock = detail?.blocks.find(
      (block) => block.type === "assessment",
    ) as any;
    expect(assessmentBlock?.paper?._id).toBe(toId(linkedPaper));
    expect(
      questionPaperQueries.some(
        (query) =>
          query?.onlineEnabled === true &&
          Array.isArray(query?._id?.$in) &&
          query._id.$in.length === 1 &&
          query._id.$in.map(String).includes(toId(linkedPaper)),
      ),
    ).toBe(true);
    expect(
      questionPaperQueries.some(
        (query) => query?.onlineEnabled === true && !query?._id,
      ),
    ).toBe(false);
  });

  test("teacher diary listing enforces class, subject, and section scope in the query path", async () => {
    const entryDate = "2026-02-10";
    const visibleEntry = await seed.createDiaryEntry({
      key: "diary-visible",
      title: "Visible Diary Entry",
      entryDate,
      assignedSections: [seed.sectionAlphaOne],
      subjectDoc: seed.subjectMath,
    });
    await seed.createDiaryEntry({
      key: "diary-hidden-section",
      title: "Hidden Section Diary Entry",
      entryDate,
      assignedSections: [seed.sectionAlphaTwo],
      subjectDoc: seed.subjectMath,
    });
    await seed.createDiaryEntry({
      key: "diary-hidden-all-sections",
      title: "Hidden All Sections Diary Entry",
      entryDate,
      assignedSections: [],
      subjectDoc: seed.subjectMath,
    });
    await seed.createDiaryEntry({
      key: "diary-hidden-subject",
      title: "Hidden Subject Diary Entry",
      entryDate,
      assignedSections: [seed.sectionAlphaOne],
      subjectDoc: seed.subjectScience,
    });
    await seed.createDiaryEntry({
      key: "diary-hidden-class",
      title: "Hidden Class Diary Entry",
      entryDate,
      classDoc: seed.classBeta,
      assignedSections: [seed.sectionBetaOne],
      subjectDoc: seed.subjectMath,
    });

    const directory = await listWorkspaceDiaryEntries({
      schoolKey: seed.schoolKey,
      viewerId: toId(seed.teacherScoped),
      filters: {
        entryDate,
      },
    });

    expect(directory.entries.map((entry) => entry._id)).toEqual([toId(visibleEntry)]);
  });

  test("teacher diary pagination keeps slices small and roster queries target only visible students", async () => {
    for (let index = 0; index < 3; index += 1) {
      await seed.createStudent({
        key: `alpha-one-visible-${index}`,
        classDoc: seed.classAlpha,
        sectionDoc: seed.sectionAlphaOne,
      });
    }
    for (let index = 0; index < 5; index += 1) {
      await seed.createStudent({
        key: `alpha-two-hidden-${index}`,
        classDoc: seed.classAlpha,
        sectionDoc: seed.sectionAlphaTwo,
      });
    }
    for (let index = 0; index < 4; index += 1) {
      await seed.createStudent({
        key: `beta-hidden-${index}`,
        classDoc: seed.classBeta,
        sectionDoc: seed.sectionBetaOne,
      });
    }

    for (let index = 0; index < 23; index += 1) {
      await seed.createDiaryEntry({
        key: `diary-page-${index}`,
        title: `Diary Page ${String(index).padStart(2, "0")}`,
        entryDate: buildIsoDate(index),
        assignedSections: [seed.sectionAlphaOne],
        subjectDoc: seed.subjectMath,
      });
    }

    const { DiaryEntry: DiaryEntryModel, User: UserModel } = seed.models;
    const recordedDiaryQueries: any[] = [];
    const recordedDiaryLimits: number[] = [];
    const recordedDiarySkips: number[] = [];
    const rosterStudentQueries: any[] = [];

    const directory = await withPatchedMethod(
      DiaryEntryModel,
      "find",
      (originalFind) =>
        (query: any, ...args: any[]) => {
          const mongooseQuery = originalFind(query, ...args);
          recordedDiaryQueries.push(cloneForAssertions(query));

          const originalSkip = mongooseQuery.skip.bind(mongooseQuery);
          const originalLimit = mongooseQuery.limit.bind(mongooseQuery);

          mongooseQuery.skip = (value: number) => {
            recordedDiarySkips.push(Number(value));
            return originalSkip(value);
          };
          mongooseQuery.limit = (value: number) => {
            recordedDiaryLimits.push(Number(value));
            return originalLimit(value);
          };

          return mongooseQuery;
        },
      async () =>
        withPatchedMethod(
          UserModel,
          "find",
          (originalFind) =>
            (query: any, ...args: any[]) => {
              if (query?.role === "student") {
                rosterStudentQueries.push(cloneForAssertions(query));
              }
              return originalFind(query, ...args);
            },
          async () =>
            listWorkspaceDiaryEntries({
              schoolKey: seed.schoolKey,
              viewerId: toId(seed.teacherScoped),
              filters: {
                classId: toId(seed.classAlpha),
                subjectId: toId(seed.subjectMath),
                sectionId: toId(seed.sectionAlphaOne),
              },
              page: 2,
              limit: 10,
            }),
        ),
    );

    expect(directory.total).toBe(23);
    expect(directory.pages).toBe(3);
    expect(directory.entries).toHaveLength(10);
    directory.entries.forEach((entry) => {
      expect(entry.class?._id).toBe(toId(seed.classAlpha));
      expect(entry.subject?._id).toBe(toId(seed.subjectMath));
      expect(entry.assignedAcademicSections.map((section) => section._id)).toEqual([
        toId(seed.sectionAlphaOne),
      ]);
      expect(entry.progressSummary.assignedStudents).toBe(4);
    });
    expect(recordedDiaryLimits).toContain(10);
    expect(recordedDiarySkips).toContain(10);
    expect(
      recordedDiaryQueries.some((query) =>
        JSON.stringify(query).includes(toId(seed.sectionAlphaOne)),
      ),
    ).toBe(true);

    expect(rosterStudentQueries).toHaveLength(1);
    expect(rosterStudentQueries[0]).toMatchObject({
      role: "student",
      class: toId(seed.classAlpha),
      academicSection: {
        $in: [toId(seed.sectionAlphaOne)],
      },
    });
    expect(JSON.stringify(rosterStudentQueries[0])).not.toContain(
      toId(seed.sectionAlphaTwo),
    );
    expect(JSON.stringify(rosterStudentQueries[0])).not.toContain(
      toId(seed.classBeta),
    );
  });
});
