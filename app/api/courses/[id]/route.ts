export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import {
  buildCourseDocumentFromPayload,
  normalizeCoursePayload,
  validateNormalizedCourseBlocks,
  validateNormalizedCourseMetadata,
} from "@/lib/courses/payload";
import { getCourseAssessmentPaperIds } from "@/lib/courses/shared";
import {
  createCourseTemplateFamilyId,
  getCourseTemplateInfo,
} from "@/lib/courses/template-lineage";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveTeacherCourseScope } from "@/lib/courses/access";
import {
  getWorkspaceCourseById,
  recordCourseAudit,
  validateCourseAssessmentPapers,
  validateTeacherCourseScope,
} from "@/lib/server/workspace-courses";
import { createCourseAssignedNotifications } from "@/lib/server/student-notifications";

function toId(value: unknown) {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "_id" in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>)._id || "").trim();
  }
  return String(value || "").trim();
}

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  );
}

function areSameIds(left: unknown[], right: unknown[]) {
  const leftIds = new Set(normalizeIds(left));
  const rightIds = new Set(normalizeIds(right));
  if (leftIds.size !== rightIds.size) return false;
  for (const id of leftIds) {
    if (!rightIds.has(id)) return false;
  }
  return true;
}

async function validateAssignedAcademicSections(
  AcademicSectionModel: any,
  classId: string,
  assignedAcademicSectionIds: string[],
) {
  if (!assignedAcademicSectionIds.length) {
    return { ok: true as const, ids: [] as string[] };
  }

  const sections = await AcademicSectionModel.find({
    _id: { $in: assignedAcademicSectionIds },
    class: classId,
    isActive: true,
    $or: [{ isArchived: false }, { isArchived: { $exists: false } }],
  })
    .select("_id")
    .lean();

  if (sections.length !== assignedAcademicSectionIds.length) {
    return {
      ok: false as const,
      message:
        "Assigned sections must exist, be active, and belong to the selected class.",
      status: 400,
    };
  }

  return {
    ok: true as const,
    ids: normalizeIds(assignedAcademicSectionIds),
  };
}

