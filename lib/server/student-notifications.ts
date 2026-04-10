import {
  buildDefaultStudentNotificationDedupeKey,
  buildLiveSessionNotificationEntityId,
  buildLiveSessionNotificationDedupeKey,
  resolveLiveSessionReminderAvailableAt,
} from "@/lib/live-sessions/shared";
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
import mongoose from "mongoose";

type QueueStudentNotificationJobInput = {
  schoolKey: string;
  type: StudentNotificationType;
  title: string;
  message: string;
  linkUrl: string;
  entityId: string;
  dedupeKey?: string;
  entityType: StudentNotificationEntityType;
  classId?: string;
  assignedAcademicSections?: unknown[];
  studentIds?: string[];
  availableAt?: Date | number | string | null;
};

export type StudentNotificationSummaryItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  linkUrl: string;
  createdAt: string | null;
  readAt: string | null;
};

export type StudentNotificationSnapshot = {
  unreadCount: number;
  notifications: StudentNotificationSummaryItem[];
};

const DEFAULT_STUDENT_NOTIFICATION_LIMIT = 20;
const MAX_STUDENT_NOTIFICATION_LIMIT = 50;

function normalizeStudentNotificationLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_STUDENT_NOTIFICATION_LIMIT;
  }

  return Math.max(1, Math.min(MAX_STUDENT_NOTIFICATION_LIMIT, Math.trunc(parsed)));
}

function mapStudentNotificationSummaryItem(item: any): StudentNotificationSummaryItem {
  return {
    id: String(item?._id || item?.id || ""),
    type: String(item?.type || ""),
    title: String(item?.title || ""),
    message: String(item?.message || ""),
    linkUrl: String(item?.linkUrl || ""),
    createdAt: item?.createdAt ? new Date(item.createdAt).toISOString() : null,
    readAt: item?.readAt ? new Date(item.readAt).toISOString() : null,
  };
}

