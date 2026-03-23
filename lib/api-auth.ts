import { getServerSession, type Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { AccountType, AppRole, SchoolUserRole } from "@/lib/auth-types";
import { getTenantModels } from "@/lib/db-tenant";
import {
  isRedisConfigured,
  readStudentSession,
  refreshStudentSessionIfMatch,
} from "@/lib/redis";
import {
  isStudentSessionFresh,
  shouldRefreshStudentSessionHeartbeat,
} from "@/lib/student-session";

type RequireTenantSessionOptions = {
  allowRoles?: SchoolUserRole[];
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

type RequireCompanyAdminSessionSuccess = {
  ok: true;
  session: Session;
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

function buildStudentSessionInvalidResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "StudentSessionExpired",
      message: "This student session is no longer active. Please sign in again.",
    },
    { status: 401 },
  );
}

async function validateStudentSession(session: Session, schoolKey: string) {
  const studentSessionId = String(session.user.studentSessionId || "").trim();
  if (!studentSessionId) {
    return buildStudentSessionInvalidResponse();
  }

  if (isRedisConfigured()) {
    try {
      const activeStudentSessionId = await readStudentSession(
        schoolKey,
        session.user.id,
      );

      if (activeStudentSessionId && activeStudentSessionId !== studentSessionId) {
        return buildStudentSessionInvalidResponse();
      }

      if (!activeStudentSessionId) {
        throw new Error("Redis student session missing or unavailable.");
      }

      const refreshed = await refreshStudentSessionIfMatch(
        schoolKey,
        session.user.id,
        studentSessionId,
      );

      if (refreshed === false) {
        return buildStudentSessionInvalidResponse();
      }

      const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
      await UserModel.updateOne(
        {
          _id: session.user.id,
          role: "student",
          activeStudentSessionId: studentSessionId,
        },
        {
          $set: {
            activeStudentSessionLastSeenAt: new Date(),
          },
        },
      ).catch(() => undefined);

      return null;
    } catch (error) {
      console.error(
        "Failed to validate Redis student session. Falling back to DB session validation:",
        error,
      );
    }
  }

  try {
    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const student = await UserModel.findById(session.user.id)
      .select("role +activeStudentSessionId +activeStudentSessionLastSeenAt")
      .lean();

    if (!student || student.role !== "student") {
      return buildStudentSessionInvalidResponse();
    }

    const activeStudentSessionId = String(
      student.activeStudentSessionId || "",
    ).trim();
    if (!activeStudentSessionId || activeStudentSessionId !== studentSessionId) {
      return buildStudentSessionInvalidResponse();
    }

    const now = new Date();
    if (!isStudentSessionFresh(student.activeStudentSessionLastSeenAt, now)) {
      await UserModel.updateOne(
        {
          _id: session.user.id,
          role: "student",
          activeStudentSessionId: studentSessionId,
        },
        {
          $unset: {
            activeStudentSessionId: 1,
            activeStudentSessionLastSeenAt: 1,
          },
        },
      ).catch(() => undefined);

      return buildStudentSessionInvalidResponse();
    }

    if (
      shouldRefreshStudentSessionHeartbeat(
        student.activeStudentSessionLastSeenAt,
        now,
      )
    ) {
      await UserModel.updateOne(
        {
          _id: session.user.id,
          role: "student",
          activeStudentSessionId: studentSessionId,
        },
        {
          $set: {
            activeStudentSessionLastSeenAt: now,
          },
        },
      ).catch(() => undefined);
    }

    return null;
  } catch (error) {
    console.error("Failed to validate student session:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to validate the active student session.",
      },
      { status: 500 },
    );
  }
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

  if (
    !session?.user?.id ||
    !session.user.role ||
    !session.user.accountType
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  if (session.user.accountType !== "school_user") {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "School workspace session required.",
        },
        { status: 403 },
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

  if (session.user.role === "student") {
    if (!resolvedSchoolKey) {
      return {
        ok: false as const,
        response: NextResponse.json(
          {
            success: false,
            message: "Student session is missing school context.",
          },
          { status: 403 },
        ),
      };
    }

    const invalidStudentSessionResponse = await validateStudentSession(
      session,
      resolvedSchoolKey,
    );

    if (invalidStudentSessionResponse) {
      return {
        ok: false as const,
        response: invalidStudentSessionResponse,
      };
    }
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

export async function requireCompanyAdminSession(
  _req: NextRequest,
): Promise<RequireCompanyAdminSessionSuccess | RequireTenantSessionFailure> {
  const session = await getServerSession(authOptions);

  if (
    !session?.user?.id ||
    session.user.accountType !== "company_admin" ||
    session.user.role !== "company_admin"
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Company admin authentication required." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}
