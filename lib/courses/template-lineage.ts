import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import type { CourseTemplateInfo } from "@/lib/courses/types";

function toId(value: unknown) {
  if (!value) {
    return "";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }

  return String(value || "").trim();
}

function toPositiveInteger(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : Number(String(value || "").trim());

  if (!Number.isFinite(numericValue) || numericValue < 1) {
    return null;
  }

  return Math.floor(numericValue);
}

export function createCourseTemplateFamilyId() {
  return new mongoose.Types.ObjectId().toHexString();
}

export function getCourseTemplateInfo(
  value: any,
  options?: {
    fallbackCourseId?: string;
  },
): CourseTemplateInfo {
  const fallbackCourseId = String(options?.fallbackCourseId || "").trim();
  const isTemplate = value?.isTemplate === true;
  const familyId = String(value?.templateFamilyId || "").trim();
  const versionNumber = toPositiveInteger(value?.templateVersionNumber);
  const parentCourseId = toId(value?.templateParentCourse);
  const derivedFromTemplateCourseId = toId(value?.derivedFromTemplateCourse);
  const derivedFromTemplateVersionNumber = toPositiveInteger(
    value?.derivedFromTemplateVersionNumber,
  );

  return {
    familyId: familyId || (isTemplate ? fallbackCourseId || null : null),
    versionNumber: versionNumber || (isTemplate ? 1 : null),
    parentCourseId: parentCourseId || null,
    derivedFromTemplateCourseId: derivedFromTemplateCourseId || null,
    derivedFromTemplateVersionNumber: derivedFromTemplateVersionNumber || null,
  };
}

export async function resolveNextCourseTemplateVersionNumber(params: {
  CourseModel: any;
  familyId: string;
  baseVersion?: number | null;
}) {
  const familyId = String(params.familyId || "").trim();
  const baseVersion = Math.max(1, Number(params.baseVersion || 1));

  if (!familyId) {
    return baseVersion;
  }

  const latestTemplate = await params.CourseModel.findOne({
    templateFamilyId: familyId,
    isTemplate: true,
    ...buildArchiveFilter(false),
  })
    .select("templateVersionNumber")
    .sort({ templateVersionNumber: -1, updatedAt: -1 })
    .lean();

  const latestVersion = toPositiveInteger(latestTemplate?.templateVersionNumber) || 0;
  return Math.max(baseVersion, latestVersion) + 1;
}
