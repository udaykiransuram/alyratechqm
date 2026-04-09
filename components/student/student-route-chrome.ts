export function isStudentTestDetailPath(pathname?: string | null) {
  const normalizedPath = String(pathname || "").trim();

  return /^\/student\/tests\/[^/]+$/.test(normalizedPath);
}

export function shouldHideStudentChrome(pathname?: string | null) {
  return isStudentTestDetailPath(pathname);
}
