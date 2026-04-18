export function isStudentTestDetailPath(pathname?: string | null) {
  const normalizedPath = String(pathname || "").trim();

  return /^\/student\/tests\/[^/]+$/.test(normalizedPath);
}

export function isStudentReportDetailPath(pathname?: string | null) {
  const normalizedPath = String(pathname || "").trim();

  return /^\/student\/reports\/[^/]+(?:\/questions\/[^/]+)?$/.test(
    normalizedPath,
  );
}

export function isSummerCrashFlowPath(pathname?: string | null) {
  const normalizedPath = String(pathname || "").trim();

  return /^\/student\/crash-course(?:\/.*)?$/.test(normalizedPath);
}

export function shouldHideStudentChrome(pathname?: string | null) {
  return (
    isStudentTestDetailPath(pathname) ||
    isStudentReportDetailPath(pathname) ||
    isSummerCrashFlowPath(pathname)
  );
}
