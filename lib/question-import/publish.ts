import { buildArchiveFilter } from "@/lib/archive";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  buildStoredPaperSubjectFields,
  derivePaperSubjectIdsFromQuestions,
} from "@/lib/question-paper/subjects";
import {
  calculateSectionTotalMarks,
  deriveSectionDefaultMarks,
  deriveSectionDefaultNegativeMarks,
} from "@/lib/question-paper/sections";
import { resolveTeacherPaperScope } from "@/lib/question-paper/access";
import {
  sanitizeQuestionOptions,
  sanitizeRichTextHtml,
  sanitizeRichTextToPlainText,
} from "@/lib/security/html-sanitize";
import type { QuestionImportDraftRecord } from "@/lib/question-import/types";
import {
  getIncludedQuestionImportQuestions,
  getQuestionImportBlockingWarnings,
  getQuestionImportUnmappedMathFragments,
  syncQuestionImportMappings,
} from "@/lib/question-import/review";

function normalizeName(value: unknown) {
  return String(value || "").trim();
}

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

function normalizeSubjectCode(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function normalizeAcademicSectionAssignmentMode(value: unknown) {
  return normalizeName(value).toLowerCase() === "selected"
    ? "selected"
    : "all";
}

function validatePublishableDraft(draft: QuestionImportDraftRecord) {
  const payload = syncQuestionImportMappings(draft.payload);
  const blockingErrors = getQuestionImportBlockingWarnings(payload);

  if (blockingErrors.length > 0) {
    const firstError = blockingErrors[0];
    throw new Error(firstError.message || "Resolve the blocking import issues before publish.");
  }

  const unresolvedMath = getQuestionImportUnmappedMathFragments(payload)[0];
  if (unresolvedMath) {
    throw new Error(
      "Resolve the remaining unmapped math expressions before publish.",
    );
  }

  const includedQuestions = getIncludedQuestionImportQuestions(payload);

  if (includedQuestions.length === 0) {
    throw new Error("Approve at least one question before publish.");
  }

  const unapprovedQuestion = includedQuestions.find(
    (question) => question.approvalStatus !== "approved",
  );
  if (unapprovedQuestion) {
    throw new Error("All included questions must be approved before publish.");
  }

  const questionMissingSubjectToken = includedQuestions.find(
    (question) => !normalizeName(question.subjectToken),
  );
  if (questionMissingSubjectToken) {
    throw new Error(
      `Question ${questionMissingSubjectToken.numberLabel} is missing a subject token.`,
    );
  }

  if (!normalizeName(payload.paper?.title)) {
    throw new Error("Paper title is required before publish.");
  }

  if (!normalizeId(payload.paper?.classId)) {
    throw new Error("Map the paper class before publish.");
  }

  if (!normalizeName(payload.paper?.examDate)) {
    throw new Error("Set the paper exam date before publish.");
  }

  if (
    normalizeAcademicSectionAssignmentMode(
      payload.paper?.academicSectionAssignmentMode,
    ) === "selected" &&
    !(Array.isArray(payload.paper?.assignedAcademicSectionIds)
      ? payload.paper.assignedAcademicSectionIds
      : []
    )
      .map(normalizeId)
      .filter(Boolean).length
  ) {
    throw new Error(
      "Choose at least one academic section or switch back to all sections before publish.",
    );
  }

  return includedQuestions;
}

async function resolveSubjectMappings(
  SubjectModel: any,
  subjectMappings: QuestionImportDraftRecord["payload"]["mappings"]["subjects"],
) {
  const resolved = new Map<string, string>();
  const tokens = Array.from(
    new Set(
      (Array.isArray(subjectMappings) ? subjectMappings : [])
        .map((mapping) => normalizeName(mapping?.token || ""))
        .filter(Boolean),
    ),
  );

  if (!tokens.length) {
    return resolved;
  }

  const existingSubjects = await SubjectModel.find({
    name: { $in: tokens },
    ...buildArchiveFilter(false),
  })
    .select("_id name")
    .lean();

  const existingByName = new Map<string, string>();
  existingSubjects.forEach((subject: any) => {
    existingByName.set(normalizeName(subject?.name), normalizeId(subject?._id));
  });

  for (const mapping of subjectMappings || []) {
    const token = normalizeName(mapping?.token || "");
    if (!token) continue;

    if (normalizeId(mapping?.subjectId)) {
      resolved.set(token, normalizeId(mapping?.subjectId));
      continue;
    }

    const existingId = existingByName.get(token);
    if (existingId) {
      resolved.set(token, existingId);
      continue;
    }

    if (!mapping?.createIfMissing) {
      throw new Error(`Map the subject "${token}" before publish.`);
    }

    const createdSubject = await SubjectModel.create({
      name: token,
      code: normalizeSubjectCode(token),
      tags: [],
    });
    resolved.set(token, normalizeId(createdSubject?._id));
  }

  return resolved;
}

async function resolveAssignedAcademicSections(
  AcademicSectionModel: any,
  classId: string,
  assignmentMode: unknown,
  assignedAcademicSectionIds: string[],
) {
  if (normalizeAcademicSectionAssignmentMode(assignmentMode) !== "selected") {
    return [] as string[];
  }

  const resolvedIds = Array.from(
    new Set(
      (Array.isArray(assignedAcademicSectionIds)
        ? assignedAcademicSectionIds
        : []
      )
        .map((sectionId) => normalizeId(sectionId))
        .filter(Boolean),
    ),
  );

  if (!resolvedIds.length) {
    throw new Error(
      "Choose at least one academic section or switch back to all sections before publish.",
    );
  }

  const sections = await AcademicSectionModel.find({
    _id: { $in: resolvedIds },
    class: classId,
    isActive: true,
    ...buildArchiveFilter(false),
  })
    .select("_id")
    .lean();

  if (sections.length !== resolvedIds.length) {
    throw new Error(
      "Assigned academic sections must exist, be active, and belong to the selected class.",
    );
  }

  return resolvedIds;
}

async function ensureTagGraphForQuestions(
  TagTypeModel: any,
  TagModel: any,
  SubjectModel: any,
  questions: Array<{
    subjectId: string;
    tagPairs: Array<{ type: string; value: string }>;
  }>,
) {
  const tagTypeNames = Array.from(
    new Set(
      questions.flatMap((question) =>
        question.tagPairs
          .map((pair) => normalizeName(pair.type).toLowerCase())
          .filter(Boolean),
      ),
    ),
  );

  const tagTypes = await TagTypeModel.find({
    name: { $in: tagTypeNames },
  })
    .select("_id name")
    .lean();
  const tagTypeIds = new Map<string, string>();
  tagTypes.forEach((tagType: any) => {
    tagTypeIds.set(
      normalizeName(tagType?.name).toLowerCase(),
      normalizeId(tagType?._id),
    );
  });

  for (const name of tagTypeNames) {
    if (tagTypeIds.has(name)) continue;
    const createdTagType = await TagTypeModel.findOneAndUpdate(
      { name },
      { $setOnInsert: { name } },
      { upsert: true, new: true },
    );
    tagTypeIds.set(name, normalizeId(createdTagType?._id));
  }

  const uniqueTagKeys = Array.from(
    new Set(
      questions.flatMap((question) =>
        question.tagPairs
          .map((pair) => ({
            type: normalizeName(pair.type).toLowerCase(),
            value: normalizeName(pair.value),
          }))
          .filter((pair) => pair.type && pair.value)
          .map((pair) => `${pair.value}|||${pair.type}`),
      ),
    ),
  );

  const existingTags = await TagModel.find({
    name: { $in: uniqueTagKeys.map((key) => key.split("|||")[0]) },
  })
    .select("_id name type")
    .lean();

  const tagIds = new Map<string, string>();
  existingTags.forEach((tag: any) => {
    const matchingType = Array.from(tagTypeIds.entries()).find(
      ([, tagTypeId]) => tagTypeId === normalizeId(tag?.type),
    )?.[0];
    if (!matchingType) return;
    tagIds.set(
      `${normalizeName(tag?.name)}|||${matchingType}`,
      normalizeId(tag?._id),
    );
  });

  for (const key of uniqueTagKeys) {
    if (tagIds.has(key)) continue;
    const [value, typeName] = key.split("|||");
    const createdTag = await TagModel.findOneAndUpdate(
      { name: value, type: tagTypeIds.get(typeName) },
      { $setOnInsert: { name: value, type: tagTypeIds.get(typeName) } },
      { upsert: true, new: true },
    );
    tagIds.set(key, normalizeId(createdTag?._id));
  }

  const subjectTagAssignments = new Map<string, Set<string>>();
  questions.forEach((question) => {
    const assignedIds = question.tagPairs
      .map((pair) =>
        tagIds.get(
          `${normalizeName(pair.value)}|||${normalizeName(pair.type).toLowerCase()}`,
        ),
      )
      .filter(Boolean) as string[];

    if (!subjectTagAssignments.has(question.subjectId)) {
      subjectTagAssignments.set(question.subjectId, new Set<string>());
    }

    assignedIds.forEach((tagId) => {
      subjectTagAssignments.get(question.subjectId)?.add(tagId);
    });
  });

  for (const [subjectId, subjectTagIds] of subjectTagAssignments.entries()) {
    const subjectDoc = await SubjectModel.findById(subjectId).select("tags").lean();
    const mergedTagIds = Array.from(
      new Set([
        ...(Array.isArray(subjectDoc?.tags)
          ? subjectDoc.tags.map((tagId: unknown) => normalizeId(tagId))
          : []),
        ...Array.from(subjectTagIds),
      ]),
    );
    await SubjectModel.findByIdAndUpdate(subjectId, {
      $set: { tags: mergedTagIds },
    });
  }

  return tagIds;
}

export async function publishQuestionImportDraft({
  schoolKey,
  actorId,
  viewerRole,
  draft,
}: {
  schoolKey: string;
  actorId: string;
  viewerRole: "admin" | "teacher";
  draft: QuestionImportDraftRecord;
}) {
  await connectDB();
  const normalizedDraft = {
    ...draft,
    payload: syncQuestionImportMappings(draft.payload),
  };

  const {
    QuestionImportDraft: QuestionImportDraftModel,
    Question: QuestionModel,
    QuestionPaper: QuestionPaperModel,
    Subject: SubjectModel,
    Class: ClassModel,
    AcademicSection: AcademicSectionModel,
    User: UserModel,
    Tag: TagModel,
    TagType: TagTypeModel,
  } = await getTenantModels(schoolKey, [
    "QuestionImportDraft",
    "Question",
    "QuestionPaper",
    "Subject",
    "Class",
    "AcademicSection",
    "User",
    "Tag",
    "TagType",
  ]);

  const includedQuestions = validatePublishableDraft(normalizedDraft);
  const classId = normalizeId(normalizedDraft.payload.paper.classId);

  const classDoc = await ClassModel.findById(classId).select("_id").lean();
  if (!classDoc) {
    throw new Error("The selected class could not be found.");
  }

  const subjectIdByToken = await resolveSubjectMappings(
    SubjectModel,
    normalizedDraft.payload.mappings.subjects,
  );
  const assignedAcademicSectionIds = await resolveAssignedAcademicSections(
    AcademicSectionModel,
    classId,
    normalizedDraft.payload.paper.academicSectionAssignmentMode,
    normalizedDraft.payload.paper.assignedAcademicSectionIds,
  );

  const questionPublishInput = includedQuestions.map((question) => {
    const subjectToken = normalizeName(question.subjectToken || "");
    const subjectId = subjectIdByToken.get(subjectToken);
    if (!subjectId) {
      throw new Error(
        `Map the subject "${subjectToken || "Unknown"}" before publish.`,
      );
    }

    const tagPairs = [
      question.metadata?.difficulty
        ? { type: "difficulty", value: question.metadata.difficulty }
        : null,
      question.metadata?.topic
        ? { type: "topic", value: question.metadata.topic }
        : null,
      question.metadata?.templateId
        ? { type: "templateid", value: question.metadata.templateId }
        : null,
      ...((Array.isArray(question.metadata?.customTags)
        ? question.metadata.customTags
        : []) || []),
    ].filter(Boolean) as Array<{ type: string; value: string }>;

    return {
      draftQuestion: question,
      subjectId,
      tagPairs,
    };
  });

  const tagIdByPair = await ensureTagGraphForQuestions(
    TagTypeModel,
    TagModel,
    SubjectModel,
    questionPublishInput.map((item) => ({
      subjectId: item.subjectId,
      tagPairs: item.tagPairs,
    })),
  );

  if (viewerRole === "teacher") {
    const scopedUser = await UserModel.findById(actorId)
      .select(
        "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
      )
      .lean();

    const paperSubjectIds = Array.from(new Set(questionPublishInput.map((item) => item.subjectId)));
    const teacherScope = resolveTeacherPaperScope(
      scopedUser,
      classId,
      paperSubjectIds,
      assignedAcademicSectionIds,
    );

    if (
      !teacherScope.hasClassAccess ||
      !teacherScope.hasSubjectAccess ||
      !teacherScope.hasSectionAccess
    ) {
      throw new Error(
        "You can only create imported papers inside your assigned class, subject, and section scope.",
      );
    }
  }

  const createdQuestionIds: string[] = [];

  try {
    const questionDocuments = await QuestionModel.insertMany(
      questionPublishInput.map((item) => {
        const question = item.draftQuestion;
        const options = sanitizeQuestionOptions(
          (Array.isArray(question.options) ? question.options : []).map((option) => ({
            content: option.contentHtml,
          })),
        );

        if (
          (question.type === "single" || question.type === "multiple") &&
          options.length < 2
        ) {
          throw new Error(
            `Question ${question.numberLabel} needs at least two options before publish.`,
          );
        }

        if (
          question.type !== "descriptive" &&
          (!Array.isArray(question.answerIndexes) ||
            question.answerIndexes.length === 0)
        ) {
          throw new Error(
            `Question ${question.numberLabel} needs at least one correct answer before publish.`,
          );
        }

        return {
          subject: item.subjectId,
          class: classId,
          tags: item.tagPairs
            .map((pair) =>
              tagIdByPair.get(
                `${normalizeName(pair.value)}|||${normalizeName(pair.type).toLowerCase()}`,
              ),
            )
            .filter(Boolean),
          content: sanitizeRichTextHtml(question.contentHtml),
          options:
            question.type === "single" || question.type === "multiple"
              ? options
              : undefined,
          answerIndexes:
            question.type === "single" || question.type === "multiple"
              ? question.answerIndexes
              : undefined,
          explanation: sanitizeRichTextHtml(question.explanationHtml),
          marks: question.marks,
          type: question.type,
          createdBy: actorId,
        };
      }),
    );

    createdQuestionIds.push(
      ...questionDocuments.map((question: any) => normalizeId(question?._id)),
    );

    const questionsByDraftId = new Map(
      questionPublishInput.map((item, index) => [
        item.draftQuestion.id,
        questionDocuments[index],
      ]),
    );

    const sectionsForPaper = (Array.isArray(normalizedDraft.payload.paperSections)
      ? normalizedDraft.payload.paperSections
      : [])
      .map((section) => {
        const sectionQuestions = questionPublishInput
          .filter((item) => item.draftQuestion.sectionId === section.id)
          .map((item) => ({
            question: normalizeId(questionsByDraftId.get(item.draftQuestion.id)?._id),
            marks: item.draftQuestion.marks,
            negativeMarks: item.draftQuestion.negativeMarks || 0,
          }))
          .filter((entry) => entry.question);

        return {
          name: normalizeName(section.name),
          description: sanitizeRichTextToPlainText(section.descriptionHtml),
          instructions: sanitizeRichTextToPlainText(section.instructionsHtml),
          defaultMarks: deriveSectionDefaultMarks(
            {
              defaultMarks: section.defaultMarks,
              questions: sectionQuestions,
            },
            1,
          ),
          defaultNegativeMarks: deriveSectionDefaultNegativeMarks(
            {
              defaultNegativeMarks: section.defaultNegativeMarks,
              questions: sectionQuestions,
            },
            0,
          ),
          marks: calculateSectionTotalMarks({ questions: sectionQuestions }),
          questions: sectionQuestions,
        };
      })
      .filter((section) => section.questions.length > 0);

    if (!sectionsForPaper.length) {
      throw new Error("At least one approved question is required to create a paper.");
    }

    const questionLeanValues = questionDocuments.map((question: any) => ({
      _id: question?._id,
      subject: question?.subject,
      type: question?.type,
    }));
    const subjectFields = buildStoredPaperSubjectFields(
      derivePaperSubjectIdsFromQuestions(questionLeanValues),
    );

    const paper = await QuestionPaperModel.create({
      title: normalizedDraft.payload.paper.title,
      instructions: sanitizeRichTextToPlainText(
        normalizedDraft.payload.paper.instructionsHtml,
      ),
      class: classId,
      ...subjectFields,
      duration: Number(normalizedDraft.payload.paper.durationMinutes || 60),
      passingMarks: Number(normalizedDraft.payload.paper.passingMarks || 0),
      examDate: normalizedDraft.payload.paper.examDate,
      onlineEnabled: false,
      totalMarks: sectionsForPaper.reduce(
        (sum: number, section: any) => sum + Number(section.marks || 0),
        0,
      ),
      sections: sectionsForPaper,
      assignedAcademicSections: assignedAcademicSectionIds,
      createdBy: actorId,
    });

    await QuestionImportDraftModel.findByIdAndUpdate(draft._id, {
      $set: {
        status: "published",
        payload: normalizedDraft.payload,
        publishedQuestionIds: createdQuestionIds,
        publishedPaperId: paper?._id || null,
        updatedBy: actorId,
      },
    });

    return {
      questionIds: createdQuestionIds,
      paperId: normalizeId(paper?._id),
    };
  } catch (error) {
    if (createdQuestionIds.length > 0) {
      await QuestionModel.deleteMany({
        _id: { $in: createdQuestionIds },
      }).catch(() => undefined);
    }

    throw error;
  }
}
