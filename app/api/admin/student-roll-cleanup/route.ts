import { NextRequest, NextResponse } from "next/server";

import { recordTenantAudit } from "@/lib/audit";
import { requireCompanyAdminSession } from "@/lib/api-auth";
import {
  buildCompanyAuditActorFromSession,
  recordCompanyAudit,
} from "@/lib/company-audit";
import { requireProductionAdminMaintenanceAccess } from "@/lib/ops-runtime";
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
  const maintenanceAccess = requireProductionAdminMaintenanceAccess();
  if (maintenanceAccess) return maintenanceAccess;

  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const actor = buildCompanyAuditActorFromSession(auth.session);
  const schoolKey = normalizeSchoolKey(req.nextUrl.searchParams.get("schoolKey"));

  try {
    const audit = await buildStudentRollDuplicateAudit(schoolKey || undefined);

    await recordCompanyAudit({
      schoolKey: schoolKey || undefined,
      req,
      actor,
      entityType: "student_roll_cleanup",
      entityLabel: schoolKey || "all schools",
      action: "student_roll_cleanup_audit",
      summary:
        audit.summary.duplicateGroupCount > 0
          ? `Reviewed duplicate student roll numbers and found ${audit.summary.duplicateGroupCount} duplicate group(s).`
          : "Reviewed duplicate student roll numbers and found no active duplicates.",
      details: {
        outcome: "success",
        requestedSchoolKey: schoolKey || undefined,
        schoolsScanned: audit.summary.schoolsScanned,
        schoolsWithDuplicates: audit.summary.schoolsWithDuplicates,
        duplicateGroupCount: audit.summary.duplicateGroupCount,
        affectedStudentCount: audit.summary.affectedStudentCount,
        autoFixCandidateCount: audit.summary.autoFixCandidateCount,
        riskyGroupCount: audit.summary.riskyGroupCount,
      },
    });

    return NextResponse.json({ success: true, ...audit });
  } catch (error: any) {
    await recordCompanyAudit({
      schoolKey: schoolKey || undefined,
      req,
      actor,
      entityType: "student_roll_cleanup",
      entityLabel: schoolKey || "all schools",
      action: "student_roll_cleanup_audit",
      summary: "Failed to review duplicate student roll numbers.",
      details: {
        outcome: "failure",
        requestedSchoolKey: schoolKey || undefined,
        error:
          error?.message || "Failed to audit duplicate student roll numbers.",
      },
    });
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
  const maintenanceAccess = requireProductionAdminMaintenanceAccess();
  if (maintenanceAccess) return maintenanceAccess;

  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;
  const actor = buildCompanyAuditActorFromSession(auth.session);
  let action = "";
  let schoolKey = "";
  let normalizedRollNumber = "";

  try {
    const body = await req.json().catch(() => ({}));
    action = String(body?.action || "").trim();

    if (action === "safe-fix") {
      schoolKey = normalizeSchoolKey(body?.schoolKey);
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

      await recordCompanyAudit({
        schoolKey: schoolKey || undefined,
        req,
        actor,
        entityType: "student_roll_cleanup",
        entityLabel: schoolKey || "all schools",
        action: "student_roll_cleanup_safe_fix",
        summary:
          result.summary.updatedCount > 0
            ? `Applied safe duplicate student roll-number fixes to ${result.summary.updatedCount} student record(s).`
            : "Ran safe duplicate student roll-number fixes with no eligible changes.",
        details: {
          outcome: "success",
          requestedSchoolKey: schoolKey || undefined,
          schoolsProcessed: result.summary.schoolsProcessed,
          updatedCount: result.summary.updatedCount,
          passwordResetCount: result.summary.passwordResetCount,
          schools: result.schools.map((schoolResult) => ({
            schoolKey: schoolResult.schoolKey,
            updatedCount: schoolResult.updatedCount,
            passwordResetCount: schoolResult.passwordResetCount,
          })),
        },
      });

      return NextResponse.json({
        success: true,
        action,
        ...result,
      });
    }

    if (action === "resolve-group") {
      schoolKey = normalizeSchoolKey(body?.schoolKey);
      normalizedRollNumber = String(body?.normalizedRollNumber || "").trim();
      const updates = Array.isArray(body?.updates)
        ? body.updates.map((update: any) => ({
            userId: String(update?.userId || "").trim(),
            newRollNumber: String(update?.newRollNumber || "").trim(),
          }))
        : [];

      if (!schoolKey || !normalizedRollNumber || updates.length === 0) {
        await recordCompanyAudit({
          schoolKey: schoolKey || undefined,
          req,
          actor,
          entityType: "student_roll_cleanup",
          entityLabel:
            schoolKey && normalizedRollNumber
              ? `${schoolKey}:${normalizedRollNumber}`
              : schoolKey || "all schools",
          action: "student_roll_cleanup_manual_resolution",
          summary: "Rejected manual duplicate student roll-number resolution with missing inputs.",
          details: {
            outcome: "rejected",
            requestedSchoolKey: schoolKey || undefined,
            normalizedRollNumber: normalizedRollNumber || undefined,
            updateCount: updates.length,
          },
        });
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

      await recordCompanyAudit({
        schoolKey: result.schoolKey,
        req,
        actor,
        entityType: "student_roll_cleanup",
        entityLabel: `${result.schoolKey}:${normalizedRollNumber}`,
        action: "student_roll_cleanup_manual_resolution",
        summary: `Resolved duplicate student roll-number group ${normalizedRollNumber} in ${result.schoolKey}.`,
        details: {
          outcome: "success",
          requestedSchoolKey: result.schoolKey,
          normalizedRollNumber,
          updatedCount: result.updatedCount,
          passwordResetCount: result.passwordResetCount,
          updatedUsers: result.updatedUsers,
        },
      });

      return NextResponse.json({
        success: true,
        action,
        result,
      });
    }

    await recordCompanyAudit({
      schoolKey: schoolKey || undefined,
      req,
      actor,
      entityType: "student_roll_cleanup",
      entityLabel: schoolKey || "all schools",
      action: "student_roll_cleanup_request",
      summary: "Rejected unsupported duplicate student roll-number cleanup action.",
      details: {
        outcome: "rejected",
        requestedSchoolKey: schoolKey || undefined,
        action,
      },
    });

    return NextResponse.json(
      {
        success: false,
        message: "Unsupported cleanup action.",
      },
      { status: 400 },
    );
  } catch (error: any) {
    await recordCompanyAudit({
      schoolKey: schoolKey || undefined,
      req,
      actor,
      entityType: "student_roll_cleanup",
      entityLabel:
        action === "resolve-group" && normalizedRollNumber
          ? `${schoolKey || "unknown"}:${normalizedRollNumber}`
          : schoolKey || "all schools",
      action:
        action === "safe-fix"
          ? "student_roll_cleanup_safe_fix"
          : action === "resolve-group"
            ? "student_roll_cleanup_manual_resolution"
            : "student_roll_cleanup_request",
      summary:
        action === "safe-fix"
          ? "Failed to apply safe duplicate student roll-number fixes."
          : action === "resolve-group"
            ? `Failed to resolve duplicate student roll-number group ${normalizedRollNumber || "(unknown)"}.`
            : "Failed to process duplicate student roll-number cleanup request.",
      details: {
        outcome: "failure",
        requestedSchoolKey: schoolKey || undefined,
        normalizedRollNumber: normalizedRollNumber || undefined,
        action: action || undefined,
        error:
          error?.message ||
          "Failed to process duplicate student roll-number cleanup.",
      },
    });
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
