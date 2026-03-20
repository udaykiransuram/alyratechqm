import { NextRequest, NextResponse } from "next/server";

import { recordTenantAudit } from "@/lib/audit";
import { requireCompanyAdminSession } from "@/lib/api-auth";
import {
  applySafeStudentRollDuplicateFixes,
  buildStudentRollDuplicateAudit,
  resolveStudentRollDuplicateGroup,
} from "@/lib/admin/student-roll-cleanup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeSchoolKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function recordRollCleanupAudits(
  req: NextRequest,
  companyAdminSession: any,
  schoolKey: string,
  updates: Array<{
    userId: string;
    fromRollNumber: string;
    toRollNumber: string;
    passwordResetToRollNumber: boolean;
  }>,
  source: "safe_fix" | "manual_resolution",
) {
  await Promise.all(
    updates.map((update) =>
      recordTenantAudit({
        schoolKey,
        req,
        entityType: "user",
        entityId: update.userId,
        entityLabel: update.toRollNumber,
        action: "roll_number_updated",
        summary: `Updated duplicate student roll number from ${update.fromRollNumber} to ${update.toRollNumber}.`,
        details: {
          fromRollNumber: update.fromRollNumber,
          toRollNumber: update.toRollNumber,
          passwordResetToRollNumber: update.passwordResetToRollNumber,
          cleanupSource: source,
        },
        actor: {
          name: String(companyAdminSession?.user?.name || "").trim() || undefined,
          email:
            String(companyAdminSession?.user?.email || "").trim() || undefined,
          role: "company_admin",
        },
      }),
    ),
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const schoolKey = normalizeSchoolKey(
      req.nextUrl.searchParams.get("schoolKey"),
    );
    const audit = await buildStudentRollDuplicateAudit(schoolKey || undefined);
    return NextResponse.json({ success: true, ...audit });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message || "Failed to audit duplicate student roll numbers.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (action === "safe-fix") {
      const schoolKey = normalizeSchoolKey(body?.schoolKey);
      const result = await applySafeStudentRollDuplicateFixes(
        schoolKey || undefined,
      );

      await Promise.all(
        result.schools.map((schoolResult) =>
          recordRollCleanupAudits(
            req,
            auth.session,
            schoolResult.schoolKey,
            schoolResult.updatedUsers,
            "safe_fix",
          ),
        ),
      );

      return NextResponse.json({
        success: true,
        action,
        ...result,
      });
    }

    if (action === "resolve-group") {
      const schoolKey = normalizeSchoolKey(body?.schoolKey);
      const normalizedRollNumber = String(body?.normalizedRollNumber || "").trim();
      const updates = Array.isArray(body?.updates)
        ? body.updates.map((update: any) => ({
            userId: String(update?.userId || "").trim(),
            newRollNumber: String(update?.newRollNumber || "").trim(),
          }))
        : [];

      if (!schoolKey || !normalizedRollNumber || updates.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              "schoolKey, normalizedRollNumber, and at least one update are required.",
          },
          { status: 400 },
        );
      }

      const result = await resolveStudentRollDuplicateGroup({
        schoolKey,
        normalizedRollNumber,
        updates,
      });

      await recordRollCleanupAudits(
        req,
        auth.session,
        result.schoolKey,
        result.updatedUsers,
        "manual_resolution",
      );

      return NextResponse.json({
        success: true,
        action,
        result,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unsupported cleanup action.",
      },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Failed to process duplicate student roll-number cleanup.",
      },
      { status: 500 },
    );
  }
}
