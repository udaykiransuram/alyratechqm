import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const schoolKey = req.cookies.get("schoolKey")?.value;
  const headers = new Headers(req.headers);
  if (schoolKey) {
    headers.set("X-School-Key", schoolKey);
  }
  // Simple in-memory rate limiter for analytics APIs (best-effort; not durable across serverless instances)
  try {
    const path = req.nextUrl.pathname || "";
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
  const path = req.nextUrl.pathname || "";
  if (!path.startsWith("/api/analytics/")) {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");
    res.headers.set("Content-Security-Policy", csp);
  }
  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
