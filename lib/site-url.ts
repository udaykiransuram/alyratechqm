const DEFAULT_LOCAL_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function getConfiguredSiteUrl() {
  return (
    normalizeSiteUrl(process.env.NEXTAUTH_URL) ||
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    ""
  );
}

export function getConfiguredSiteOrigin() {
  return getConfiguredSiteUrl();
}

export function getSiteUrlOrFallback(
  fallback = DEFAULT_LOCAL_SITE_URL,
) {
  return getConfiguredSiteUrl() || fallback;
}

export function getSiteUrlConfigSource() {
  if (normalizeSiteUrl(process.env.NEXTAUTH_URL)) {
    return "NEXTAUTH_URL" as const;
  }

  if (normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)) {
    return "NEXT_PUBLIC_SITE_URL" as const;
  }

  return null;
}
