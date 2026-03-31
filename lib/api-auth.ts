import { getServerSession, type Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { AccountType, AppRole, SchoolUserRole } from "@/lib/auth-types";
import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  isRedisConfigured,
  validateAndRefreshStudentSession,
} from "@/lib/redis";
import {
  isStudentSessionFresh,
  shouldRefreshStudentSessionHeartbeat,
} from "@/lib/student-session";
import {
  clearStudentSessionRecentRedisValidation,
  hasRecentlyValidatedStudentSessionViaRedis,
  invalidateStudentSessionValidationCache,
  markRedisValidatedStudentSessionDbSynced,
  markStudentSessionRecentlyValidatedViaRedis,
  shouldSyncRedisValidatedStudentSessionToDb,
} from "@/lib/student-session-cache";
import { isMockedE2ETestMode } from "@/lib/test-mode";
import CompanyAdmin from "@/models/CompanyAdmin";

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

function buildPrivilegedSessionInvalidResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "SessionInvalidated",
      message:
        "Your access permissions changed. Please sign in again to continue.",
    },
    { status: 401 },
  );
}

async function validatePrivilegedSchoolUserSession(
  session: Session,
  schoolKey: string,
) {
  if (isMockedE2ETestMode()) {
    return null;
  }

  try {
    await connectDB();
    const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
    const user = await UserModel.findOne({
      _id: session.user.id,
      ...buildArchiveFilter(false),
    })
      .select("role")
      .lean();

    if (!user) {
      return buildPrivilegedSessionInvalidResponse();
    }

    const persistedRole = String((user as { role?: unknown })?.role || "").trim();
    if (!persistedRole || persistedRole !== String(session.user.role || "")) {
      return buildPrivilegedSessionInvalidResponse();
    }

    return null;
  } catch (error) {
    console.error("Failed to validate privileged school session:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to validate active session permissions.",
      },
      { status: 500 },
    );
  }
}

async function validateStudentSession(session: Session, schoolKey: string) {
  const studentSessionId = String(session.user.studentSessionId || "").trim();
  if (!studentSessionId) {
    return buildStudentSessionInvalidResponse();
  }

  if (isMockedE2ETestMode()) {
    return null;
  }

  const now = new Date();

  if (isRedisConfigured()) {
    try {
      if (
        hasRecentlyValidatedStudentSessionViaRedis(
          schoolKey,
          session.user.id,
          studentSessionId,
          now,
        )
      ) {
        if (
          shouldSyncRedisValidatedStudentSessionToDb(
            schoolKey,
            session.user.id,
            studentSessionId,
            now,
          )
        ) {
          const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
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
          )
            .then(() => {
              markRedisValidatedStudentSessionDbSynced(
                schoolKey,
                session.user.id,
                studentSessionId,
                now,
              );
            })
            .catch(() => undefined);
        }

        return null;
      }

      const validationResult = await validateAndRefreshStudentSession(
        schoolKey,
        session.user.id,
        studentSessionId,
      );

      if (validationResult === "mismatch") {
        invalidateStudentSessionValidationCache({
          schoolKey,
          studentId: session.user.id,
          studentSessionId,
        });
        clearStudentSessionRecentRedisValidation(
          schoolKey,
          session.user.id,
          studentSessionId,
        );
        return buildStudentSessionInvalidResponse();
      }

      if (validationResult === "missing") {
        invalidateStudentSessionValidationCache({
          schoolKey,
          studentId: session.user.id,
          studentSessionId,
        });
        clearStudentSessionRecentRedisValidation(
          schoolKey,
          session.user.id,
          studentSessionId,
        );
        throw new Error("Redis student session missing or unavailable.");
      }

      if (validationResult !== "valid") {
        invalidateStudentSessionValidationCache({
          schoolKey,
          studentId: session.user.id,
          studentSessionId,
        });
        clearStudentSessionRecentRedisValidation(
          schoolKey,
          session.user.id,
          studentSessionId,
        );
        throw new Error("Redis student session validation unavailable.");
      }

      markStudentSessionRecentlyValidatedViaRedis(
        schoolKey,
        session.user.id,
        studentSessionId,
        now,
      );

      if (
        shouldSyncRedisValidatedStudentSessionToDb(
          schoolKey,
          session.user.id,
          studentSessionId,
          now,
        )
      ) {
        const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);
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
        )
          .then(() => {
            markRedisValidatedStudentSessionDbSynced(
              schoolKey,
              session.user.id,
              studentSessionId,
              now,
            );
          })
          .catch(() => undefined);
      }

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
      invalidateStudentSessionValidationCache({
        schoolKey,
        studentId: session.user.id,
        studentSessionId,
      });
      return buildStudentSessionInvalidResponse();
    }

    const activeStudentSessionId = String(
      student.activeStudentSessionId || "",
    ).trim();
    if (!activeStudentSessionId || activeStudentSessionId !== studentSessionId) {
      invalidateStudentSessionValidationCache({
        schoolKey,
        studentId: session.user.id,
        studentSessionId,
      });
      return buildStudentSessionInvalidResponse();
    }

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

      invalidateStudentSessionValidationCache({
        schoolKey,
        studentId: session.user.id,
        studentSessionId,
      });
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
          message:
            "This request is trying to access a different school than the one you signed in to.",
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
        { success: false, message: "School selection is required." },
        { status: 400 },
      ),
    };
  }

  if (session.user.role !== "student") {
    if (!resolvedSchoolKey) {
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

    const invalidPrivilegedSessionResponse =
      await validatePrivilegedSchoolUserSession(session, resolvedSchoolKey);
    if (invalidPrivilegedSessionResponse) {
      return {
        ok: false as const,
        response: invalidPrivilegedSessionResponse,
      };
    }
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

  try {
    await connectDB();
    const companyAdmin = await CompanyAdmin.findOne({
      _id: session.user.id,
      isActive: true,
    })
      .select("_id")
      .lean();

    if (!companyAdmin) {
      return {
        ok: false as const,
        response: buildPrivilegedSessionInvalidResponse(),
      };
    }
  } catch (error) {
    console.error("Failed to validate company admin session:", error);
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Failed to validate active session permissions.",
        },
        { status: 500 },
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}
