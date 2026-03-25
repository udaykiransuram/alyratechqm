import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  getAuthConfigurationIssue,
  getNextAuthSecret,
} from "@/lib/auth-runtime";

type RateLimitStore = Map<string, number[]>;

function resolvePositiveIntegerEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name] || "");
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

const AUTH_CALLBACK_RATE_LIMIT_WINDOW_MS = resolvePositiveIntegerEnv(
  "AUTH_CALLBACK_RATE_LIMIT_WINDOW_MS",
  10 * 60_000,
);
const COMPANY_ADMIN_AUTH_CALLBACK_RATE_LIMIT_MAX = resolvePositiveIntegerEnv(
  "COMPANY_ADMIN_AUTH_CALLBACK_RATE_LIMIT_MAX",
  10,
);
const SCHOOL_USER_AUTH_CALLBACK_RATE_LIMIT_MAX = resolvePositiveIntegerEnv(
  "SCHOOL_USER_AUTH_CALLBACK_RATE_LIMIT_MAX",
  250,
);

function isSchoolSignInRoute(path: string) {
  return path === "/auth/signin";
}

function isCompanySignInRoute(path: string) {
  return path === "/auth/company-signin";
}

function resolveAuthCallbackRateLimitMax(path: string) {
  if (path === "/api/auth/callback/school-user") {
    return SCHOOL_USER_AUTH_CALLBACK_RATE_LIMIT_MAX;
  }

  if (path === "/api/auth/callback/company-admin") {
    return COMPANY_ADMIN_AUTH_CALLBACK_RATE_LIMIT_MAX;
  }

  return COMPANY_ADMIN_AUTH_CALLBACK_RATE_LIMIT_MAX;
}

function isCompanyPage(path: string) {
  return path === "/company" || path.startsWith("/company/");
}

function isStudentPage(path: string) {
  return path === "/student" || path.startsWith("/student/");
}

function isPublicPage(path: string) {
  return (
    path === "/" ||
    path === "/about" ||
    path.startsWith("/about/") ||
    path === "/benefits" ||
    path.startsWith("/benefits/") ||
    path === "/talent-test" ||
    path.startsWith("/talent-test/") ||
    path === "/register" ||
    path.startsWith("/register/") ||
    path === "/terms" ||
    path.startsWith("/terms/") ||
    path === "/success" ||
    path.startsWith("/success/") ||
    path === "/contact" ||
    path.startsWith("/contact/") ||
    path === "/product" ||
    path.startsWith("/product/") ||
    path === "/case-study" ||
    path.startsWith("/case-study/")
  );
}

function isWorkspacePage(path: string) {
  return path === "/workspace" || path.startsWith("/workspace/");
}

function allowsAuthPageWithExistingSession(
  error: string | null,
  signedOut: string | null,
) {
  return (
    error === "Configuration" ||
    error === "StudentSessionExpired" ||
    signedOut === "1"
  );
}

function resolveTokenAccountType(token: any) {
  if (token?.accountType === "company_admin") return "company_admin";
  if (token?.accountType === "school_user") return "school_user";
  return token?.role === "company_admin" ? "company_admin" : "school_user";
}

function resolveDefaultPath(token: any) {
  const role = String(token?.role || "").trim();
  if (role === "company_admin") return "/company/schools";
  if (role === "student") return "/student/tests";
  return "/workspace";
}

function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  return String(realIp || forwardedFor || "unknown")
    .split(",")[0]
    .trim();
}

function getRateLimitStore() {
  const globalState = globalThis as typeof globalThis & {
    __rateLimitStore?: RateLimitStore;
  };

  if (!globalState.__rateLimitStore) {
    globalState.__rateLimitStore = new Map();
  }

  return globalState.__rateLimitStore;
}

function consumeRateLimit({
  key,
  max,
  windowMs,
  now = Date.now(),
}: {
  key: string;
  max: number;
  windowMs: number;
  now?: number;
}) {
  const store = getRateLimitStore();
  const recentHits = (store.get(key) || []).filter((ts) => now - ts < windowMs);

  if (recentHits.length >= max) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((windowMs - (now - recentHits[0])) / 1000),
    );
    store.set(key, recentHits);
    return {
      limited: true,
      retryAfterSeconds,
    };
  }

  recentHits.push(now);
  store.set(key, recentHits);
  return {
    limited: false,
    retryAfterSeconds: 0,
  };
}

