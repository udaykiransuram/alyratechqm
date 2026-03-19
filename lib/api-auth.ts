import { getServerSession, type Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export type AppRole = "admin" | "teacher" | "student";

type RequireTenantSessionOptions = {
  allowRoles?: AppRole[];
  allowSchoolQueryFallback?: boolean;
  requireSchoolKey?: boolean;
};

type RequireTenantSessionFailure = {
  ok: false;
  response: NextResponse;
};

type RequireTenantSessionSuccess = {
  ok: true;
  session: Session;
  schoolKey: string;
};

type RequireTenantSessionSuccessWithoutSchoolKey = {
  ok: true;
  session: Session;
  schoolKey: string | undefined;
};

function extractRequestedSchoolKey(
  req: NextRequest,
  allowSchoolQueryFallback = false,
) {
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromCookie = req.cookies.get("schoolKey")?.value;
  const schoolFromQuery = allowSchoolQueryFallback
    ? req.nextUrl.searchParams.get("school")
    : null;

  return (schoolFromHeader || schoolFromCookie || schoolFromQuery || "")
    .toString()
    .trim();
}

function normalizeSchoolKey(value: unknown) {
  return String(value || "").trim();
}

export async function requireTenantSession(
  req: NextRequest,
  options?: RequireTenantSessionOptions & { requireSchoolKey?: true },
): Promise<RequireTenantSessionSuccess | RequireTenantSessionFailure>;
export async function requireTenantSession(
  req: NextRequest,
  options: RequireTenantSessionOptions & { requireSchoolKey: false },
): Promise<
  RequireTenantSessionSuccessWithoutSchoolKey | RequireTenantSessionFailure
>;
export async function requireTenantSession(
  req: NextRequest,
  options?: RequireTenantSessionOptions,
): Promise<
  | RequireTenantSessionSuccess
  | RequireTenantSessionSuccessWithoutSchoolKey
  | RequireTenantSessionFailure
> {
  const resolvedOptions = options ?? {};
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.role) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const requestedSchoolKey = extractRequestedSchoolKey(
    req,
    resolvedOptions.allowSchoolQueryFallback,
  );

  const sessionSchoolKey = normalizeSchoolKey(session.user.schoolKey);

  if (resolvedOptions.requireSchoolKey !== false && !sessionSchoolKey) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Authenticated session is missing school context.",
        },
        { status: 403 },
      ),
    };
  }

  if (
    requestedSchoolKey &&
    sessionSchoolKey &&
    requestedSchoolKey !== sessionSchoolKey
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Tenant mismatch for authenticated session.",
        },
        { status: 403 },
      ),
    };
  }

  const resolvedSchoolKey = sessionSchoolKey || requestedSchoolKey || undefined;

  if (resolvedOptions.requireSchoolKey !== false && !resolvedSchoolKey) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "schoolKey required" },
        { status: 400 },
      ),
    };
  }

  const allowedRoles = resolvedOptions.allowRoles || [];
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 },
      ),
    };
  }

  if (resolvedOptions.requireSchoolKey === false) {
    return {
      ok: true as const,
      session,
      schoolKey: resolvedSchoolKey,
    };
  }

  return {
    ok: true as const,
    session,
    schoolKey: resolvedSchoolKey,
  };
}
