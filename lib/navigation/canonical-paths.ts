const PUBLIC_PATH_PREFIXES = [
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

export function isPublicPathname(pathname: string) {
  return (
    pathname === "/" ||
    PUBLIC_PATH_PREFIXES.some((prefix) => matchesPathPrefix(pathname, prefix))
  );
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
