import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  getAuthConfigurationIssue,
  getNextAuthSecret,
} from "@/lib/auth-runtime";
import { isPublicPathname } from "@/lib/navigation/canonical-paths";
import {
  buildCounterpartUrl,
  classifyTrafficSurface,
  describeTrafficSurface,
  getAppServiceConfig,
  isTrafficSurfaceAllowed,
} from "@/lib/service-mode";
import { isMockedE2ETestMode } from "@/lib/test-mode";

type RateLimitStore = Map<string, number[]>;

function generateCspNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

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
  return isPublicPathname(path);
}

function isWorkspacePage(path: string) {
  return path === "/workspace" || path.startsWith("/workspace/");
}

function allowsAuthPageWithExistingSession(
  error: string | null,
) {
  return error === "Configuration" || error === "StudentSessionExpired";
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

function buildContentSecurityPolicy(path: string, nonce: string) {
  if (path.startsWith("/api/analytics/")) {
    return null;
  }

  const isDev = process.env.NODE_ENV !== "production";
  // Nonce-based script CSP only works cleanly when the whole app renders
  // dynamically and Next can attach the nonce to every framework/inline script.
  // This app still ships ISR/static routes, so production falls back to
  // same-origin + inline allowlisting until we can move fully to dynamic nonce
  // rendering or SRI-based CSP.
  const scriptSources = isDev
    ? [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "'wasm-unsafe-eval'",
        "blob:",
        "https://vercel.live",
        "https://sdk.cashfree.com",
      ].join(" ")
    : [
        "'self'",
        "'unsafe-inline'",
        "'wasm-unsafe-eval'",
        "https://vercel.live",
        "https://sdk.cashfree.com",
      ].join(" ");
  const connectSources = [
    "'self'",
    isDev ? "ws:" : "",
    isDev ? "wss:" : "",
    "https://vercel.live",
    "wss://vercel.live",
    "https://*.blob.vercel-storage.com",
    "https://*.public.blob.vercel-storage.com",
    "https://*.private.blob.vercel-storage.com",
    "https://api.cashfree.com",
    "https://sandbox.cashfree.com",
    "https://payments.cashfree.com",
    "https://payments-test.cashfree.com",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    `script-src-elem ${scriptSources}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://*.private.blob.vercel-storage.com",
    "media-src 'self' blob: https://videos.pexels.com https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://*.private.blob.vercel-storage.com",
    "worker-src 'self' blob:",
    `connect-src ${connectSources}`,
    "frame-src 'self' https://sdk.cashfree.com https://api.cashfree.com https://sandbox.cashfree.com https://payments.cashfree.com https://payments-test.cashfree.com https://www.youtube.com https://www.youtube-nocookie.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function applyResponseHeaders(
  res: NextResponse,
  cspHeader: string | null,
) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (cspHeader) {
    res.headers.set("Content-Security-Policy", cspHeader);
  }

  return res;
}

function applyServiceHeaders(
  res: NextResponse,
  params: {
    serviceMode: string;
    trafficSurface: string;
    counterpartOrigin?: string | null;
  },
) {
  res.headers.set("x-app-service-mode", params.serviceMode);
  res.headers.set("x-app-traffic-surface", params.trafficSurface);

  if (params.counterpartOrigin) {
    res.headers.set("x-app-counterpart-origin", params.counterpartOrigin);
  }

  return res;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname || "";
  const isDev = process.env.NODE_ENV !== "production";
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
  const shouldApplyCsp = !isApiRoute && !isStaticAsset;
  const cspNonce = shouldApplyCsp && !isDev ? generateCspNonce() : null;
  const cspHeader = cspNonce ? buildContentSecurityPolicy(path, cspNonce) : null;
  const serviceConfig = getAppServiceConfig();
  const trafficSurface = classifyTrafficSurface(path);
  const finalizeResponse = (
    res: NextResponse,
    counterpartOrigin?: string | null,
  ) =>
    applyResponseHeaders(
      applyServiceHeaders(res, {
        serviceMode: serviceConfig.mode,
        trafficSurface,
        counterpartOrigin,
      }),
      cspHeader,
    );

  const authSecret = getNextAuthSecret();
  const mockedE2ETestMode = isMockedE2ETestMode();
  const authConfigurationIssue =
    !mockedE2ETestMode &&
    process.env.NODE_ENV === "production" &&
    !isStaticAsset
      ? getAuthConfigurationIssue(req.nextUrl.origin)
      : null;

  if (
    !isStaticAsset &&
    !isTrafficSurfaceAllowed(serviceConfig.mode, trafficSurface)
  ) {
    const counterpartOrigin =
      trafficSurface === "student"
        ? serviceConfig.studentOrigin
        : trafficSurface === "staff"
          ? serviceConfig.staffOrigin
          : null;
    const redirectUrl =
      counterpartOrigin && counterpartOrigin !== req.nextUrl.origin
        ? buildCounterpartUrl(
            counterpartOrigin,
            req.nextUrl.pathname,
            req.nextUrl.search,
          )
        : null;
    const surfaceLabel = describeTrafficSurface(trafficSurface);
    const modeLabel =
      serviceConfig.mode === "student" ? "student" : "staff/admin";
    const message = redirectUrl
      ? `This ${modeLabel} deployment cannot serve ${surfaceLabel} traffic here. Retry against the paired ${surfaceLabel} deployment.`
      : `This deployment only serves ${modeLabel} traffic. ${surfaceLabel} requests require a paired deployment.`;

    if (redirectUrl && !isApiRoute && ["GET", "HEAD"].includes(req.method)) {
      return finalizeResponse(
        NextResponse.redirect(redirectUrl, 307),
        counterpartOrigin,
      );
    }

    return finalizeResponse(
      isApiRoute
        ? NextResponse.json(
            {
              success: false,
              message,
              ...(redirectUrl ? { redirectUrl } : {}),
            },
            { status: redirectUrl ? 421 : 503 },
          )
        : new NextResponse(message, {
            status: redirectUrl ? 421 : 503,
          }),
      counterpartOrigin,
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    authConfigurationIssue &&
    !isStaticAsset &&
    !isApiRoute
  ) {
    if (isPublicRoute || !isProtectedRoute) {
      return finalizeResponse(NextResponse.next());
    }

    if (
      isAuthRoute &&
      allowsAuthPageWithExistingSession(
        req.nextUrl.searchParams.get("error"),
      )
    ) {
      return finalizeResponse(NextResponse.next());
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
    return finalizeResponse(NextResponse.redirect(signInUrl));
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
      return finalizeResponse(NextResponse.redirect(signInUrl));
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
          )
        ) {
          return finalizeResponse(NextResponse.next());
        }

        return finalizeResponse(
          NextResponse.redirect(new URL(defaultPath, req.url)),
        );
      }

      if (isCompanyRoute && !isCompanyAdmin) {
        return finalizeResponse(
          NextResponse.redirect(new URL(defaultPath, req.url)),
        );
      }

      if (isStudentRoute && !isStudent) {
        return finalizeResponse(
          NextResponse.redirect(new URL(defaultPath, req.url)),
        );
      }

      if (isSchoolWorkspaceRoute && (isCompanyAdmin || isStudent)) {
        return finalizeResponse(
          NextResponse.redirect(new URL(defaultPath, req.url)),
        );
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
  headers.set("x-app-service-mode", serviceConfig.mode);
  headers.set("x-app-traffic-surface", trafficSurface);
  if (cspHeader) {
    headers.set("Content-Security-Policy", cspHeader);
    headers.set("x-nonce", cspNonce || "");
  }

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
        return finalizeResponse(
          buildRateLimitResponse(authRateLimit.retryAfterSeconds),
        );
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
        return finalizeResponse(
          buildRateLimitResponse(analyticsRateLimit.retryAfterSeconds),
        );
      }
    }
  } catch {}

  return finalizeResponse(NextResponse.next({ request: { headers } }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
