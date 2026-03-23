function resolvePositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name] || "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export const STUDENT_SESSION_TTL_SECONDS = resolvePositiveIntegerEnv(
  "STUDENT_SESSION_TTL_SECONDS",
  180,
);
export const ATTEMPT_LOCK_TTL_SECONDS = resolvePositiveIntegerEnv(
  "ATTEMPT_LOCK_TTL_SECONDS",
  120,
);
export const SNAPSHOT_CACHE_TTL_SECONDS = resolvePositiveIntegerEnv(
  "SNAPSHOT_CACHE_TTL_SECONDS",
  300,
);
export const AUTOSAVE_RATE_WINDOW_SECONDS = resolvePositiveIntegerEnv(
  "AUTOSAVE_RATE_WINDOW_SECONDS",
  30,
);
export const AUTOSAVE_RATE_LIMIT_MAX = resolvePositiveIntegerEnv(
  "AUTOSAVE_RATE_LIMIT_MAX",
  20,
);
export const STUDENT_LOGIN_RATE_WINDOW_SECONDS = resolvePositiveIntegerEnv(
  "STUDENT_LOGIN_RATE_WINDOW_SECONDS",
  600,
);
export const STUDENT_LOGIN_RATE_LIMIT_MAX = resolvePositiveIntegerEnv(
  "STUDENT_LOGIN_RATE_LIMIT_MAX",
  10,
);

export const STUDENT_SESSION_IDLE_TIMEOUT_MS =
  STUDENT_SESSION_TTL_SECONDS * 1000;
export const STUDENT_SESSION_HEARTBEAT_INTERVAL_MS = 60_000;
export const STUDENT_SESSION_MIN_REFRESH_INTERVAL_MS = 45_000;

function toValidDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const normalizedValue =
    typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : null;

  if (
    normalizedValue instanceof Date &&
    !Number.isNaN(normalizedValue.getTime())
  ) {
    return normalizedValue;
  }

  return null;
}

export function createStudentSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `student-session-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

export function getStudentSessionFreshnessCutoff(now = new Date()) {
  return new Date(now.getTime() - STUDENT_SESSION_IDLE_TIMEOUT_MS);
}

export function isStudentSessionFresh(lastSeenAt: unknown, now = new Date()) {
  const normalizedLastSeenAt = toValidDate(lastSeenAt);
  if (!normalizedLastSeenAt) {
    return false;
  }

  return (
    now.getTime() - normalizedLastSeenAt.getTime() <=
    STUDENT_SESSION_IDLE_TIMEOUT_MS
  );
}

export function shouldRefreshStudentSessionHeartbeat(
  lastSeenAt: unknown,
  now = new Date(),
) {
  const normalizedLastSeenAt = toValidDate(lastSeenAt);
  if (!normalizedLastSeenAt) {
    return true;
  }

  return (
    now.getTime() - normalizedLastSeenAt.getTime() >=
    STUDENT_SESSION_MIN_REFRESH_INTERVAL_MS
  );
}