function buildRateLimitResponse(retryAfterSeconds: number) {
  return new NextResponse("Too Many Requests", {
    status: 429,
    headers: new Headers({
      "Retry-After": String(retryAfterSeconds),
    }),
  });
}

function applyResponseHeaders(res: NextResponse, path: string) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.headers.set("Referrer-Policy", "no-referrer");

  if (!path.startsWith("/api/analytics/")) {
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://sdk.cashfree.com"
      : "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://sdk.cashfree.com";
    const connectSrc = isDev
      ? "connect-src 'self' ws: wss: https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com"
      : "connect-src 'self' https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com";
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob: https://videos.pexels.com",
      "worker-src 'self' blob:",
      connectSrc,
      "frame-src 'self' https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    res.headers.set("Content-Security-Policy", csp);
  }

  return res;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname || "";
  const isApiRoute = path.startsWith("/api/");
  const isAuthRoute = isSchoolSignInRoute(path) || isCompanySignInRoute(path);
  const isPublicRoute = isPublicPage(path);
  const isCompanyRoute = isCompanyPage(path);
  const isStudentRoute = isStudentPage(path);
  const isWorkspaceRoute = isWorkspacePage(path);
  const isProtectedRoute = isWorkspaceRoute || isCompanyRoute || isStudentRoute;
  const isStaticAsset =
    path.startsWith("/_next/") ||
    path.startsWith("/images/") ||
    path.startsWith("/fonts/") ||
    path.startsWith("/public/") ||
    /\.[a-zA-Z0-9]+$/.test(path);


  const authSecret = getNextAuthSecret();
  const authConfigurationIssue =
    process.env.NODE_ENV === "production" && !isStaticAsset
      ? getAuthConfigurationIssue(req.nextUrl.origin)
      : null;

  if (
    process.env.NODE_ENV === "production" &&
    authConfigurationIssue &&
    !isStaticAsset &&
    !isApiRoute
  ) {
    if (isPublicRoute || !isProtectedRoute) {
      return NextResponse.next();
    }

    if (
      isAuthRoute &&
      allowsAuthPageWithExistingSession(
        req.nextUrl.searchParams.get("error"),
        req.nextUrl.searchParams.get("signedOut"),
      )
    ) {
      return NextResponse.next();
    }

    const signInUrl = req.nextUrl.clone();
    if (!isAuthRoute) {
      signInUrl.pathname = isCompanyRoute
        ? "/auth/company-signin"
        : "/auth/signin";
      signInUrl.search = "";
      signInUrl.searchParams.set("callbackUrl", req.url);
    }
    signInUrl.searchParams.set("error", "Configuration");
    return NextResponse.redirect(signInUrl);
  }

  const token =
    isStaticAsset || !authSecret
      ? null
      : await getToken({
          req,
          secret: authSecret,
        });

  if (!isApiRoute && !isStaticAsset) {
    const isSchoolWorkspaceRoute = isWorkspaceRoute;

    if (!token && !isAuthRoute && isProtectedRoute) {
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
        if (
          allowsAuthPageWithExistingSession(
            req.nextUrl.searchParams.get("error"),
            req.nextUrl.searchParams.get("signedOut"),
          )
        ) {
          return NextResponse.next();
        }

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
    const requestIp = getClientIp(req);
    const isAuthCallbackRequest =
      req.method === "POST" && path.startsWith("/api/auth/callback/");

    if (process.env.NODE_ENV === "production" && isAuthCallbackRequest) {
      const authCallbackRateLimitMax = resolveAuthCallbackRateLimitMax(path);
      const authRateLimit = consumeRateLimit({
        key: `${requestIp}|auth|${path}`,
        max: authCallbackRateLimitMax,
        windowMs: AUTH_CALLBACK_RATE_LIMIT_WINDOW_MS,
      });

      if (authRateLimit.limited) {
        return buildRateLimitResponse(authRateLimit.retryAfterSeconds);
      }
    }

    const shouldRateLimit =
      path.startsWith("/api/analytics/") || path.startsWith("/api/reports/");
    if (shouldRateLimit) {
      const analyticsRateLimit = consumeRateLimit({
        key: `${requestIp}|${schoolKey || "no-school"}|${path}`,
        max: 60,
        windowMs: 60_000,
      });

      if (analyticsRateLimit.limited) {
        return buildRateLimitResponse(analyticsRateLimit.retryAfterSeconds);
      }
    }
  } catch {}
  return applyResponseHeaders(
    NextResponse.next({ request: { headers } }),
    path,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
