import { buildArchiveFilter } from "@/lib/archive";

export function normalizeEmail(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || undefined;
}

export function normalizeRollNumber(value: unknown) {
  return String(value || "").trim();
}

export function getDefaultStudentPassword(rollNumber: unknown) {
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  return normalizedRollNumber || undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildStudentRollNumberMatcher(rollNumber: string) {
  return new RegExp(`^${escapeRegExp(normalizeRollNumber(rollNumber))}$`, "i");
}

export async function findStudentsByRollNumber(
  UserModel: any,
  rollNumber: string,
  options?: {
    excludeUserId?: string;
    includeArchived?: boolean;
    limit?: number;
  },
) {
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  if (!normalizedRollNumber) {
    return [];
  }

  const query: Record<string, unknown> = {
    role: "student",
    rollNumber: buildStudentRollNumberMatcher(normalizedRollNumber),
    ...buildArchiveFilter(options?.includeArchived === true),
  };

  if (options?.excludeUserId) {
    query._id = { $ne: options.excludeUserId };
  }

  let cursor = UserModel.find(query);
  if (typeof options?.limit === "number") {
    cursor = cursor.limit(options.limit);
  }

  return await cursor;
}

export function resolveUserPasswordInput({
  role,
  rollNumber,
  password,
}: {
  role: string;
  rollNumber?: string;
  password?: string;
}) {
  if (role === "student") {
    return getDefaultStudentPassword(rollNumber);
  }

  const rawPassword = typeof password === "string" ? password : "";
  if (rawPassword.trim()) {
    return rawPassword;
  }

  return undefined;
}

export function validatePasswordInput({
  role,
  rollNumber,
  password,
}: {
  role: string;
  rollNumber?: string;
  password?: string;
}) {
  const rawPassword = typeof password === "string" ? password : "";
  if (!rawPassword.trim()) {
    return { ok: true as const };
  }

  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  if (
    role === "student" &&
    normalizedRollNumber &&
    rawPassword === normalizedRollNumber
  ) {
    return { ok: true as const };
  }

  if (rawPassword.length < 6) {
    return {
      ok: false as const,
      message:
        "Password must be at least 6 characters long, unless it matches the student's roll number exactly.",
    };
  }

  return { ok: true as const };
}

export function isSameStudentPlacement(
  student: {
    class?: unknown;
    academicSection?: unknown;
  },
  classId: string,
  academicSectionId?: string,
) {
  return (
    String(student?.class || "") === String(classId || "") &&
    String(student?.academicSection || "") === String(academicSectionId || "")
  );
}
