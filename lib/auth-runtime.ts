export function getNextAuthSecret() {
  const secret = String(
    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "",
  ).trim();

  return secret || undefined;
}

function normalizeOrigin(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
}

export function getAuthConfigurationIssue(requestOrigin?: string) {
  if (!getNextAuthSecret()) {
    return "missing_secret" as const;
  }

  const nextAuthOrigin = normalizeOrigin(process.env.NEXTAUTH_URL);
  if (!nextAuthOrigin) {
    return "missing_nextauth_url" as const;
  }

  const publicSiteOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!publicSiteOrigin) {
    return "missing_public_site_url" as const;
  }

  if (nextAuthOrigin !== publicSiteOrigin) {
    return "configured_origin_mismatch" as const;
  }

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (
    normalizedRequestOrigin &&
    normalizedRequestOrigin !== nextAuthOrigin
  ) {
    return "request_origin_mismatch" as const;
  }

  return null;
}

export function getAuthErrorMessage(
  error: string | null | undefined,
  context: "school" | "company" = "school",
) {
  const normalizedError = String(error || "").trim();
  if (!normalizedError) {
    return "";
  }

  if (normalizedError === "Configuration") {
    return "Authentication is not configured correctly on this deployment yet. Set NEXTAUTH_SECRET and make sure NEXTAUTH_URL plus NEXT_PUBLIC_SITE_URL both point to this exact site before redeploying.";
  }

  if (normalizedError === "CredentialsSignin") {
    return context === "company"
      ? "Company admin sign in failed. Please check your email and password."
      : "Sign in failed. Please check your selected school, username, and password.";
  }

  return normalizedError;
}
