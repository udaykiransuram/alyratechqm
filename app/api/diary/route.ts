export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import {
  buildDiaryDocumentFromPayload,
  buildDiaryScopeKey,
  normalizeDiaryPayload,
  validateNormalizedDiaryPayload,
} from "@/lib/diary/payload";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  findDiaryScopeConflict,
  getScopedAuthorUser,
  listWorkspaceDiaryEntries,
  recordDiaryAudit,
  validateDiaryAuthorScope,
} from "@/lib/server/diary";
import { createDiaryUpdateNotifications } from "@/lib/server/student-notifications";

function normalizeIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  );
}

async function validateSelectedClass(ClassModel: any, classId: string) {
  if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
    return {
      ok: false as const,
      message: "Select a valid class for this diary entry.",
      status: 400,
    };
  }

  const classDoc = await ClassModel.findOne({
    _id: classId,
    ...buildArchiveFilter(false),
  })
    .select("_id")
    .lean();

  if (!classDoc) {
    return {
      ok: false as const,
      message: "The selected class could not be found.",
      status: 400,
    };
  }

  return {
    ok: true as const,
    id: String(classDoc._id),
  };
}

async function validateSelectedSubject(SubjectModel: any, subjectId: string) {
  if (!subjectId || !mongoose.Types.ObjectId.isValid(subjectId)) {
    return {
      ok: false as const,
      message: "Select a valid subject for this diary entry.",
      status: 400,
    };
  }

  const subject = await SubjectModel.findOne({
    _id: subjectId,
    ...buildArchiveFilter(false),
  })
    .select("_id")
    .lean();

  if (!subject) {
    return {
      ok: false as const,
      message: "The selected subject could not be found.",
      status: 400,
    };
  }

  return {
    ok: true as const,
    id: String(subject._id),
  };
}

