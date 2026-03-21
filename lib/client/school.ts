// lib/client/school.ts
// Small client-side helpers for tenant-aware API calls

const SCHOOL_KEY_COOKIE = "schoolKey";
const SCHOOL_DISPLAY_NAME_COOKIE = "schoolDisplayName";

function getCookieValue(name: string): string {
  try {
    const m = document.cookie.match(
      new RegExp(`(?:^|; )${name}=([^;]+)`),
    );
    return m && m[1] ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function setCookieValue(name: string, value: string, maxAgeSeconds = 31536000): void {
  try {
    const trimmedValue = String(value || "").trim();
    document.cookie = `${name}=${encodeURIComponent(trimmedValue)}; path=/; max-age=${maxAgeSeconds}`;
  } catch {
  }
}

function clearCookieValue(name: string): void {
  try {
    document.cookie = `${name}=; path=/; max-age=0`;
  } catch {
  }
}

export function getSchoolKeyFromCookie(): string {
  return getCookieValue(SCHOOL_KEY_COOKIE);
}

export function getSchoolDisplayNameFromCookie(): string {
  return getCookieValue(SCHOOL_DISPLAY_NAME_COOKIE);
}

// Append ?school= or &school= to a URL if a tenant key is available
export function withSchool(url: string, schoolKey?: string): string {
  const sk = schoolKey ?? getSchoolKeyFromCookie();
  if (!sk) return url;
  const hasQuery = url.includes("?");
  const sep = hasQuery ? "&" : "?";
  return `${url}${sep}school=${encodeURIComponent(sk)}`;
}

// Merge X-School-Key header for redundancy
export function withSchoolHeaders(
  init?: RequestInit,
  schoolKey?: string,
): RequestInit {
  const sk = schoolKey ?? getSchoolKeyFromCookie();
  if (!sk) return init || {};
  const base = init || {};
  return {
    ...base,
    headers: {
      ...(base.headers || {}),
      "X-School-Key": sk,
    },
  };
}


export function resolveSchoolKey(schoolKey?: string | null): string {
  return String(schoolKey ?? getSchoolKeyFromCookie() ?? '').trim();
}


export function setSchoolKeyCookie(
  schoolKey: string,
  maxAgeSeconds = 31536000,
): void {
  setCookieValue(SCHOOL_KEY_COOKIE, schoolKey, maxAgeSeconds);
}

export function setSchoolDisplayNameCookie(
  displayName: string,
  maxAgeSeconds = 31536000,
): void {
  const trimmedDisplayName = String(displayName || "").trim();
  if (!trimmedDisplayName) {
    clearCookieValue(SCHOOL_DISPLAY_NAME_COOKIE);
    return;
  }
  setCookieValue(SCHOOL_DISPLAY_NAME_COOKIE, trimmedDisplayName, maxAgeSeconds);
}

export function setSchoolSelectionCookies(
  schoolKey: string,
  displayName?: string,
  maxAgeSeconds = 31536000,
): void {
  setSchoolKeyCookie(schoolKey, maxAgeSeconds);
  if (String(displayName || "").trim()) {
    setSchoolDisplayNameCookie(displayName || "", maxAgeSeconds);
    return;
  }
  clearCookieValue(SCHOOL_DISPLAY_NAME_COOKIE);
}

export function clearSchoolKeyCookie(): void {
  clearCookieValue(SCHOOL_KEY_COOKIE);
  clearCookieValue(SCHOOL_DISPLAY_NAME_COOKIE);
}
