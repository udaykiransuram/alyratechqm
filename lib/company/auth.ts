const COMPANY_DEFAULT_CALLBACK_URL = "/company/schools";

function normalizeCompanyCallbackPath(path: string) {
  const normalizedPath = String(path || "").trim();

  if (!normalizedPath || !normalizedPath.startsWith("/")) {
    return COMPANY_DEFAULT_CALLBACK_URL;
  }

  if (normalizedPath.startsWith("//")) {
    return COMPANY_DEFAULT_CALLBACK_URL;
  }

  if (
    normalizedPath === "/manage" ||
    normalizedPath === "/manage/schools" ||
    normalizedPath.startsWith("/manage/schools?")
  ) {
    return COMPANY_DEFAULT_CALLBACK_URL;
  }

  if (normalizedPath === "/auth/company-signin") {
    return COMPANY_DEFAULT_CALLBACK_URL;
  }

  return normalizedPath;
}

export function resolveCompanyCallbackUrl(
  callbackUrl: string | null | undefined,
) {
  const raw = String(callbackUrl || "").trim();
  if (!raw) {
    return COMPANY_DEFAULT_CALLBACK_URL;
  }

  if (raw.startsWith("/")) {
    return normalizeCompanyCallbackPath(raw);
  }

  try {
    const url = new URL(raw);
    const normalizedPath = `${url.pathname}${url.search}${url.hash}`;
    return normalizeCompanyCallbackPath(normalizedPath);
  } catch {
    return COMPANY_DEFAULT_CALLBACK_URL;
  }
}

