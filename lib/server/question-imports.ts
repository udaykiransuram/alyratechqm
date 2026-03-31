import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import type { QuestionImportDraftRecord } from "@/lib/question-import/types";
import {
  deriveQuestionImportDraftStatus,
  syncQuestionImportMappings,
} from "@/lib/question-import/review";

function cloneForTransport<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeComparableValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function serializeQuestionImportDraftRecord(
  value: any,
): QuestionImportDraftRecord {
  const plainValue = cloneForTransport(value);
  const syncedPayload = syncQuestionImportMappings(
    plainValue?.payload || {
      templateVersion: "1",
      paper: {
        title: "",
        instructionsHtml: "",
        classToken: "",
        classId: "",
        durationMinutes: 60,
        passingMarks: 0,
        examDate: "",
        onlineEnabled: false,
        onlineStartsAt: "",
        onlineEndsAt: "",
        academicSectionAssignmentMode: "all",
        assignedAcademicSectionIds: [],
        academicSectionTokens: [],
      },
      paperSections: [],
      questions: [],
      images: [],
      warnings: [],
      errors: [],
      mappings: {
        subjects: [],
        academicSections: [],
      },
      mathFragments: [],
    },
  );
  const normalizedStatus = String(plainValue?.status || "").trim();
  const status =
    normalizedStatus === "uploaded" ||
    normalizedStatus === "parsed" ||
    normalizedStatus === "needs_review" ||
    normalizedStatus === "ready_to_publish" ||
    normalizedStatus === "published" ||
    normalizedStatus === "failed"
      ? normalizedStatus
      : deriveQuestionImportDraftStatus(syncedPayload);

  return {
    _id: String(plainValue?._id || ""),
    status: status as QuestionImportDraftRecord["status"],
    sourceFile: {
      name: String(plainValue?.sourceFile?.name || ""),
      mimeType: String(plainValue?.sourceFile?.mimeType || ""),
      size: Number(plainValue?.sourceFile?.size || 0),
    },
    payload: syncedPayload,
    createdBy: String(plainValue?.createdBy || ""),
    updatedBy: plainValue?.updatedBy ? String(plainValue.updatedBy) : undefined,
    publishedQuestionIds: Array.isArray(plainValue?.publishedQuestionIds)
      ? plainValue.publishedQuestionIds.map((item: unknown) => String(item || ""))
      : [],
    publishedPaperId: plainValue?.publishedPaperId
      ? String(plainValue.publishedPaperId)
      : undefined,
    createdAt: String(plainValue?.createdAt || ""),
    updatedAt: String(plainValue?.updatedAt || ""),
  };
}

export async function getWorkspaceQuestionImportDraft(
  schoolKey: string,
  draftId: string,
) {
  await connectDB();
  const { QuestionImportDraft: QuestionImportDraftModel } = await getTenantModels(
    schoolKey,
    ["QuestionImportDraft"],
  );

  const draft = await QuestionImportDraftModel.findById(draftId).lean();
  if (!draft) {
    return null;
  }

  const serializedDraft = serializeQuestionImportDraftRecord(draft);
  const mappedPayload = await applyWorkspaceQuestionImportMappings(
    schoolKey,
    serializedDraft.payload,
  );

  return {
    ...serializedDraft,
    payload: mappedPayload,
    status:
      serializedDraft.status === "published"
        ? "published"
        : deriveQuestionImportDraftStatus(mappedPayload),
  };
}

export async function applyWorkspaceQuestionImportMappings(
  schoolKey: string,
  payload: QuestionImportDraftRecord["payload"],
) {
  await connectDB();
  const nextPayload = syncQuestionImportMappings(payload);
  const {
    Class: ClassModel,
    Subject: SubjectModel,
    AcademicSection: AcademicSectionModel,
  } = await getTenantModels(schoolKey, ["Class", "Subject", "AcademicSection"]);

  const [classes, subjects] = await Promise.all([
    ClassModel.find(buildArchiveFilter(false)).select("_id name").lean(),
    SubjectModel.find(buildArchiveFilter(false)).select("_id name").lean(),
  ]);

  const classIdByName = new Map<string, string>();
  const availableClassIds = new Set<string>();
  classes.forEach((classItem: any) => {
    const classId = String(classItem?._id || "");
    classIdByName.set(
      normalizeComparableValue(classItem?.name),
      classId,
    );
    if (classId) {
      availableClassIds.add(classId);
    }
  });

  const selectedClassId = String(nextPayload.paper.classId || "").trim();
  const resolvedClassId =
    classIdByName.get(normalizeComparableValue(nextPayload.paper.classToken)) || "";
  nextPayload.paper.classId =
    selectedClassId && availableClassIds.has(selectedClassId)
      ? selectedClassId
      : resolvedClassId;

  const subjectIdByName = new Map<string, string>();
  subjects.forEach((subject: any) => {
    subjectIdByName.set(
      normalizeComparableValue(subject?.name),
      String(subject?._id || ""),
    );
  });

  nextPayload.mappings.subjects = nextPayload.mappings.subjects.map((mapping) => ({
    ...mapping,
    subjectId:
      mapping.subjectId ||
      subjectIdByName.get(normalizeComparableValue(mapping.token)) ||
      undefined,
  }));

  if (!nextPayload.paper.classId) {
    return nextPayload;
  }

  const academicSections = await AcademicSectionModel.find({
    class: nextPayload.paper.classId,
    isActive: true,
    ...buildArchiveFilter(false),
  })
    .select("_id name")
    .lean();

  const sectionIdByName = new Map<string, string>();
  academicSections.forEach((section: any) => {
    sectionIdByName.set(
      normalizeComparableValue(section?.name),
      String(section?._id || ""),
    );
  });

  nextPayload.mappings.academicSections =
    nextPayload.mappings.academicSections.map((mapping) => ({
      ...mapping,
      academicSectionId:
        mapping.academicSectionId ||
        sectionIdByName.get(normalizeComparableValue(mapping.token)) ||
        undefined,
    }));

  const validAcademicSectionIds = new Set<string>();
  academicSections.forEach((section: any) => {
    const sectionId = String(section?._id || "");
    if (sectionId) {
      validAcademicSectionIds.add(sectionId);
    }
  });

  nextPayload.paper.assignedAcademicSectionIds = (
    Array.isArray(nextPayload.paper.assignedAcademicSectionIds)
      ? nextPayload.paper.assignedAcademicSectionIds
      : []
  )
    .map((sectionId) => String(sectionId || "").trim())
    .filter((sectionId) => validAcademicSectionIds.has(sectionId));

  return nextPayload;
}
