export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireTenantSession } from "@/lib/api-auth";
import { buildArchiveFilter } from "@/lib/archive";
import { resolveTeacherCourseScope } from "@/lib/courses/access";
import {
  normalizeCoursePayload,
  validateNormalizedCourseBlocks,
  validateNormalizedCourseMetadata,
  buildCourseDocumentFromPayload,
} from "@/lib/courses/payload";
import { getCourseAssessmentPaperIds } from "@/lib/courses/shared";
import {
  createCourseTemplateFamilyId,
  getCourseTemplateInfo,
  resolveNextCourseTemplateVersionNumber,
} from "@/lib/courses/template-lineage";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  listWorkspaceCourses,
  recordCourseAudit,
  validateCourseAssessmentPapers,
  validateTeacherCourseScope,
} from "@/lib/server/workspace-courses";
import { createCourseAssignedNotifications } from "@/lib/server/student-notifications";

function toId(value: unknown) {
  if (!value) return "";
  if (
    typeof value === "object" &&
    value !== null &&
    "_id" in (value as Record<string, unknown>)
  ) {
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

function buildTemplateScopeCheck(course: any, scopedUser: any) {
  return resolveTeacherCourseScope(
    scopedUser,
    toId(course?.class),
    (Array.isArray(course?.subjectIds) ? course.subjectIds : []).map((subject: any) =>
      toId(subject),
    ),
    (
      Array.isArray(course?.assignedAcademicSections)
        ? course.assignedAcademicSections
        : []
    ).map((section: any) => toId(section)),
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const pageParam = req.nextUrl.searchParams.get("page");
    const limitParam = req.nextUrl.searchParams.get("limit");
    const viewParam = req.nextUrl.searchParams.get("view");
    const courseDirectory = await listWorkspaceCourses({
      schoolKey: auth.schoolKey,
      viewerId: auth.session.user.id,
      viewerRole: auth.session.user.role as "admin" | "teacher",
      page: pageParam ? Number(pageParam) : undefined,
      limit: limitParam ? Number(limitParam) : undefined,
      filters: {
        view: viewParam || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      courses: courseDirectory.courses,
      total: courseDirectory.total,
      page: courseDirectory.page,
      pages: courseDirectory.pages,
      limit: courseDirectory.limit,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load courses.",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  await connectDB();
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

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

    let scopedUser: any = null;

    if (auth.session.user.role === "teacher") {
      scopedUser = await UserModel.findById(auth.session.user.id)
        .select(
          "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
        )
        .lean();

      const teacherScopeValidation = validateTeacherCourseScope({
        scopedUser,
        classId: payload.classId,
        subjectIds: subjectValidation.ids,
        assignedAcademicSectionIds: assignmentValidation.ids,
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

    const sourceCourseId =
      payload.templateContext.versionFromCourseId ||
      payload.templateContext.templateFromCourseId;
    const sourceCourse = sourceCourseId
      ? await CourseModel.findOne({
          _id: sourceCourseId,
          ...buildArchiveFilter(false),
        })
          .select(
            "_id title class subjectIds assignedAcademicSections isTemplate templateFamilyId templateVersionNumber",
          )
          .lean()
      : null;

    if (sourceCourseId && !sourceCourse) {
      return NextResponse.json(
        {
          success: false,
          message: "Template source could not be found.",
        },
        { status: 404 },
      );
    }

    if (sourceCourse && auth.session.user.role === "teacher") {
      const sourceScope = buildTemplateScopeCheck(sourceCourse, scopedUser);
      if (
        !sourceScope.hasClassAccess ||
        !sourceScope.hasSectionAccess ||
        !sourceScope.hasFullSubjectAccess
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Template source could not be found.",
          },
          { status: 404 },
        );
      }
    }

    if (
      (payload.templateContext.versionFromCourseId ||
        payload.templateContext.templateFromCourseId) &&
      !sourceCourse?.isTemplate
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Only reusable templates can be used for this action.",
        },
        { status: 400 },
      );
    }

    const normalizedMetadata = payload.templateContext.versionFromCourseId
      ? {
          ...payload.metadata,
          isTemplate: true,
        }
      : payload.metadata;

    let templateDocument: Parameters<typeof buildCourseDocumentFromPayload>[0]["template"];

    if (payload.templateContext.versionFromCourseId && sourceCourse) {
      const sourceTemplate = getCourseTemplateInfo(sourceCourse, {
        fallbackCourseId: toId(sourceCourse?._id),
      });
      const familyId = sourceTemplate.familyId || createCourseTemplateFamilyId();
      const versionNumber = await resolveNextCourseTemplateVersionNumber({
        CourseModel,
        familyId,
        baseVersion: sourceTemplate.versionNumber || 1,
      });

      templateDocument = {
        familyId,
        versionNumber,
        parentCourseId: toId(sourceCourse?._id),
      };
    } else if (normalizedMetadata.isTemplate) {
      templateDocument = {
        familyId: createCourseTemplateFamilyId(),
        versionNumber: 1,
      };
    } else if (payload.templateContext.templateFromCourseId && sourceCourse) {
      const sourceTemplate = getCourseTemplateInfo(sourceCourse, {
        fallbackCourseId: toId(sourceCourse?._id),
      });

      templateDocument = {
        derivedFromTemplateCourseId: toId(sourceCourse?._id),
        derivedFromTemplateVersionNumber: sourceTemplate.versionNumber,
      };
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

    const course = await CourseModel.create(
      buildCourseDocumentFromPayload({
        title: payload.title,
        summary: payload.summary,
        classId: payload.classId,
        subjectIds: subjectValidation.ids,
        assignedAcademicSectionIds: assignmentValidation.ids,
        status: payload.status,
        blocks: payload.blocks,
        metadata: normalizedMetadata,
        createdBy: auth.session.user.id,
        template: templateDocument,
      }),
    );

    await recordCourseAudit({
      schoolKey: auth.schoolKey,
      req,
      courseId: String(course._id),
      title: payload.title,
      action: "course.create",
      summary: `Created course ${payload.title}.`,
      details: {
        classId: payload.classId,
        subjectIds: subjectValidation.ids,
        status: payload.status,
        blockCount: payload.blocks.length,
        assignedAcademicSectionIds: assignmentValidation.ids,
      },
    });

    if (isPublishing) {
      await createCourseAssignedNotifications({
        schoolKey: auth.schoolKey,
        courseId: String(course._id),
        title: payload.title,
        classId: payload.classId,
        assignedAcademicSections: assignmentValidation.ids,
      }).catch((error) => {
        console.error("Failed to create course assigned notifications:", error);
      });
    }

    return NextResponse.json({
      success: true,
      courseId: String(course._id),
      message: `Created course ${payload.title}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to create course.",
      },
      { status: 500 },
    );
  }
}
