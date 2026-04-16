"use client";

const STUDENT_PORTAL_SIGNIN_PATH_COOKIE = "studentPortalSignInPath";
const DEFAULT_STUDENT_PORTAL_SIGNIN_PATH = "/auth/signin";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function normalizePath(value: unknown) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("/")) {
    return DEFAULT_STUDENT_PORTAL_SIGNIN_PATH;
  }
  return trimmed;
}

export function getStudentPortalSignInPath() {
  if (typeof document === "undefined") {
    return DEFAULT_STUDENT_PORTAL_SIGNIN_PATH;
  }

  const rawCookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) =>
      entry.startsWith(`${STUDENT_PORTAL_SIGNIN_PATH_COOKIE}=`),
    );
  const value = rawCookie
    ? decodeURIComponent(
        rawCookie.slice(STUDENT_PORTAL_SIGNIN_PATH_COOKIE.length + 1),
      )
    : "";

  return normalizePath(value);
}

export function setStudentPortalSignInPath(value: string) {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedValue = normalizePath(value);
  document.cookie = `${STUDENT_PORTAL_SIGNIN_PATH_COOKIE}=${encodeURIComponent(
    normalizedValue,
  )}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}
