export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { buildArchiveFilter } from "@/lib/archive";
import { requireTenantSession } from "@/lib/api-auth";
import { resolveDiaryAuthorScope } from "@/lib/diary/access";
import {
  buildDiaryDocumentFromPayload,
  buildDiaryScopeKey,
  normalizeDiaryPayload,
  validateNormalizedDiaryPayload,
} from "@/lib/diary/payload";
import { uniqueSortedDiaryIds } from "@/lib/diary/shared";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  archiveDiaryEntry,
  findDiaryScopeConflict,
  getScopedAuthorUser,
  getWorkspaceDiaryById,
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

function canAccessExistingDiary(entry: any, scopedUser: any) {
  const assignedSectionIds = uniqueSortedDiaryIds(entry?.assignedAcademicSections);
  if (!scopedUser?.hasAllSections && assignedSectionIds.length === 0) {
    return false;
  }

  const scope = resolveDiaryAuthorScope(
    scopedUser,
    String(entry?.class || "").trim(),
    String(entry?.subject || "").trim(),
    assignedSectionIds,
  );

  return (
    scope.hasClassAccess &&
    scope.hasSubjectAccess &&
    scope.hasSectionAccess &&
    scope.hasFullSubjectAccess
  );
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Diary entry not found.",
      },
      { status: 404 },
    );
  }

  try {
    const entry = await getWorkspaceDiaryById({
      schoolKey: auth.schoolKey,
      entryId: id,
      viewerId: auth.session.user.id,
    });

    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          message: "Diary entry not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      entry,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to load diary entry.",
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Diary entry not found.",
      },
      { status: 404 },
    );
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
        { success: false, message: payloadValidation.message },
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

    const [existingEntry, scopedUser, classValidation, subjectValidation] =
      await Promise.all([
        DiaryEntryModel.findOne({
          _id: id,
          ...buildArchiveFilter(false),
        })
          .select(
            "_id title class subject assignedAcademicSections publishedAt entryDate",
          )
          .lean(),
        getScopedAuthorUser(auth.schoolKey, auth.session.user.id),
        validateSelectedClass(ClassModel, payload.classId),
        validateSelectedSubject(SubjectModel, payload.subjectId),
      ]);

    if (!existingEntry || !scopedUser || !canAccessExistingDiary(existingEntry, scopedUser)) {
      return NextResponse.json(
        { success: false, message: "Diary entry not found." },
        { status: 404 },
      );
    }

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
      excludeId: id,
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

    await DiaryEntryModel.updateOne(
      { _id: id },
      {
        $set: buildDiaryDocumentFromPayload({
          payload: {
            ...payload,
            classId: classValidation.id,
            subjectId: subjectValidation.id,
            assignedAcademicSectionIds: sectionValidation.ids,
          },
          updatedBy: auth.session.user.id,
          previousPublishedAt: existingEntry.publishedAt || null,
        }),
      },
    );

    await recordDiaryAudit({
      schoolKey: auth.schoolKey,
      req,
      entryId: id,
      title: payload.title,
      action: "diary_entry.update",
      summary: `Updated diary entry ${payload.title}.`,
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
        entryId: id,
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
      entryId: id,
      message: `Updated diary entry ${payload.title}.`,
    });
  } catch (error: any) {
    if (error?.code === 11000 && scopeKey) {
      const conflict = await findDiaryScopeConflict({
        schoolKey: auth.schoolKey,
        scopeKey,
        excludeId: id,
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
        message: error?.message || "Failed to update diary entry.",
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      {
        success: false,
        message: "Diary entry not found.",
      },
      { status: 404 },
    );
  }

  try {
    const { DiaryEntry: DiaryEntryModel } = await getTenantModels(auth.schoolKey, [
      "DiaryEntry",
    ]);

    const [existingEntry, scopedUser] = await Promise.all([
      DiaryEntryModel.findOne({
        _id: id,
        ...buildArchiveFilter(false),
      })
        .select("_id title class subject assignedAcademicSections")
        .lean(),
      getScopedAuthorUser(auth.schoolKey, auth.session.user.id),
    ]);

    if (!existingEntry || !scopedUser || !canAccessExistingDiary(existingEntry, scopedUser)) {
      return NextResponse.json(
        { success: false, message: "Diary entry not found." },
        { status: 404 },
      );
    }

    const archivedEntry = await archiveDiaryEntry({
      schoolKey: auth.schoolKey,
      entryId: id,
      actorId: auth.session.user.id,
    });

    if (!archivedEntry) {
      return NextResponse.json(
        { success: false, message: "Diary entry not found." },
        { status: 404 },
      );
    }

    await recordDiaryAudit({
      schoolKey: auth.schoolKey,
      req,
      entryId: id,
      title: archivedEntry.title,
      action: "diary_entry.archive",
      summary: `Archived diary entry ${archivedEntry.title}.`,
    });

    return NextResponse.json({
      success: true,
      entryId: id,
      message: `Archived diary entry ${archivedEntry.title}.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to archive diary entry.",
      },
      { status: 500 },
    );
  }
}