export async function getStudentNotificationUnreadCount(params: {
  schoolKey: string;
  studentId: string;
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  const studentId = String(params.studentId || "").trim();
  if (!schoolKey || !mongoose.Types.ObjectId.isValid(studentId)) {
    return 0;
  }

  await connectDB();
  const { StudentNotification: StudentNotificationModel } = await getTenantModels(
    schoolKey,
    ["StudentNotification"],
  );

  const unreadCount = await StudentNotificationModel.countDocuments({
    studentId,
    readAt: null,
  });

  return Number(unreadCount || 0);
}

export async function getStudentNotificationSnapshot(params: {
  schoolKey: string;
  studentId: string;
  limit?: number;
}): Promise<StudentNotificationSnapshot> {
  const schoolKey = String(params.schoolKey || "").trim();
  const studentId = String(params.studentId || "").trim();
  if (!schoolKey || !mongoose.Types.ObjectId.isValid(studentId)) {
    return {
      unreadCount: 0,
      notifications: [],
    };
  }

  const limit = normalizeStudentNotificationLimit(params.limit);
  await connectDB();
  const { StudentNotification: StudentNotificationModel } = await getTenantModels(
    schoolKey,
    ["StudentNotification"],
  );

  const [result] = await StudentNotificationModel.aggregate([
    {
      $match: {
        studentId: new mongoose.Types.ObjectId(studentId),
      },
    },
    {
      $facet: {
        notifications: [
          { $sort: { createdAt: -1 } },
          { $limit: limit },
          {
            $project: {
              _id: 1,
              type: 1,
              title: 1,
              message: 1,
              linkUrl: 1,
              createdAt: 1,
              readAt: 1,
            },
          },
        ],
        unread: [{ $match: { readAt: null } }, { $count: "count" }],
      },
    },
  ]);

  const unreadCount = Number(result?.unread?.[0]?.count || 0);
  const notifications = (Array.isArray(result?.notifications) ? result.notifications : []).map(
    mapStudentNotificationSummaryItem,
  );

  return {
    unreadCount,
    notifications,
  };
}

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
      dedupeKey:
        String(input.dedupeKey || "").trim() ||
        buildDefaultStudentNotificationDedupeKey(
          String(input.type || "").trim(),
          String(input.entityId || "").trim(),
        ),
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
      nextRetryAt:
        input.availableAt instanceof Date
          ? input.availableAt
          : typeof input.availableAt === "number"
            ? new Date(input.availableAt)
            : typeof input.availableAt === "string" && input.availableAt.trim()
              ? new Date(input.availableAt)
              : now,
    })),
    { ordered: true },
  );

  const jobIds = jobs.map((job) => String(job._id));
  const jobsBySchoolAndAvailability = new Map<
    string,
    Array<{
      jobId: string;
      availableAt: Date | null;
    }>
  >();

  jobs.forEach((job) => {
    const schoolKey = String(job.schoolKey || "").trim();
    if (!schoolKey) {
      return;
    }

    if (!jobsBySchoolAndAvailability.has(schoolKey)) {
      jobsBySchoolAndAvailability.set(schoolKey, []);
    }

    jobsBySchoolAndAvailability.get(schoolKey)?.push({
      jobId: String(job._id),
      availableAt: job.nextRetryAt ? new Date(job.nextRetryAt) : now,
    });
  });

  for (const [schoolKey, schoolJobs] of jobsBySchoolAndAvailability.entries()) {
    const jobsByAvailability = new Map<string, string[]>();

    schoolJobs.forEach((job) => {
      const availabilityKey = job.availableAt
        ? new Date(job.availableAt).toISOString()
        : now.toISOString();
      if (!jobsByAvailability.has(availabilityKey)) {
        jobsByAvailability.set(availabilityKey, []);
      }
      jobsByAvailability.get(availabilityKey)?.push(job.jobId);
    });

    for (const [availabilityKey, schoolJobIds] of jobsByAvailability.entries()) {
      await enqueueRedisPartitionQueueItems({
        queueName: STUDENT_NOTIFICATION_REDIS_QUEUE,
        partitionKey: schoolKey,
        itemIds: schoolJobIds,
        availableAt: availabilityKey,
      }).catch(() => null);
    }

    scheduleStudentNotificationWorker({
      schoolKey,
      jobIds: schoolJobs.map((job) => job.jobId),
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

export async function markStudentNotificationJobsSuperseded(params: {
  schoolKey: string;
  entityType: StudentNotificationEntityType;
  entityId: string;
  types?: StudentNotificationType[];
  excludeDedupeKeys?: string[];
}) {
  const schoolKey = String(params.schoolKey || "").trim();
  const entityId = String(params.entityId || "").trim();
  const excludeDedupeKeys = Array.from(
    new Set(
      (Array.isArray(params.excludeDedupeKeys) ? params.excludeDedupeKeys : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
  const types = Array.from(
    new Set(
      (Array.isArray(params.types) ? params.types : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

  if (!schoolKey || !entityId) {
    return { modifiedCount: 0 };
  }

  await connectDB();

  const query: Record<string, any> = {
    schoolKey,
    entityType: params.entityType,
    status: { $in: ["queued", "processing"] },
  };

  if (params.entityType === "live_session") {
    const escapedEntityId = entityId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { entityId },
      { entityId: { $regex: `^${escapedEntityId}:` } },
    ];
  } else {
    query.entityId = entityId;
  }

  if (types.length > 0) {
    query.type = { $in: types };
  }

  if (excludeDedupeKeys.length > 0) {
    query.dedupeKey = { $nin: excludeDedupeKeys };
  }

  const result = await StudentNotificationJob.updateMany(query, {
    $set: {
      status: "superseded",
      supersededAt: new Date(),
      completedAt: new Date(),
      error: "Superseded by a newer notification revision.",
    },
  });

  return {
    modifiedCount: Number(result.modifiedCount || 0),
  };
}

export async function createLiveSessionScheduledNotifications(params: {
  schoolKey: string;
  sessionId: string;
  title: string;
  classId: string;
  assignedAcademicSections: unknown[];
  notificationRevision: number;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
}) {
  const sessionId = String(params.sessionId || "").trim();
  const scheduledDedupeKey = buildLiveSessionNotificationDedupeKey({
    type: "live_session_scheduled",
    sessionId,
    revision: params.notificationRevision,
  });
  const reminderDedupeKey = buildLiveSessionNotificationDedupeKey({
    type: "live_session_reminder",
    sessionId,
    revision: params.notificationRevision,
  });
  const notificationEntityId = buildLiveSessionNotificationEntityId({
    sessionId,
    revision: params.notificationRevision,
  });

  await markStudentNotificationJobsSuperseded({
    schoolKey: params.schoolKey,
    entityType: "live_session",
    entityId: sessionId,
    types: ["live_session_scheduled", "live_session_reminder"],
    excludeDedupeKeys: [scheduledDedupeKey, reminderDedupeKey],
  }).catch(() => undefined);

  const startLabel = params.scheduledStartAt.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const jobs: QueueStudentNotificationJobInput[] = [
    {
      schoolKey: params.schoolKey,
      type: "live_session_scheduled",
      title: "Live class scheduled",
      message: `${params.title} starts on ${startLabel}.`,
      linkUrl: `/student/live-classes/${sessionId}`,
      entityId: notificationEntityId,
      dedupeKey: scheduledDedupeKey,
      entityType: "live_session",
      classId: params.classId,
      assignedAcademicSections: params.assignedAcademicSections,
    },
  ];

  const reminderAvailableAt = resolveLiveSessionReminderAvailableAt({
    scheduledStartAt: params.scheduledStartAt,
  });

  if (reminderAvailableAt) {
    jobs.push({
      schoolKey: params.schoolKey,
      type: "live_session_reminder",
      title: "Live class starts soon",
      message: `${params.title} starts in 15 minutes.`,
      linkUrl: `/student/live-classes/${sessionId}`,
      entityId: notificationEntityId,
      dedupeKey: reminderDedupeKey,
      entityType: "live_session",
      classId: params.classId,
      assignedAcademicSections: params.assignedAcademicSections,
      availableAt: reminderAvailableAt,
    });
  }

  return queueStudentNotificationJobs(jobs);
}

export async function createLiveSessionCancelledNotifications(params: {
  schoolKey: string;
  sessionId: string;
  title: string;
  classId: string;
  assignedAcademicSections: unknown[];
  notificationRevision: number;
}) {
  const sessionId = String(params.sessionId || "").trim();
  const cancelDedupeKey = buildLiveSessionNotificationDedupeKey({
    type: "live_session_cancelled",
    sessionId,
    revision: params.notificationRevision,
  });
  const notificationEntityId = buildLiveSessionNotificationEntityId({
    sessionId,
    revision: params.notificationRevision,
  });

  await markStudentNotificationJobsSuperseded({
    schoolKey: params.schoolKey,
    entityType: "live_session",
    entityId: sessionId,
    types: ["live_session_scheduled", "live_session_reminder", "live_session_cancelled"],
    excludeDedupeKeys: [cancelDedupeKey],
  }).catch(() => undefined);

  return queueStudentNotificationJobs([
    {
      schoolKey: params.schoolKey,
      type: "live_session_cancelled",
      title: "Live class cancelled",
      message: `${params.title} has been cancelled.`,
      linkUrl: `/student/live-classes/${sessionId}`,
      entityId: notificationEntityId,
      dedupeKey: cancelDedupeKey,
      entityType: "live_session",
      classId: params.classId,
      assignedAcademicSections: params.assignedAcademicSections,
    },
  ]);
}
