// lib/client/school.ts
// Small client-side helpers for tenant-aware API calls

export function getSchoolKeyFromCookie(): string {
  try {
    const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
    return m && m[1] ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
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
