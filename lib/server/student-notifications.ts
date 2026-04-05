import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  enqueueRedisPartitionQueueItems,
  STUDENT_NOTIFICATION_REDIS_QUEUE,
} from "@/lib/redis";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";
import {
  normalizeId,
  normalizeIds,
} from "@/lib/server/student-notification-delivery";
import { runStudentNotificationWorker } from "@/lib/server/student-notification-worker";
import type {
  StudentNotificationEntityType,
  StudentNotificationType,
} from "@/models/StudentNotification";
import StudentNotificationJob from "@/models/StudentNotificationJob";

type QueueStudentNotificationJobInput = {
  schoolKey: string;
  type: StudentNotificationType;
  title: string;
  message: string;
  linkUrl: string;
  entityId: string;
  entityType: StudentNotificationEntityType;
  classId?: string;
  assignedAcademicSections?: unknown[];
  studentIds?: string[];
};

function getStudentNotificationWorkerSecret() {
  return String(process.env.STUDENT_NOTIFICATION_WORKER_SECRET || "").trim();
}

function scheduleStudentNotificationWorker(params: {
  schoolKey: string;
  jobIds: string[];
}) {
  const normalizedJobIds = Array.from(
    new Set(
      (Array.isArray(params.jobIds) ? params.jobIds : [])
        .map((jobId) => String(jobId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!params.schoolKey || normalizedJobIds.length === 0) {
    return;
  }

  queueMicrotask(() => {
    void triggerStudentNotificationWorker({
      schoolKey: params.schoolKey,
      jobIds: normalizedJobIds,
    }).catch((error) => {
      console.error("Failed to auto-trigger student notification worker", error);
    });
  });
}

export async function triggerStudentNotificationWorker(params: {
  schoolKey: string;
  jobIds?: string[];
}) {
  const normalizedJobIds = Array.from(
    new Set(
      (Array.isArray(params.jobIds) ? params.jobIds : [])
        .map((jobId) => String(jobId || "").trim())
        .filter(Boolean),
    ),
  );

  if (!params.schoolKey) {
    return null;
  }

  const workerSecret = getStudentNotificationWorkerSecret();
  if (workerSecret) {
    const response = await fetch(
      `${getTrustedInternalOrigin()}/api/student/notifications/worker`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-notification-worker-secret": workerSecret,
        },
        cache: "no-store",
        body: JSON.stringify({
          schoolKey: params.schoolKey,
          jobIds: normalizedJobIds,
          limitPerSchool: Math.max(10, normalizedJobIds.length || 0),
          maxSchools: 1,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Student notification worker trigger failed with status ${response.status}.`,
      );
    }

    return response.json().catch(() => null);
  }

  return runStudentNotificationWorker({
    schoolKey: params.schoolKey,
    jobIds: normalizedJobIds,
    limit: Math.max(10, normalizedJobIds.length || 0),
  });
}

async function queueStudentNotificationJobs(
  inputs: QueueStudentNotificationJobInput[],
) {
  const normalizedInputs = (Array.isArray(inputs) ? inputs : []).filter(
    (input) =>
      input &&
      String(input.schoolKey || "").trim() &&
      String(input.entityId || "").trim() &&
      (String(input.classId || "").trim() ||
        (Array.isArray(input.studentIds) && input.studentIds.length > 0)),
  );

  if (normalizedInputs.length === 0) {
    return [] as string[];
  }

  await connectDB();
  const now = new Date();
  const jobs = await StudentNotificationJob.insertMany(
    normalizedInputs.map((input) => ({
      schoolKey: String(input.schoolKey || "").trim(),
      type: input.type,
      title: String(input.title || "").trim(),
      message: String(input.message || "").trim(),
      linkUrl: String(input.linkUrl || "").trim(),
      entityId: String(input.entityId || "").trim(),
      entityType: input.entityType,
      targetClassId: String(input.classId || "").trim() || undefined,
      targetAcademicSectionIds: normalizeIds(input.assignedAcademicSections),
      targetStudentIds: Array.from(
        new Set(
          (Array.isArray(input.studentIds) ? input.studentIds : [])
            .map((studentId) => String(studentId || "").trim())
            .filter(Boolean),
        ),
      ),
      status: "queued",
      attempts: 0,
      maxAttempts: 4,
      nextRetryAt: now,
    })),
    { ordered: true },
  );

  const jobIds = jobs.map((job) => String(job._id));
  const schoolKeys = Array.from(
    new Set(jobs.map((job) => String(job.schoolKey || "").trim()).filter(Boolean)),
  );

  for (const schoolKey of schoolKeys) {
    const schoolJobIds = jobs
      .filter((job) => String(job.schoolKey || "").trim() === schoolKey)
      .map((job) => String(job._id));

    await enqueueRedisPartitionQueueItems({
      queueName: STUDENT_NOTIFICATION_REDIS_QUEUE,
      partitionKey: schoolKey,
      itemIds: schoolJobIds,
      availableAt: now,
    }).catch(() => null);

    scheduleStudentNotificationWorker({
      schoolKey,
      jobIds: schoolJobIds,
    });
  }

  return jobIds;
}

export async function createCourseAssignedNotifications({
  schoolKey,
  courseId,
  title,
  classId,
  assignedAcademicSections,
}: {
  schoolKey: string;
  courseId: string;
  title: string;
  classId: string;
  assignedAcademicSections: unknown[];
}) {
  return queueStudentNotificationJobs([
    {
      schoolKey,
      type: "course_assigned",
      title: "New course assigned",
      message: `You have a new course: ${title}.`,
      linkUrl: `/student/courses/${courseId}`,
      entityId: String(courseId),
      entityType: "course",
      classId: String(classId || "").trim(),
      assignedAcademicSections,
    },
  ]);
}

export async function createCourseDueSoonNotifications({
  schoolKey,
  courseId,
  title,
  classId,
  assignedAcademicSections,
  dueAt,
}: {
  schoolKey: string;
  courseId: string;
  title: string;
  classId: string;
  assignedAcademicSections: unknown[];
  dueAt: Date;
}) {
  const dueLabel = dueAt
    ? dueAt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return queueStudentNotificationJobs([
    {
      schoolKey,
      type: "course_due_soon",
      title: "Course due soon",
      message: dueLabel
        ? `${title} is due on ${dueLabel}.`
        : `${title} is due soon.`,
      linkUrl: `/student/courses/${courseId}`,
      entityId: String(courseId),
      entityType: "course",
      classId: String(classId || "").trim(),
      assignedAcademicSections,
    },
  ]);
}

export async function createTestAssignedNotifications({
  schoolKey,
  paperId,
  title,
  classId,
  assignedAcademicSections,
  examDate,
}: {
  schoolKey: string;
  paperId: string;
  title: string;
  classId: string;
  assignedAcademicSections: unknown[];
  examDate?: Date | null;
}) {
  const examLabel = examDate
    ? examDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  return queueStudentNotificationJobs([
    {
      schoolKey,
      type: "test_assigned",
      title: "New test assigned",
      message: examLabel
        ? `${title} is scheduled for ${examLabel}.`
        : `${title} is now available.`,
      linkUrl: `/student/tests/${paperId}`,
      entityId: String(paperId),
      entityType: "test",
      classId: String(classId || "").trim(),
      assignedAcademicSections,
    },
  ]);
}

export async function createDiaryUpdateNotifications({
  schoolKey,
  entryId,
  title,
  classId,
  assignedAcademicSections,
  entryDate,
}: {
  schoolKey: string;
  entryId: string;
  title: string;
  classId: string;
  assignedAcademicSections: unknown[];
  entryDate?: string;
}) {
  const dateLabel = entryDate ? ` (${entryDate})` : "";

  return queueStudentNotificationJobs([
    {
      schoolKey,
      type: "diary_update",
      title: "Diary update",
      message: `${title}${dateLabel} is available.`,
      linkUrl: `/student/diary/${entryId}`,
      entityId: String(entryId),
      entityType: "diary",
      classId: String(classId || "").trim(),
      assignedAcademicSections,
    },
  ]);
}

export async function createCourseDueSoonNotificationsForSchool({
  schoolKey,
  courseIds,
}: {
  schoolKey: string;
  courseIds?: string[];
}) {
  const { Course: CourseModel } = await getTenantModels(schoolKey, ["Course"]);
  const now = new Date();
  const dueSoonDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const query: Record<string, any> = {
    status: "published",
    dueAt: { $gte: now, $lte: dueSoonDate },
    ...buildArchiveFilter(false),
  };
  if (courseIds && courseIds.length > 0) {
    query._id = { $in: courseIds };
  }

  const courses = await CourseModel.find(query)
    .select("title class assignedAcademicSections dueAt")
    .lean();

  const jobsToQueue: QueueStudentNotificationJobInput[] = [];

  for (const course of courses) {
    const dueAt = course?.dueAt ? new Date(course.dueAt) : null;
    if (!dueAt) {
      continue;
    }

    const dueLabel = dueAt.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    jobsToQueue.push({
      schoolKey,
      type: "course_due_soon",
      title: "Course due soon",
      message: dueLabel
        ? `${String(course?.title || "Course")} is due on ${dueLabel}.`
        : `${String(course?.title || "Course")} is due soon.`,
      linkUrl: `/student/courses/${normalizeId(course?._id)}`,
      entityId: normalizeId(course?._id),
      entityType: "course",
      classId: normalizeId(course?.class),
      assignedAcademicSections: Array.isArray(course?.assignedAcademicSections)
        ? course.assignedAcademicSections
        : [],
    });
  }

  return queueStudentNotificationJobs(jobsToQueue);
}
