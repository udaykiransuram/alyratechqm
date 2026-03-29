import { getConfiguredSiteOrigin } from "@/lib/site-url";

const DEFAULT_LOCAL_ORIGIN = "http://localhost:3000";

function normalizeOrigin(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function getTrustedInternalOrigin() {
  const explicit = normalizeOrigin(
    process.env.INTERNAL_API_BASE_URL || process.env.INTERNAL_API_ORIGIN,
  );
  if (explicit) {
    return explicit;
  }

  const configured = normalizeOrigin(getConfiguredSiteOrigin());
  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing INTERNAL_API_BASE_URL (or NEXTAUTH_URL) for internal server calls.",
    );
  }

  return DEFAULT_LOCAL_ORIGIN;
}
