export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { buildRestoreUpdate } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

function resolveSchoolKey(req: NextRequest) {
  const url = new URL(req.url);
  const schoolFromHeader =
    req.headers.get("x-school-key") || req.headers.get("X-School-Key");
  const schoolFromQuery = url.searchParams.get("school");
  const schoolFromCookie = req.cookies?.get?.("schoolKey")?.value;
  return (schoolFromHeader || schoolFromQuery || schoolFromCookie || "")
    .toString()
    .trim();
}

function normalizeRecord(record: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    normalized[String(key || "").trim().toLowerCase()] = value;
  });
  return normalized;
}

export async function POST(req: NextRequest) {
  await connectDB();
  const schoolKey = resolveSchoolKey(req);
  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }

  const { Class: ClassModel } = await getTenantModels(schoolKey, ["Class"]);

  try {
    const body = await req.json();
    const classes = Array.isArray(body?.classes) ? body.classes : [];

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
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
