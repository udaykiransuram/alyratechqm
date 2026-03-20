import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isSchoolSignInRoute(path: string) {
  return path === "/auth/signin";
}

function isCompanySignInRoute(path: string) {
  return path === "/auth/company-signin";
}

function isCompanyPage(path: string) {
  return (
    path === "/manage/schools" ||
    path.startsWith("/manage/schools/") ||
    path === "/manage/admin/indexing" ||
    path.startsWith("/manage/admin/indexing/")
  );
}

function isStudentPage(path: string) {
  return path === "/student" || path.startsWith("/student/");
}

function resolveTokenAccountType(token: any) {
  if (token?.accountType === "company_admin") return "company_admin";
  if (token?.accountType === "school_user") return "school_user";
  return token?.role === "company_admin" ? "company_admin" : "school_user";
}

function resolveDefaultPath(token: any) {
  const role = String(token?.role || "").trim();
  if (role === "company_admin") return "/manage/schools";
  if (role === "student") return "/student/tests";
  return "/";
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname || "";
  const isApiRoute = path.startsWith("/api/");
  const isAuthRoute = isSchoolSignInRoute(path) || isCompanySignInRoute(path);
  const isStaticAsset =
    path.startsWith("/_next/") ||
    path.startsWith("/images/") ||
    path.startsWith("/fonts/") ||
    path.startsWith("/public/") ||
    /\.[a-zA-Z0-9]+$/.test(path);

  const token = isStaticAsset
    ? null
    : await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });

  if (!isApiRoute && !isStaticAsset) {
    const isCompanyRoute = isCompanyPage(path);
    const isStudentRoute = isStudentPage(path);
    const isSchoolWorkspaceRoute =
      !isAuthRoute && !isCompanyRoute && !isStudentRoute;

    if (!token && !isAuthRoute) {
      const signInPath = isCompanyRoute
        ? "/auth/company-signin"
        : "/auth/signin";
      const signInUrl = new URL(signInPath, req.url);
      signInUrl.searchParams.set("callbackUrl", req.url);
      return NextResponse.redirect(signInUrl);
    }

    if (token) {
      const accountType = resolveTokenAccountType(token);
      const defaultPath = resolveDefaultPath(token);
      const isCompanyAdmin = accountType === "company_admin";
      const isStudent =
        accountType === "school_user" && String(token?.role || "") === "student";

      if (isAuthRoute) {
        return NextResponse.redirect(new URL(defaultPath, req.url));
      }

      if (isCompanyRoute && !isCompanyAdmin) {
        return NextResponse.redirect(new URL(defaultPath, req.url));
      }

      if (isStudentRoute && !isStudent) {
        return NextResponse.redirect(new URL(defaultPath, req.url));
      }

      if (isSchoolWorkspaceRoute && (isCompanyAdmin || isStudent)) {
        return NextResponse.redirect(new URL(defaultPath, req.url));
      }
    }
  }

  const schoolKey =
    req.cookies.get("schoolKey")?.value ||
    (resolveTokenAccountType(token) === "school_user"
      ? String(token?.schoolKey || "").trim()
      : "");
  const headers = new Headers(req.headers);
  if (schoolKey) {
    headers.set("X-School-Key", schoolKey);
  }
  // Simple in-memory rate limiter for analytics APIs (best-effort; not durable across serverless instances)
  try {
    const shouldRateLimit =
      path.startsWith("/api/analytics/") || path.startsWith("/api/reports/");
    if (shouldRateLimit) {
      // 60 requests per 60s per (ip+schoolKey+route)
      const keyIp = (
        req.ip ||
        req.headers.get("x-forwarded-for") ||
        "unknown"
      ).toString();
      const rlKey = `${keyIp}|${schoolKey || "no-school"}|${path}`;
      const now = Date.now();
      const windowMs = 60_000;
      const max = 60;
      // @ts-ignore
      const store: Map<string, number[]> = (globalThis.__rateLimitStore ||=
        new Map());
      const arr = store.get(rlKey) || [];
      const recent = arr.filter((ts) => now - ts < windowMs);
      if (recent.length >= max) {
        return new NextResponse("Too Many Requests", {
          status: 429,
          headers: new Headers({ "Retry-After": "60" }),
        });
      }
      recent.push(now);
      store.set(rlKey, recent);
    }
  } catch {}
  const res = NextResponse.next({ request: { headers } });
  // Basic security headers
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.headers.set("Referrer-Policy", "no-referrer");
  if (!path.startsWith("/api/analytics/")) {
    const isDev = process.env.NODE_ENV !== "production";
    const csp = [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    res.headers.set("Content-Security-Policy", csp);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
