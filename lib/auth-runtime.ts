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
      ? "Company admin sign in failed. Please check your email and password."
      : "Sign in failed. Please check your selected school, username, and password.";
  }

  if (normalizedError === "SchoolNotFound") {
    return "The selected school could not be found. Please choose your school again.";
  }

  if (normalizedError === "StudentRollNumberNotFound") {
    return "No active student account matched that roll number in the selected school.";
  }

  if (normalizedError === "StudentDuplicateRollNumber") {
    return "Multiple students share this roll number. Please contact your school admin.";
  }

  if (normalizedError === "StudentSignInFailed") {
    return "Student sign in failed. Use the roll number as the username. The default password matches the roll number until it is changed.";
  }

  if (normalizedError === "StudentPasswordNotProvisioned") {
    return "This student account does not have a stored password yet. Reset student passwords to their roll numbers, then try signing in again.";
  }

  if (normalizedError === "StudentAlreadySignedIn") {
    return "This student is already signed in on another device. Sign out there first or wait a few minutes for the previous session to expire.";
  }

  if (normalizedError === "StudentSessionExpired") {
    return "Your student session ended. Please sign in again.";
  }

  if (normalizedError === "StudentSignInRateLimited") {
    return "Too many student login attempts were made. Please wait a few minutes and try again.";
  }

  return normalizedError;
}
