import bcrypt from "bcryptjs";

import { buildArchiveFilter } from "@/lib/archive";

export type StudentPasswordAdminInfo = {
  state: "default_phone" | "custom" | "missing";
  label: string;
  detail: string;
  currentPassword?: string;
  defaultPasswordAvailable: boolean;
};

export function normalizeEmail(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized || undefined;
}

export function normalizeRollNumber(value: unknown) {
  return String(value || "").trim();
}

export function normalizeStudentPasswordMobileNumber(value: unknown) {
  return String(value || "")
    .replace(/\D+/g, "")
    .trim();
}

export function getDefaultStudentPassword(mobileNumber: unknown) {
  const normalizedMobileNumber =
    normalizeStudentPasswordMobileNumber(mobileNumber);
  return normalizedMobileNumber || undefined;
}

export async function resolveStudentPasswordAdminInfo({
  mobileNumber,
  passwordHash,
}: {
  mobileNumber: unknown;
  passwordHash: unknown;
}): Promise<StudentPasswordAdminInfo> {
  const currentPasswordHash = String(passwordHash || "").trim();
  const defaultPassword = getDefaultStudentPassword(mobileNumber);

  if (!currentPasswordHash) {
    return {
      state: "missing",
      label: "Password missing",
      detail: defaultPassword
        ? "No active password is stored right now. Reset to the saved phone-number digits to restore sign-in."
        : "No active password is stored right now, and the saved phone number does not contain digits for a default reset.",
      defaultPasswordAvailable: Boolean(defaultPassword),
    };
  }

  if (defaultPassword) {
    try {
      const usesDefaultPassword = await bcrypt.compare(
        defaultPassword,
        currentPasswordHash,
      );

      if (usesDefaultPassword) {
        return {
          state: "default_phone",
          label: "Using default phone-digits password",
          detail:
            "The current password still matches the saved phone-number digits, so admins can show it here and reset it back to the same recovery password when needed.",
          currentPassword: defaultPassword,
          defaultPasswordAvailable: true,
        };
      }
    } catch {
      // Fall back to custom-password handling below.
    }
  }

  return {
    state: "custom",
    label: "Custom password set",
    detail: defaultPassword
      ? "The student is using a custom password. It cannot be viewed because only the secure hash is stored. If it is forgotten, reset it to the saved phone-number digits."
      : "The student is using a custom password. It cannot be viewed, and there is no phone-digits default available for reset yet. Save a phone number with digits first.",
    defaultPasswordAvailable: Boolean(defaultPassword),
  };
}

export function validateStudentDefaultPasswordSource(mobileNumber: unknown) {
  if (getDefaultStudentPassword(mobileNumber)) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    message:
      "Student phone number must include digits because it becomes the default password.",
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildStudentRollNumberMatcher(rollNumber: string) {
  return new RegExp(`^${escapeRegExp(normalizeRollNumber(rollNumber))}$`, "i");
}

type FindStudentsByRollNumberOptions = {
  excludeUserId?: string;
  includeArchived?: boolean;
  limit?: number;
  projection?: string;
  lean?: boolean;
};

export async function findStudentsByRollNumber(
  UserModel: any,
  rollNumber: string,
  options?: FindStudentsByRollNumberOptions,
) {
  const normalizedRollNumber = normalizeRollNumber(rollNumber);
  if (!normalizedRollNumber) {
    return [];
  }

  const baseQuery: Record<string, unknown> = {
    role: "student",
    ...buildArchiveFilter(options?.includeArchived === true),
  };

  if (options?.excludeUserId) {
    baseQuery._id = { $ne: options.excludeUserId };
  }

  const runQuery = async (query: Record<string, unknown>) => {
    let cursor = UserModel.find(query);
    if (options?.projection) {
      cursor = cursor.select(options.projection);
    }
    if (options?.lean) {
      cursor = cursor.lean();
    }
    if (typeof options?.limit === "number") {
      cursor = cursor.limit(options.limit);
    }

    return await cursor;
  };

  const exactMatches = await runQuery({
    ...baseQuery,
    rollNumber: normalizedRollNumber.toUpperCase(),
  });
  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return runQuery({
    ...baseQuery,
    rollNumber: buildStudentRollNumberMatcher(normalizedRollNumber),
  });
}

export function resolveUserPasswordInput({
  role,
  rollNumber,
  mobileNumber,
  password,
}: {
  role: string;
  rollNumber?: string;
  mobileNumber?: string;
  password?: string;
}) {
  if (role === "student") {
    return getDefaultStudentPassword(mobileNumber);
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
  mobileNumber,
  password,
}: {
  role: string;
  rollNumber?: string;
  mobileNumber?: string;
  password?: string;
}) {
  const rawPassword = typeof password === "string" ? password : "";
  if (!rawPassword.trim()) {
    return { ok: true as const };
  }

  const defaultStudentPassword = getDefaultStudentPassword(mobileNumber);
  if (
    role === "student" &&
    defaultStudentPassword &&
    rawPassword === defaultStudentPassword
  ) {
    return { ok: true as const };
  }

  if (rawPassword.length < 6) {
    return {
      ok: false as const,
      message:
        "Password must be at least 6 characters long, unless it matches the student's saved phone number digits exactly.",
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
