export function getNextAuthSecret() {
  const secret = String(
    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "",
  ).trim();

  return secret || undefined;
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
    return "Authentication is not configured on this deployment yet. Set NEXTAUTH_SECRET and make sure NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL match this site before redeploying.";
  }

  if (normalizedError === "CredentialsSignin") {
    return context === "company"
      ? "Company admin sign in failed. Please check your email and password."
      : "Sign in failed. Please check your school key, username, and password.";
  }

  return normalizedError;
}
