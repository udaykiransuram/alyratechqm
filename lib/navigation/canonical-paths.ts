export const PUBLIC_PATH_PREFIXES = [
  "/platform-home",
  "/about",
  "/benefits",
  "/register",
  "/terms",
  "/success",
  "/contact",
  "/product",
  "/case-study",
  "/talent-test",
] as const;

export function matchesPathPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isHomePublicPathname(pathname: string) {
  return matchesPathPrefix(pathname, "/platform-home");
}

export function isPublicPathname(pathname: string) {
  return (
    pathname === "/" ||
    PUBLIC_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
  );
}

export function isAuthPathname(pathname: string) {
  return pathname === "/auth/signin" || pathname === "/auth/company-signin";
}

export function isStudentPathname(pathname: string) {
  return pathname === "/student" || pathname.startsWith("/student/");
}

export type AppChromeKind =
  | "home"
  | "public"
  | "auth"
  | "student"
  | "product";

export function resolveAppChromeKind(pathname: string): AppChromeKind {
  if (isHomePublicPathname(pathname)) {
    return "home";
  }

  if (isPublicPathname(pathname)) {
    return "public";
  }

  if (isAuthPathname(pathname)) {
    return "auth";
  }

  if (isStudentPathname(pathname)) {
    return "student";
  }

  return "product";
}

export function canonicalizePathname(pathname: string) {
  if (!pathname) return pathname;

  if (pathname === "/company") {
    return "/company/schools";
  }

  return pathname;
}

export function canonicalizeAppPath(path: string) {
  const input = String(path || "").trim();
  if (!input.startsWith("/") || input.startsWith("//")) {
    return input;
  }

  const [pathWithQuery, hashFragment = ""] = input.split("#");
  const [pathname, existingQuery = ""] = pathWithQuery.split("?");
  const canonicalPathname = canonicalizePathname(pathname || "/");

  return `${canonicalPathname}${existingQuery ? `?${existingQuery}` : ""}${hashFragment ? `#${hashFragment}` : ""}`;
}
