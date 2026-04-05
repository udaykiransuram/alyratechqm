import { buildArchiveFilter } from "@/lib/archive";
import { getTenantModels } from "@/lib/db-tenant";
import { bumpStudentNotificationSignalVersion } from "@/lib/redis";
import { invalidateStudentDashboardCacheForStudents } from "@/lib/server/student-dashboard-cache";
import { broadcastStudentNotification } from "@/lib/server/student-notifications-stream";
import type {
  StudentNotificationEntityType,
  StudentNotificationType,
} from "@/models/StudentNotification";

export type StudentNotificationDeliveryInput = {
  schoolKey: string;
  studentIds?: string[];
  type: StudentNotificationType;
  title: string;
  message: string;
  linkUrl: string;
  entityId: string;
  entityType: StudentNotificationEntityType;
  classId?: string;
  assignedSectionIds?: string[];
};

export function normalizeId(value: unknown) {
  if (!value) return "";
  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
    return String(
      (value as Record<string, unknown>)._id || "",
    ).trim();
  }
  return String(value || "").trim();
}

export function normalizeIds(value: unknown) {
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

export async function listStudentIdsInScope({
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

  return students
    .map((student: any) => normalizeId(student?._id))
    .filter(Boolean);
}

function resolveBulkUpsertedCount(result: any) {
  const directCount = Number(result?.upsertedCount);
  if (Number.isFinite(directCount)) {
    return directCount;
  }

  const nestedCount = Number(result?.result?.nUpserted);
  if (Number.isFinite(nestedCount)) {
    return nestedCount;
  }

  return 0;
}

export async function resolveNotificationTargetStudentIds(
  params: Pick<
    StudentNotificationDeliveryInput,
    "schoolKey" | "studentIds" | "classId" | "assignedSectionIds"
  >,
) {
  const explicitStudentIds = Array.from(
    new Set(
      (Array.isArray(params.studentIds) ? params.studentIds : [])
        .map((studentId) => String(studentId || "").trim())
        .filter(Boolean),
    ),
  );

  if (explicitStudentIds.length > 0) {
    return explicitStudentIds;
  }

  const classId = String(params.classId || "").trim();
  if (!classId) {
    return [] as string[];
  }

  return listStudentIdsInScope({
    schoolKey: params.schoolKey,
    classId,
    assignedSectionIds: Array.from(
      new Set(
        (Array.isArray(params.assignedSectionIds)
          ? params.assignedSectionIds
          : []
        )
          .map((sectionId) => String(sectionId || "").trim())
          .filter(Boolean),
      ),
    ),
  });
}

export async function deliverStudentNotifications(
  params: StudentNotificationDeliveryInput,
) {
  const normalizedIds = await resolveNotificationTargetStudentIds(params);

  if (normalizedIds.length === 0) {
    return {
      studentIds: [] as string[],
      upsertedCount: 0,
    };
  }

  const { StudentNotification: StudentNotificationModel } = await getTenantModels(
    params.schoolKey,
    ["StudentNotification"],
  );
  const now = new Date();
  let upsertedCount = 0;

  try {
    const result = await StudentNotificationModel.bulkWrite(
      normalizedIds.map((studentId) => ({
        updateOne: {
          filter: {
            studentId,
            type: params.type,
            entityId: params.entityId,
          },
          update: {
            $setOnInsert: {
              studentId,
              type: params.type,
              title: params.title,
              message: params.message,
              linkUrl: params.linkUrl,
              entityId: params.entityId,
              entityType: params.entityType,
              readAt: null,
              createdAt: now,
              updatedAt: now,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    upsertedCount = resolveBulkUpsertedCount(result);
  } catch (error: any) {
    if (error?.code !== 11000) {
      console.error("Failed to upsert student notifications:", error);
      throw error;
    }
  }

  if (upsertedCount > 0) {
    await invalidateStudentDashboardCacheForStudents(
      params.schoolKey,
      normalizedIds,
    );

    await Promise.all(
      normalizedIds.map(async (studentId) => {
        const signalVersion = await bumpStudentNotificationSignalVersion(
          params.schoolKey,
          studentId,
        ).catch(() => null);

        broadcastStudentNotification(params.schoolKey, studentId, {
          id: params.entityId,
          type: params.type,
          signalVersion,
        });
      }),
    );
  }

  return {
    studentIds: normalizedIds,
    upsertedCount,
  };
}
