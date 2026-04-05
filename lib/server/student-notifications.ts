import { buildArchiveFilter } from "@/lib/archive";
import { getTenantModels } from "@/lib/db-tenant";
import { broadcastStudentNotification } from "@/lib/server/student-notifications-stream";

type StudentNotificationType =
  | "course_assigned"
  | "course_due_soon"
  | "test_assigned"
  | "diary_update";

type StudentNotificationEntityType = "course" | "test" | "diary";

type StudentNotificationCreateInput = {
  schoolKey: string;
  studentIds: string[];
  type: StudentNotificationType;
  title: string;
  message: string;
  linkUrl: string;
  entityId: string;
  entityType: StudentNotificationEntityType;
};

function normalizeId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }
  return String(value || "").trim();
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(value.map((item) => normalizeId(item)).filter(Boolean)),
  );
}

function buildStudentScopeQuery({
  classId,
  assignedSectionIds,
}: {
  classId: string;
  assignedSectionIds: string[];
}) {
  const query: Record<string, any> = {
    role: "student",
    class: classId,
    ...buildArchiveFilter(false),
  };

  if (assignedSectionIds.length > 0) {
    query.academicSection = { $in: assignedSectionIds };
  }

  return query;
}

async function listStudentIdsInScope({
  schoolKey,
  classId,
  assignedSectionIds,
}: {
  schoolKey: string;
  classId: string;
  assignedSectionIds: string[];
}) {
  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
  const students = await UserModel.find(
    buildStudentScopeQuery({ classId, assignedSectionIds }),
  )
    .select("_id")
    .lean();

  return students.map((student: any) => normalizeId(student?._id)).filter(Boolean);
}

async function upsertStudentNotifications({
  schoolKey,
  studentIds,
  type,
  title,
  message,
  linkUrl,
  entityId,
  entityType,
}: StudentNotificationCreateInput) {
  const normalizedIds = Array.from(new Set(studentIds.map((id) => String(id || "").trim()))).filter(
    Boolean,
  );

  if (normalizedIds.length === 0) return;

  const { StudentNotification: StudentNotificationModel } = await getTenantModels(
    schoolKey,
    ["StudentNotification"],
  );

  const now = new Date();

  await StudentNotificationModel.bulkWrite(
    normalizedIds.map((studentId) => ({
      updateOne: {
        filter: { studentId, type, entityId },
        update: {
          $setOnInsert: {
            studentId,
            type,
            title,
            message,
            linkUrl,
            entityId,
            entityType,
            readAt: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  ).catch((error: any) => {
    if (error?.code !== 11000) {
      console.error("Failed to upsert student notifications:", error);
    }
  });

  for (const studentId of normalizedIds) {
    broadcastStudentNotification(studentId, {
      id: entityId,
      type,
    });
  }
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
  const assignedSectionIds = normalizeIds(assignedAcademicSections);
  const studentIds = await listStudentIdsInScope({
    schoolKey,
    classId,
    assignedSectionIds,
  });

  await upsertStudentNotifications({
    schoolKey,
    studentIds,
    type: "course_assigned",
    title: "New course assigned",
    message: `You have a new course: ${title}.`,
    linkUrl: `/student/courses/${courseId}`,
    entityId: String(courseId),
    entityType: "course",
  });
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
  const assignedSectionIds = normalizeIds(assignedAcademicSections);
  const studentIds = await listStudentIdsInScope({
    schoolKey,
    classId,
    assignedSectionIds,
  });

  const dueLabel = dueAt
    ? dueAt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  await upsertStudentNotifications({
    schoolKey,
    studentIds,
    type: "course_due_soon",
    title: "Course due soon",
    message: dueLabel
      ? `${title} is due on ${dueLabel}.`
      : `${title} is due soon.`,
    linkUrl: `/student/courses/${courseId}`,
    entityId: String(courseId),
    entityType: "course",
  });
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
  const assignedSectionIds = normalizeIds(assignedAcademicSections);
  const studentIds = await listStudentIdsInScope({
    schoolKey,
    classId,
    assignedSectionIds,
  });

  const examLabel = examDate
    ? examDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

  await upsertStudentNotifications({
    schoolKey,
    studentIds,
    type: "test_assigned",
    title: "New test assigned",
    message: examLabel
      ? `${title} is scheduled for ${examLabel}.`
      : `${title} is now available.`,
    linkUrl: `/student/tests/${paperId}`,
    entityId: String(paperId),
    entityType: "test",
  });
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
  const assignedSectionIds = normalizeIds(assignedAcademicSections);
  const studentIds = await listStudentIdsInScope({
    schoolKey,
    classId,
    assignedSectionIds,
  });

  const dateLabel = entryDate ? ` (${entryDate})` : "";

  await upsertStudentNotifications({
    schoolKey,
    studentIds,
    type: "diary_update",
    title: "Diary update",
    message: `${title}${dateLabel} is available.`,
    linkUrl: `/student/diary/${entryId}`,
    entityId: String(entryId),
    entityType: "diary",
  });
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

  for (const course of courses) {
    const dueAt = course?.dueAt ? new Date(course.dueAt) : null;
    if (!dueAt) continue;
    await createCourseDueSoonNotifications({
      schoolKey,
      courseId: normalizeId(course?._id),
      title: String(course?.title || "Course"),
      classId: normalizeId(course?.class),
      assignedAcademicSections: Array.isArray(course?.assignedAcademicSections)
        ? course.assignedAcademicSections
        : [],
      dueAt,
    });
  }
}
