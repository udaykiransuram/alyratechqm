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

function normalizeHostnameForSiteMatch(hostname: string) {
  const normalized = String(hostname || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return normalized.startsWith("www.")
    ? normalized.slice(4)
    : normalized;
}

function parseNormalizedOrigin(value: string | null | undefined) {
  const origin = normalizeSiteUrl(value);
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

function getComparablePort(url: URL) {
  if (url.port) {
    return url.port;
  }

  return url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "";
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

export function getConfiguredSiteOrigins() {
  return Array.from(
    new Set(
      [process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_SITE_URL]
        .map((value) => normalizeSiteUrl(value))
        .filter(Boolean),
    ),
  );
}

export function isEquivalentSiteOrigin(
  leftOrigin: string | null | undefined,
  rightOrigin: string | null | undefined,
) {
  const leftUrl = parseNormalizedOrigin(leftOrigin);
  const rightUrl = parseNormalizedOrigin(rightOrigin);

  if (!leftUrl || !rightUrl) {
    return false;
  }

  if (leftUrl.origin === rightUrl.origin) {
    return true;
  }

  return (
    leftUrl.protocol === rightUrl.protocol &&
    getComparablePort(leftUrl) === getComparablePort(rightUrl) &&
    normalizeHostnameForSiteMatch(leftUrl.hostname) ===
      normalizeHostnameForSiteMatch(rightUrl.hostname)
  );
}

export function isAllowedConfiguredSiteOrigin(
  candidateOrigin: string | null | undefined,
) {
  const configuredOrigins = getConfiguredSiteOrigins();
  if (!configuredOrigins.length) {
    return false;
  }

  return configuredOrigins.some((configuredOrigin) =>
    isEquivalentSiteOrigin(candidateOrigin, configuredOrigin),
  );
}

export function isAllowedConfiguredSiteUrl(
  candidateUrl: string | null | undefined,
  fallbackBaseUrl?: string | null,
) {
  const rawCandidate = String(candidateUrl || "").trim();
  if (!rawCandidate) {
    return false;
  }

  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(rawCandidate);
  } catch {
    return false;
  }

  const allowedOrigins = [
    ...getConfiguredSiteOrigins(),
    normalizeSiteUrl(fallbackBaseUrl),
  ].filter(Boolean);

  return allowedOrigins.some((allowedOrigin) =>
    isEquivalentSiteOrigin(resolvedUrl.origin, allowedOrigin),
  );
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