async function validateSelectedSubjects(SubjectModel: any, subjectIds: string[]) {
  const normalizedIds = normalizeIds(subjectIds);

  if (normalizedIds.length === 0) {
    return {
      ok: false as const,
      message: "Select at least one subject for this course.",
      status: 400,
    };
  }

  if (normalizedIds.some((subjectId) => !mongoose.Types.ObjectId.isValid(subjectId))) {
    return {
      ok: false as const,
      message: "One or more selected subjects are invalid.",
      status: 400,
    };
  }

  const subjects = await SubjectModel.find({
    _id: { $in: normalizedIds },
    $or: [{ isArchived: false }, { isArchived: { $exists: false } }],
  })
    .select("_id")
    .lean();

  if (subjects.length !== normalizedIds.length) {
    return {
      ok: false as const,
      message: "One or more selected subjects could not be found.",
      status: 400,
    };
  }

  return {
    ok: true as const,
    ids: normalizedIds,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;

  try {
    const course = await getWorkspaceCourseById({
      schoolKey: auth.schoolKey,
      courseId: id,
      viewerId: auth.session.user.id,
      viewerRole: auth.session.user.role as "admin" | "teacher",
    });

    if (!course) {
      return NextResponse.json(
        {
          success: false,
          message: "Course not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      course,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load course.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const payload = normalizeCoursePayload(body);
    const isPublishing = payload.status === "published";

    if (!payload.title || !payload.classId) {
      return NextResponse.json(
        {
          success: false,
          message: "Course title and class are required.",
        },
        { status: 400 },
      );
    }

    const blockValidation = validateNormalizedCourseBlocks(payload.blocks, {
      strict: isPublishing,
    });
    if (!blockValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: blockValidation.message,
        },
        { status: 400 },
      );
    }

    const metadataValidation = validateNormalizedCourseMetadata(payload.metadata);
    if (!metadataValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: metadataValidation.message,
        },
        { status: 400 },
      );
    }

    const {
      Course: CourseModel,
      AcademicSection: AcademicSectionModel,
      Subject: SubjectModel,
      User: UserModel,
    } = await getTenantModels(auth.schoolKey, [
      "Course",
      "AcademicSection",
      "Subject",
      "User",
    ]);

    const subjectValidation = await validateSelectedSubjects(
      SubjectModel,
      payload.subjectIds,
    );

    if (!subjectValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: subjectValidation.message,
        },
        { status: subjectValidation.status },
      );
    }

    const existingCourse = await CourseModel.findOne({
      _id: id,
      ...buildArchiveFilter(false),
    })
      .select(
        "title class subjectIds assignedAcademicSections status publishedAt isTemplate templateFamilyId templateVersionNumber templateParentCourse derivedFromTemplateCourse derivedFromTemplateVersionNumber",
      )
      .lean();

    if (!existingCourse) {
      return NextResponse.json(
        {
          success: false,
          message: "Course not found.",
        },
        { status: 404 },
      );
    }

    if (auth.session.user.role === "teacher") {
      const scopedUser = await UserModel.findById(auth.session.user.id)
        .select(
          "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
        )
        .lean();

      const existingScope = resolveTeacherCourseScope(
        scopedUser,
        toId(existingCourse?.class),
        (Array.isArray(existingCourse?.subjectIds)
          ? existingCourse.subjectIds
          : []
        ).map((subject: any) => toId(subject)),
        (Array.isArray(existingCourse?.assignedAcademicSections)
          ? existingCourse.assignedAcademicSections
          : []
        ).map((section: any) => toId(section)),
      );

      if (
        !existingScope.hasClassAccess ||
        !existingScope.hasSectionAccess ||
        !existingScope.hasFullSubjectAccess
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Course not found.",
          },
          { status: 404 },
        );
      }

      const teacherScopeValidation = validateTeacherCourseScope({
        scopedUser,
        classId: payload.classId,
        subjectIds: subjectValidation.ids,
        assignedAcademicSectionIds: payload.assignedAcademicSectionIds,
      });

      if (!teacherScopeValidation.ok) {
        return NextResponse.json(
          {
            success: false,
            message: teacherScopeValidation.message,
          },
          { status: teacherScopeValidation.status },
        );
      }
    }

    const assignmentValidation = await validateAssignedAcademicSections(
      AcademicSectionModel,
      payload.classId,
      payload.assignedAcademicSectionIds,
    );

    if (!assignmentValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: assignmentValidation.message,
        },
        { status: assignmentValidation.status },
      );
    }

    if (isPublishing) {
      const assessmentValidation = await validateCourseAssessmentPapers({
        schoolKey: auth.schoolKey,
        paperIds: getCourseAssessmentPaperIds(payload.blocks),
        courseClassId: payload.classId,
        courseSubjectIds: subjectValidation.ids,
        courseAssignedSectionIds: assignmentValidation.ids,
        viewerId: auth.session.user.id,
        viewerRole: auth.session.user.role as "admin" | "teacher",
      });

      if (!assessmentValidation.ok) {
        return NextResponse.json(
          {
            success: false,
            message: assessmentValidation.message,
          },
          { status: assessmentValidation.status },
        );
      }
    }

    const existingTemplate = getCourseTemplateInfo(existingCourse, {
      fallbackCourseId: id,
    });
    const normalizedMetadata = existingCourse?.isTemplate
      ? {
          ...payload.metadata,
          isTemplate: true,
        }
      : payload.metadata;

    let templateDocument: Parameters<typeof buildCourseDocumentFromPayload>[0]["template"];

    if (existingCourse?.isTemplate) {
      templateDocument = {
        familyId: existingTemplate.familyId || createCourseTemplateFamilyId(),
        versionNumber: existingTemplate.versionNumber || 1,
        parentCourseId: existingTemplate.parentCourseId,
      };
    } else if (normalizedMetadata.isTemplate) {
      templateDocument = {
        familyId: createCourseTemplateFamilyId(),
        versionNumber: 1,
      };
    } else if (existingTemplate.derivedFromTemplateCourseId) {
      templateDocument = {
        derivedFromTemplateCourseId: existingTemplate.derivedFromTemplateCourseId,
        derivedFromTemplateVersionNumber:
          existingTemplate.derivedFromTemplateVersionNumber,
      };
    }

    await CourseModel.updateOne(
      { _id: id },
      {
        $set: buildCourseDocumentFromPayload({
          title: payload.title,
          summary: payload.summary,
          classId: payload.classId,
          subjectIds: subjectValidation.ids,
          assignedAcademicSectionIds: assignmentValidation.ids,
          status: payload.status,
          blocks: payload.blocks,
          metadata: normalizedMetadata,
          previousPublishedAt: existingCourse?.publishedAt || null,
          template: templateDocument,
        }),
      },
    );

    await recordCourseAudit({
      schoolKey: auth.schoolKey,
      req,
      courseId: id,
      title: payload.title,
      action: "course.update",
      summary: `Updated course ${payload.title}.`,
      details: {
        classId: payload.classId,
        subjectIds: subjectValidation.ids,
        status: payload.status,
        blockCount: payload.blocks.length,
        assignedAcademicSectionIds: assignmentValidation.ids,
      },
    });

    const wasPublished = String(existingCourse?.status || "") === "published";
    const isPublishingNow = payload.status === "published";
    const classChanged = toId(existingCourse?.class) !== payload.classId;
    const sectionsChanged = !areSameIds(
      Array.isArray(existingCourse?.assignedAcademicSections)
        ? existingCourse.assignedAcademicSections
        : [],
      assignmentValidation.ids,
    );

    if (isPublishingNow && (!wasPublished || classChanged || sectionsChanged)) {
      await createCourseAssignedNotifications({
        schoolKey: auth.schoolKey,
        courseId: id,
        title: payload.title,
        classId: payload.classId,
        assignedAcademicSections: assignmentValidation.ids,
      }).catch((error) => {
        console.error("Failed to create course assigned notifications:", error);
      });
    }

    return NextResponse.json({
      success: true,
      courseId: id,
      message: `Updated course ${payload.title}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to update course.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;

  try {
    const { Course: CourseModel, User: UserModel } = await getTenantModels(
      auth.schoolKey,
      ["Course", "User"],
    );

    const existingCourse = await CourseModel.findOne({
      _id: id,
      ...buildArchiveFilter(false),
    })
      .select("title class subjectIds assignedAcademicSections")
      .lean();

    if (!existingCourse) {
      return NextResponse.json(
        {
          success: false,
          message: "Course not found.",
        },
        { status: 404 },
      );
    }

    if (auth.session.user.role === "teacher") {
      const scopedUser = await UserModel.findById(auth.session.user.id)
        .select(
          "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
        )
        .lean();

      const existingScope = resolveTeacherCourseScope(
        scopedUser,
        toId(existingCourse?.class),
        (Array.isArray(existingCourse?.subjectIds)
          ? existingCourse.subjectIds
          : []
        ).map((subject: any) => toId(subject)),
        (Array.isArray(existingCourse?.assignedAcademicSections)
          ? existingCourse.assignedAcademicSections
          : []
        ).map((section: any) => toId(section)),
      );

      if (
        !existingScope.hasClassAccess ||
        !existingScope.hasSectionAccess ||
        !existingScope.hasFullSubjectAccess
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Course not found.",
          },
          { status: 404 },
        );
      }
    }

    await CourseModel.updateOne(
      { _id: id },
      {
        $set: {
          status: "archived",
          isArchived: true,
          archivedAt: new Date(),
          archivedBy: auth.session.user.id,
        },
      },
    );

    await recordCourseAudit({
      schoolKey: auth.schoolKey,
      req,
      courseId: id,
      title: String(existingCourse?.title || "Course"),
      action: "course.archive",
      summary: `Archived course ${existingCourse?.title || "Course"}.`,
    });

    return NextResponse.json({
      success: true,
      message: `Archived course ${existingCourse?.title || "Course"}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to archive course.",
      },
      { status: 500 },
    );
  }
}
