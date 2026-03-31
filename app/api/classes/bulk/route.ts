export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { buildRestoreUpdate } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { recordOpsFailure } from "@/lib/ops-runtime";

function normalizeRecord(record: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    normalized[String(key || "").trim().toLowerCase()] = value;
  });
  return normalized;
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  let classRowCount: number | null = null;

  try {
    await connectDB();
    const { Class: ClassModel } = await getTenantModels(schoolKey, ["Class"]);

    const body = await req.json();
    const classes = Array.isArray(body?.classes) ? body.classes : [];
    classRowCount = classes.length;

    if (classes.length === 0) {
      return NextResponse.json(
        { success: false, message: "No classes provided." },
        { status: 400 },
      );
    }

    const results: any[] = [];

    for (const classItem of classes) {
      const normalized = normalizeRecord(classItem || {});
      const name = String(normalized.name || "").trim();
      const description = String(normalized.description || "").trim() || undefined;

      if (!name) {
        results.push({
          success: false,
          message: "Class name is required.",
          class: classItem,
        });
        continue;
      }

      let existing = await ClassModel.findOne({ name });

      if (existing) {
        if (existing.isArchived) {
          existing = await ClassModel.findByIdAndUpdate(
            existing._id,
            { ...buildRestoreUpdate(), description },
            { new: true, runValidators: true },
          );

          await recordTenantAudit({
            schoolKey,
            req,
            entityType: "class",
            entityId: String(existing?._id || ""),
            entityLabel: name,
            action: "restored",
            summary: `Restored class ${name}.`,
            details: { description, bulk: true },
          });

          results.push({
            success: true,
            restored: true,
            class: existing,
          });
          continue;
        }

        results.push({
          success: true,
          existed: true,
          class: existing,
        });
        continue;
      }

      const newClass = new ClassModel({
        name,
        description,
      });
      await newClass.save();

      await recordTenantAudit({
        schoolKey,
        req,
        entityType: "class",
        entityId: String(newClass._id),
        entityLabel: name,
        action: "created",
        summary: `Created class ${name}.`,
        details: { description, bulk: true },
      });

      results.push({
        success: true,
        class: newClass,
      });
    }

    return NextResponse.json({
      success: true,
      results,
      count: results.filter((result) => result.success).length,
    });
  } catch (error: any) {
    await recordOpsFailure({
      schoolKey,
      req,
      action: "bulk_class_import",
      message: error?.message || "Failed to import classes.",
      error,
      metadata: {
        route: "/api/classes/bulk",
        method: "POST",
        uploadType: "classes",
        rows: classRowCount,
      },
      entity: {
        type: "bulk_upload",
        label: "classes",
      },
      severity: "error",
    });
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
