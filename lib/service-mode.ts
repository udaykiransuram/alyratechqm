export type AppServiceMode = "full" | "student" | "staff";
export type AppTrafficSurface = "shared" | "student" | "staff";

type AppServiceConfig = {
  mode: AppServiceMode;
  studentOrigin: string | null;
  staffOrigin: string | null;
};

const SHARED_API_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/api/release-health",
  "/api/public",
];

function normalizePathname(pathname: string) {
  return String(pathname || "").trim() || "/";
}

function normalizeOrigin(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

export function getAppServiceMode(): AppServiceMode {
  const normalized = String(process.env.APP_SERVICE_MODE || "full")
    .trim()
    .toLowerCase();

  if (normalized === "student" || normalized === "staff") {
    return normalized;
  }

  return "full";
}

export function getAppServiceConfig(): AppServiceConfig {
  return {
    mode: getAppServiceMode(),
    studentOrigin: normalizeOrigin(process.env.STUDENT_APP_ORIGIN),
    staffOrigin: normalizeOrigin(process.env.STAFF_APP_ORIGIN),
  };
}

export function classifyTrafficSurface(pathname: string): AppTrafficSurface {
  const normalizedPath = normalizePathname(pathname);

  if (
    normalizedPath === "/student" ||
    normalizedPath.startsWith("/student/") ||
    normalizedPath === "/api/student" ||
    normalizedPath.startsWith("/api/student/")
  ) {
    return "student";
  }

  if (
    normalizedPath === "/workspace" ||
    normalizedPath.startsWith("/workspace/") ||
    normalizedPath === "/company" ||
    normalizedPath.startsWith("/company/")
  ) {
    return "staff";
  }

  if (normalizedPath === "/api" || normalizedPath.startsWith("/api/")) {
    if (
      SHARED_API_PREFIXES.some(
        (prefix) =>
          normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
      )
    ) {
      return "shared";
    }

    return "staff";
  }

  return "shared";
}

export function isTrafficSurfaceAllowed(
  mode: AppServiceMode,
  surface: AppTrafficSurface,
) {
  if (mode === "full" || surface === "shared") {
    return true;
  }

  return mode === surface;
}

export function getCounterpartOriginForSurface(
  surface: AppTrafficSurface,
  config = getAppServiceConfig(),
) {
  if (surface === "student") {
    return config.studentOrigin;
  }

  if (surface === "staff") {
    return config.staffOrigin;
  }

  return null;
}

export function buildCounterpartUrl(
  targetOrigin: string,
  pathname: string,
  search: string,
) {
  const url = new URL(normalizePathname(pathname), targetOrigin);
  url.search = String(search || "");
  return url.toString();
}

export function describeTrafficSurface(surface: AppTrafficSurface) {
  if (surface === "student") {
    return "student";
  }

  if (surface === "staff") {
    return "staff";
  }

  return "shared";
}

