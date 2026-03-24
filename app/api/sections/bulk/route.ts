export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { buildArchiveFilter, buildRestoreUpdate } from "@/lib/archive";
import { recordTenantAudit } from "@/lib/audit";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";

function normalizeRecord(record: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    normalized[String(key || "").trim().toLowerCase()] = value;
  });
  return normalized;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBoolean(value: unknown, defaultValue = true) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return defaultValue;
  }

  if (["true", "1", "yes", "y", "active"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "n", "inactive"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

async function resolveClassByReference(ClassModel: any, classRef: string) {
  if (!classRef) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(classRef)) {
    const classById = await ClassModel.findOne({
      _id: classRef,
      ...buildArchiveFilter(false),
    }).lean();
    if (classById) {
      return classById;
    }
  }

  return ClassModel.findOne({
    name: new RegExp(`^${escapeRegex(classRef)}$`, "i"),
    ...buildArchiveFilter(false),
  }).lean();
}

export async function POST(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  await connectDB();

  try {
    const { AcademicSection: AcademicSectionModel, Class: ClassModel } =
      await getTenantModels(schoolKey, ["AcademicSection", "Class"]);

    const body = await req.json();
    const sections = Array.isArray(body?.sections) ? body.sections : [];

    if (sections.length === 0) {
      return NextResponse.json(
        { success: false, message: "No sections provided." },
        { status: 400 },
      );
    }

    const results: any[] = [];

    for (const sectionItem of sections) {
      const normalized = normalizeRecord(sectionItem || {});
      const name = String(normalized.name || "").trim();
      const description = String(normalized.description || "").trim() || undefined;
      const classRef = String(
        normalized.classid ?? normalized.class ?? normalized.classname ?? "",
      ).trim();
      const isActive = parseBoolean(normalized.isactive, true);

      if (!name) {
        results.push({
          success: false,
          message: "Section name is required.",
          section: sectionItem,
        });
        continue;
      }

      if (!classRef) {
        results.push({
          success: false,
          message: "Class reference is required for each section.",
          section: sectionItem,
        });
        continue;
      }

      const classDoc = await resolveClassByReference(ClassModel, classRef);
      if (!classDoc?._id) {
        results.push({
          success: false,
          message: `Class "${classRef}" was not found.`,
          section: sectionItem,
        });
        continue;
      }

      let existing = await AcademicSectionModel.findOne({
        class: classDoc._id,
        name,
      })
        .populate({ path: "class", model: ClassModel, select: "name" })
        .lean();

      if (existing) {
        if ((existing as any).isArchived) {
          existing = await AcademicSectionModel.findByIdAndUpdate(
            existing._id,
            {
              ...buildRestoreUpdate(),
              description,
              isActive,
            },
            { new: true, runValidators: true },
          )
            .populate({ path: "class", model: ClassModel, select: "name" })
            .lean();

          await recordTenantAudit({
            schoolKey,
            req,
            entityType: "academic_section",
            entityId: String(existing?._id || ""),
            entityLabel: name,
            action: "restored",
            summary: `Restored section ${name}.`,
            details: {
              classId: String(classDoc._id),
              bulk: true,
            },
          });

          results.push({
            success: true,
            restored: true,
            section: existing,
          });
          continue;
        }

        results.push({
          success: true,
          existed: true,
          section: existing,
        });
        continue;
      }

      const createdSection = await AcademicSectionModel.create({
        name,
        class: classDoc._id,
        description,
        isActive,
      });

      const populatedSection = await AcademicSectionModel.findById(createdSection._id)
        .populate({ path: "class", model: ClassModel, select: "name" })
        .lean();

      await recordTenantAudit({
        schoolKey,
        req,
        entityType: "academic_section",
        entityId: String(createdSection._id),
        entityLabel: name,
        action: "created",
        summary: `Created section ${name}.`,
        details: {
          classId: String(classDoc._id),
          bulk: true,
        },
      });

      results.push({
        success: true,
        section: populatedSection,
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