async function validateAssignedAcademicSections(
  AcademicSectionModel: any,
  classId: string,
  assignedAcademicSectionIds: string[],
) {
  if (!assignedAcademicSectionIds.length) {
    return { ok: true as const, ids: [] as string[] };
  }

  if (
    assignedAcademicSectionIds.some(
      (sectionId) => !mongoose.Types.ObjectId.isValid(sectionId),
    )
  ) {
    return {
      ok: false as const,
      message: "One or more assigned sections are invalid.",
      status: 400,
    };
  }

  const sections = await AcademicSectionModel.find({
    _id: { $in: assignedAcademicSectionIds },
    class: classId,
    isActive: true,
    ...buildArchiveFilter(false),
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
    const diaryDirectory = await listWorkspaceDiaryEntries({
      schoolKey: auth.schoolKey,
      viewerId: auth.session.user.id,
      filters: {
        entryDate: req.nextUrl.searchParams.get("entryDate") || undefined,
        classId: req.nextUrl.searchParams.get("classId") || undefined,
        sectionId: req.nextUrl.searchParams.get("sectionId") || undefined,
        subjectId: req.nextUrl.searchParams.get("subjectId") || undefined,
        status: req.nextUrl.searchParams.get("status") || undefined,
      },
      page: pageParam ? Number(pageParam) : undefined,
      limit: limitParam ? Number(limitParam) : undefined,
    });

    return NextResponse.json({
      success: true,
      entries: diaryDirectory.entries,
      total: diaryDirectory.total,
      page: diaryDirectory.page,
      pages: diaryDirectory.pages,
      limit: diaryDirectory.limit,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load diary entries.",
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

  let scopeKey = "";

  try {
    const body = await req.json().catch(() => ({}));
    const payload = normalizeDiaryPayload(body);
    const isPublishing = payload.status === "published";

    const payloadValidation = validateNormalizedDiaryPayload(payload, {
      strict: isPublishing,
    });
    if (!payloadValidation.ok) {
      return NextResponse.json(
        {
          success: false,
          message: payloadValidation.message,
        },
        { status: 400 },
      );
    }

    const {
      DiaryEntry: DiaryEntryModel,
      Class: ClassModel,
      Subject: SubjectModel,
      AcademicSection: AcademicSectionModel,
    } = await getTenantModels(auth.schoolKey, [
      "DiaryEntry",
      "Class",
      "Subject",
      "AcademicSection",
    ]);

    const [classValidation, subjectValidation, scopedUser] = await Promise.all([
      validateSelectedClass(ClassModel, payload.classId),
      validateSelectedSubject(SubjectModel, payload.subjectId),
      getScopedAuthorUser(auth.schoolKey, auth.session.user.id),
    ]);

    if (!classValidation.ok) {
      return NextResponse.json(
        { success: false, message: classValidation.message },
        { status: classValidation.status },
      );
    }

    if (!subjectValidation.ok) {
      return NextResponse.json(
        { success: false, message: subjectValidation.message },
        { status: subjectValidation.status },
      );
    }

    if (!scopedUser) {
      return NextResponse.json(
        { success: false, message: "Active author scope could not be resolved." },
        { status: 403 },
      );
    }

    const sectionValidation = await validateAssignedAcademicSections(
      AcademicSectionModel,
      classValidation.id,
      payload.assignedAcademicSectionIds,
    );

    if (!sectionValidation.ok) {
      return NextResponse.json(
        { success: false, message: sectionValidation.message },
        { status: sectionValidation.status },
      );
    }

    const scopeValidation = validateDiaryAuthorScope({
      scopedUser,
      classId: classValidation.id,
      subjectId: subjectValidation.id,
      assignedAcademicSectionIds: sectionValidation.ids,
    });

    if (!scopeValidation.ok) {
      return NextResponse.json(
        { success: false, message: scopeValidation.message },
        { status: scopeValidation.status },
      );
    }

    scopeKey = buildDiaryScopeKey({
      entryDate: payload.entryDate,
      classId: classValidation.id,
      subjectId: subjectValidation.id,
      assignedAcademicSectionIds: sectionValidation.ids,
    });

    const conflict = await findDiaryScopeConflict({
      schoolKey: auth.schoolKey,
      scopeKey,
    });

    if (conflict) {
      return NextResponse.json(
        {
          success: false,
          code: "DIARY_SCOPE_CONFLICT",
          message:
            "A diary entry already exists for that date, class, subject, and section scope.",
          entryId: conflict._id,
        },
        { status: 409 },
      );
    }

    const entry = await DiaryEntryModel.create(
      buildDiaryDocumentFromPayload({
        payload: {
          ...payload,
          classId: classValidation.id,
          subjectId: subjectValidation.id,
          assignedAcademicSectionIds: sectionValidation.ids,
        },
        createdBy: auth.session.user.id,
        updatedBy: auth.session.user.id,
      }),
    );

    await recordDiaryAudit({
      schoolKey: auth.schoolKey,
      req,
      entryId: String(entry._id),
      title: payload.title,
      action: "diary_entry.create",
      summary: `Created diary entry ${payload.title}.`,
      details: {
        entryDate: payload.entryDate,
        classId: classValidation.id,
        subjectId: subjectValidation.id,
        assignedAcademicSectionIds: sectionValidation.ids,
        status: payload.status,
      },
    });

    if (isPublishing) {
      await createDiaryUpdateNotifications({
        schoolKey: auth.schoolKey,
        entryId: String(entry._id),
        title: payload.title,
        classId: classValidation.id,
        assignedAcademicSections: sectionValidation.ids,
        entryDate: payload.entryDate,
      }).catch((error) => {
        console.error("Failed to create diary update notifications:", error);
      });
    }

    return NextResponse.json({
      success: true,
      entryId: String(entry._id),
      message: `Created diary entry ${payload.title}.`,
    }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000 && scopeKey) {
      const conflict = await findDiaryScopeConflict({
        schoolKey: auth.schoolKey,
        scopeKey,
      });

      return NextResponse.json(
        {
          success: false,
          code: "DIARY_SCOPE_CONFLICT",
          message:
            "A diary entry already exists for that date, class, subject, and section scope.",
          entryId: conflict?._id,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to create diary entry.",
      },
      { status: 500 },
    );
  }
}
