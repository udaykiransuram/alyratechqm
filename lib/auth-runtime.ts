import { getConfiguredSiteOrigin } from "@/lib/site-url";

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

  const configuredOrigin = normalizeOrigin(getConfiguredSiteOrigin());
  if (!configuredOrigin) {
    return "missing_site_url" as const;
  }

  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (
    normalizedRequestOrigin &&
    normalizedRequestOrigin !== configuredOrigin
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
    return "Authentication is not configured correctly on this deployment yet. Set NEXTAUTH_SECRET and configure NEXTAUTH_URL for this exact site before redeploying. NEXT_PUBLIC_SITE_URL is optional and can match the same value if you still use it.";
  }

  if (normalizedError === "CredentialsSignin") {
    return context === "company"
      ? "We couldn't sign you in to the company admin workspace. Check your email and password and try again."
      : "We couldn't sign you in. Check your selected school, username, and password and try again.";
  }

  if (normalizedError === "Callback" || normalizedError === "AccessDenied") {
    return context === "company"
      ? "Company admin sign in could not be completed. Please try again."
      : "Sign in could not be completed. Please try again.";
  }

  if (normalizedError === "SchoolNotFound") {
    return "The selected school is no longer available. Choose your school again and try signing in once more.";
  }

  if (normalizedError === "StudentRollNumberNotFound") {
    return "No active student account was found for that roll number in the selected school.";
  }

  if (normalizedError === "StudentDuplicateRollNumber") {
    return "Multiple students share this roll number. Please contact your school admin.";
  }

  if (normalizedError === "StudentSignInFailed") {
    return "We couldn't sign in with that roll number and password. If this is your first login, try using the saved phone-number digits exactly as stored (including country code digits, if saved).";
  }

  if (normalizedError === "StudentPasswordNotProvisioned") {
    return "This student account does not have a password yet. Ask your school admin to reset it to the saved phone-number digits (including country code digits, if saved), then try again.";
  }

  if (normalizedError === "StudentAlreadySignedIn") {
    return "This student account is already active on another device or browser. Sign out there first, or wait a few minutes and try again.";
  }

  if (normalizedError === "StudentSessionExpired") {
    return "Your student session ended. Please sign in again.";
  }

  if (normalizedError === "StudentSignInRateLimited") {
    return "Too many student login attempts were made. Please wait a few minutes and try again.";
  }

  return context === "company"
    ? "Company admin sign in could not be completed. Please try again."
    : "Sign in could not be completed. Please try again.";
}
