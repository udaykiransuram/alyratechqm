export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import QuestionPaperResponse from "@/models/QuestionPaperResponse";
import QuestionPaper from "@/models/QuestionPaper";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  filterItemsByScopedSection,
  isSectionInScope,
  resolveTeacherPaperScope,
  toUniqueScopeIds,
} from "@/lib/question-paper/access";
import {
  getLegacyPaperSubject,
  resolvePaperSubjectIds,
  serializePaperSubjects,
} from "@/lib/question-paper/subjects";
import "@/models/User";
import "@/models/Subject";
import "@/models/TagType";
import "@/models/Tag";
import { buildTagReport } from "@/lib/analytics/tagReport";
import {
  buildAnalyticsTagLookup,
  resolveAnalyticsTags,
} from "@/lib/analytics/tag-resolution";
import { parseAnalyticsTagFilters } from "@/lib/analytics/tag-filters";
import {
  filterResponsesByAcademicSection,
  hydrateResponsesWithStudents,
} from "@/lib/analytics/hydrateResponses";
import {
  buildPaperQuestionLookup,
  evaluateQuestionAnswer,
} from "@/lib/question-paper/grading";
import { syncExamRuntimeMongoProjectionsForPaperWithCooldown } from "@/lib/exam-runtime-sync-cache";
import { requireTenantSession } from "@/lib/api-auth";
import { z } from "zod";
import { objectIdSchema, schoolKeySchema, parseOr400 } from "@/lib/validation";
import { withRequestBudget } from "@/lib/server/request-governor";

// Recursively deduplicate question ID arrays in stats
function dedupeStatsArrays(obj: any) {
  if (
    obj &&
    typeof obj === "object" &&
    "correct" in obj &&
    "incorrect" in obj &&
    "unattempted" in obj
  ) {
    if (Array.isArray(obj.correctQuestionIds))
      obj.correctQuestionIds = obj.correctQuestionIds.filter(
        (q: any, idx: number, arr: any[]) =>
          typeof q === "object"
            ? arr.findIndex(
                (qq) => typeof qq === "object" && qq.id === q.id,
              ) === idx
            : arr.indexOf(q) === idx,
      );
    if (Array.isArray(obj.incorrectQuestionIds))
      obj.incorrectQuestionIds = obj.incorrectQuestionIds.filter(
        (q: any, idx: number, arr: any[]) =>
          typeof q === "object"
            ? arr.findIndex(
                (qq) => typeof qq === "object" && qq.id === q.id,
              ) === idx
            : arr.indexOf(q) === idx,
      );
    if (Array.isArray(obj.unattemptedQuestionIds))
      obj.unattemptedQuestionIds = obj.unattemptedQuestionIds.filter(
        (q: any, idx: number, arr: any[]) =>
          typeof q === "object"
            ? arr.findIndex(
                (qq) => typeof qq === "object" && qq.id === q.id,
              ) === idx
            : arr.indexOf(q) === idx,
      );
    // Deduplicate optionTags by option+tag+isCorrect+student.rollNumber
    if (Array.isArray(obj.optionTags)) {
      obj.optionTags = obj.optionTags.filter(
        (tag: any, idx: number, arr: any[]) =>
          arr.findIndex(
            (t) =>
              t.option === tag.option &&
              t.tag === tag.tag &&
              t.isCorrect === tag.isCorrect &&
              (t.student?.rollNumber || "") === (tag.student?.rollNumber || ""),
          ) === idx,
      );
    }
    return;
  }
  if (obj && typeof obj === "object") {
    Object.values(obj).forEach(dedupeStatsArrays);
  }
}

function toIdString(value: any) {
  return String(value?._id || value || "").trim();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paperId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  const { paperId } = await params;

  const parsedSk = parseOr400(z.object({ schoolKey: schoolKeySchema }), {
    schoolKey,
  });
  if (!parsedSk.ok) {
    return NextResponse.json(
      { success: false, message: "schoolKey required" },
      { status: 400 },
    );
  }
  const tenantKey = schoolKey;

  // Validate params and query
  const groupByParam = req.nextUrl.searchParams.get("groupBy");
  const rawClassId = req.nextUrl.searchParams.get("classId")?.trim() || "";
  const rawAcademicSectionId =
    req.nextUrl.searchParams.get("academicSectionId")?.trim() || "";
  const rawSubjectId = req.nextUrl.searchParams.get("subjectId")?.trim() || "";
  const requestedTagFilters = parseAnalyticsTagFilters(
    req.nextUrl.searchParams.getAll("tag"),
  );
  if (rawClassId && !mongoose.Types.ObjectId.isValid(rawClassId)) {
    return NextResponse.json(
      { success: false, message: "Invalid classId" },
      { status: 400 },
    );
  }
  if (
    rawAcademicSectionId &&
    !mongoose.Types.ObjectId.isValid(rawAcademicSectionId)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid academicSectionId" },
      { status: 400 },
    );
  }
  if (rawSubjectId && !mongoose.Types.ObjectId.isValid(rawSubjectId)) {
    return NextResponse.json(
      { success: false, message: "Invalid subjectId" },
      { status: 400 },
    );
  }
  const filterAcademicSectionId = rawAcademicSectionId;
  const groupByParts = groupByParam
    ? groupByParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const querySchema = z.object({
    paperId: objectIdSchema,
    groupBy: z.array(z.string()).max(5).optional(),
    json: z.string().optional(),
    groupFields: z.string().optional(),
    classId: objectIdSchema.optional(),
    subjectId: objectIdSchema.optional(),
    academicSectionId: objectIdSchema.optional(),
    tags: z.array(z.string()).optional(),
  });
  const qRes = parseOr400(querySchema, {
    paperId,
    groupBy: groupByParts,
    json: req.nextUrl.searchParams.get("json"),
    groupFields: req.nextUrl.searchParams.get("groupFields"),
    classId: rawClassId || undefined,
    subjectId: rawSubjectId || undefined,
    academicSectionId: filterAcademicSectionId || undefined,
    tags: req.nextUrl.searchParams.getAll("tag"),
  });
  // Do not block on validation; proceed with best-effort to avoid hard failures in UI
  // If invalid, Mongoose will return null on findById which we handle with 404 below

  return withRequestBudget(
    {
      request: req,
      policy: "analyticsClassTagReport",
      schoolKey: tenantKey,
      userId: auth.session.user.id,
      scopeId: `${tenantKey}:${paperId}`,
    },
    async () => {
      try {
        await connectDB();

    const {
      QuestionPaperResponse: QPRModel,
      QuestionPaper: QPModel,
      Tag: TagModel,
      TagType: TagTypeModel,
      User: UserModel,
      AcademicSection: AcademicSectionModel,
      Class: ClassModel,
      Subject: SubjectModel,
    } = await getTenantModels(tenantKey, [
      "QuestionPaperResponse",
      "QuestionPaper",
      "Question",
      "Tag",
      "TagType",
      "User",
      "AcademicSection",
      "Class",
      "Subject",
    ]);
    const scopedUser = await UserModel.findById(auth.session.user.id)
      .select(
        "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
      )
      .lean();

    const groupBy = groupByParts;
    const groupFieldsOnly = req.nextUrl.searchParams.get("groupFields") === "1";

    if (groupFieldsOnly) {
      const paper = await QPModel.findById(paperId)
        .select("title class subject subjectIds sections assignedAcademicSections")
        .populate({
          path: "sections.questions.question",
          select: "tags subject class",
          populate: [
            {
              path: "tags",
              populate: { path: "type", select: "name" },
            },
            { path: "subject", model: SubjectModel, select: "name" },
            { path: "class", model: ClassModel, select: "name" },
          ],
        })
        .populate({ path: "subject", model: SubjectModel, select: "name" })
        .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
        .populate({
          path: "assignedAcademicSections",
          model: AcademicSectionModel,
          select: "name class",
          populate: { path: "class", model: ClassModel, select: "name" },
        })
        .lean();

      if (!paper || (Array.isArray(paper) && paper.length === 0)) {
        return NextResponse.json(
          { success: false, message: "Paper not found" },
          { status: 404 },
        );
      }

      const paperObj: any = Array.isArray(paper) ? paper[0] : paper;
      const assignedSectionIds = toUniqueScopeIds(
        paperObj?.assignedAcademicSections,
      );
      const paperScope = resolveTeacherPaperScope(
        scopedUser,
        toIdString(paperObj?.class),
        resolvePaperSubjectIds(paperObj),
        assignedSectionIds,
      );
      if (
        !paperScope.hasClassAccess ||
        !paperScope.hasSubjectAccess ||
        !paperScope.hasSectionAccess
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "You do not have access to analytics for this paper.",
          },
          { status: 403 },
        );
      }
      const paperSections = paperObj.sections || [];
      const paperDefaultSubject = getLegacyPaperSubject(paperObj);
      const tagLookup = await buildAnalyticsTagLookup({
        TagModel,
        TagTypeModel,
        paperSections,
      });
      const tagTypes = new Set<string>();
      const classMap = new Map<string, { value: string; label: string }>();
      const subjectMap = new Map<string, { value: string; label: string }>();
      paperSections.forEach((section: any) => {
        (section.questions || []).forEach((qWrap: any) => {
          const question = qWrap.question;
          const questionClassId = toIdString(question?.class);
          const subjectCandidate = question?.subject || paperDefaultSubject;
          const subjectId = toIdString(subjectCandidate);
          const isSubjectInScope =
            !paperScope.requiresSubjectIntersection ||
            paperScope.allowedSubjectIds.includes(subjectId);
          const matchesSelectedClass =
            !rawClassId || questionClassId === rawClassId;
          const matchesSelectedSubject =
            isSubjectInScope && (!rawSubjectId || subjectId === rawSubjectId);

          if (matchesSelectedClass && matchesSelectedSubject) {
            resolveAnalyticsTags(question?.tags || [], tagLookup).forEach(
              (tag) => {
                if (tag.type?.name) {
                  tagTypes.add(tag.type.name);
                }
              },
            );
          }

          if (questionClassId) {
            classMap.set(questionClassId, {
              value: questionClassId,
              label: question?.class?.name || "Unknown Class",
            });
          }
          if (
            subjectId &&
            (!paperScope.requiresSubjectIntersection ||
              paperScope.allowedSubjectIds.includes(subjectId))
          ) {
            subjectMap.set(subjectId, {
              value: subjectId,
              label: subjectCandidate?.name || "Unknown Subject",
            });
          }
        });
      });

      const fields = [
        { value: "section", label: "Section" },
        { value: "class", label: "Class" },
        { value: "subject", label: "Subject" },
        ...Array.from(tagTypes).map((type) => ({
          value: type.toLowerCase(),
          label: type,
        })),
      ];
      const configuredAcademicSections = Array.isArray(
        paperObj?.assignedAcademicSections,
      )
        ? paperObj.assignedAcademicSections
        : [];
      const fallbackAcademicSections =
        configuredAcademicSections.length === 0 && paperObj?.class
          ? await AcademicSectionModel.find({ class: paperObj.class })
              .select("name class")
              .sort({ name: 1 })
              .lean()
          : [];
      const academicSections = [
        ...configuredAcademicSections.map((section: any) => ({
          value: String(section?._id || ""),
          label: section?.name || "Unknown Section",
        })),
        ...fallbackAcademicSections.map((section: any) => ({
          value: String(section?._id || ""),
          label: section?.name || "Unknown Section",
        })),
      ]
        .filter((section: any) => section.value)
        .filter(
          (section: any) =>
            paperScope.allowedSectionIds === null ||
            paperScope.allowedSectionIds.includes(section.value),
        )
        .filter(
          (section: any, index: number, allSections: any[]) =>
            allSections.findIndex(
              (candidate) => candidate.value === section.value,
            ) === index,
        )
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      return NextResponse.json({
        fields,
        filters: {
          classes: Array.from(classMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
          academicSections,
          subjects: Array.from(subjectMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
        },
      });
    }

    let responses: any[] = [];
    let paperTitle = "";
    let students: any[] = [];
    let paperSections: any[] = [];
    let tagLookup = new Map();

    // --- Fetch paper and responses ---
    const paper = await QPModel.findById(paperId)
      .select("title class subject subjectIds sections assignedAcademicSections")
      .populate({
        path: "sections.questions.question",
        select: "tags content answerIndexes options subject class type matrixOptions matrixAnswers",
        populate: [
          {
            path: "tags",
            populate: { path: "type", select: "name" },
          },
          { path: "subject", model: SubjectModel, select: "name" },
          { path: "class", model: ClassModel, select: "name" },
        ],
      })
      .populate({ path: "subject", model: SubjectModel, select: "name" })
      .populate({ path: "subjectIds", model: SubjectModel, select: "name" })
      .populate({
        path: "assignedAcademicSections",
        model: AcademicSectionModel,
        select: "name class",
        populate: { path: "class", model: ClassModel, select: "name" },
      })
      .lean();

    if (!paper || (Array.isArray(paper) && paper.length === 0)) {
      return NextResponse.json(
        { success: false, message: "Paper not found" },
        { status: 404 },
      );
    }

    const paperObj: any = Array.isArray(paper) ? paper[0] : paper;
    tagLookup = await buildAnalyticsTagLookup({
      TagModel,
      TagTypeModel,
      paperSections: paperObj?.sections || [],
    });
    const assignedSectionIds = toUniqueScopeIds(paperObj?.assignedAcademicSections);
    const paperScope = resolveTeacherPaperScope(
      scopedUser,
      toIdString(paperObj?.class),
      resolvePaperSubjectIds(paperObj),
      assignedSectionIds,
    );

    if (
      !paperScope.hasClassAccess ||
      !paperScope.hasSubjectAccess ||
      !paperScope.hasSectionAccess
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have access to analytics for this paper.",
        },
        { status: 403 },
      );
    }
    if (
      filterAcademicSectionId &&
      !isSectionInScope(filterAcademicSectionId, paperScope.allowedSectionIds)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have access to analytics for the selected section.",
        },
        { status: 403 },
      );
    }

    if (
      rawSubjectId &&
      paperScope.requiresSubjectIntersection &&
      !paperScope.allowedSubjectIds.includes(rawSubjectId)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "You do not have access to analytics for the selected subject.",
        },
        { status: 403 },
      );
    }

    paperTitle = paperObj.title || "";
    paperSections = paperObj.sections || [];
    const questionLookup = buildPaperQuestionLookup({ sections: paperSections });

    void syncExamRuntimeMongoProjectionsForPaperWithCooldown(
      tenantKey,
      paperId,
      { minIntervalMs: 60_000 },
    ).catch((error) => {
      console.error(
        "Failed to sync exam runtime attempts into Mongo projections for class analytics:",
        error,
      );
      return new Map<string, string>();
    });

    responses = await QPRModel.find({ paper: paperId })
      .populate({
        path: "sectionAnswers.answers.question",
        select: "answerIndexes tags content options type matrixOptions matrixAnswers",
        populate: {
          path: "tags",
          populate: { path: "type", select: "name" },
        },
      })
      .lean();

    responses = await hydrateResponsesWithStudents({
      responses,
      UserModel,
      AcademicSectionModel,
      ClassModel,
      studentSelect: "name rollNumber academicSection",
    });

    responses = filterItemsByScopedSection(
      responses,
      (response: any) =>
        response?.student?.academicSection?._id ||
        response?.student?.academicSection,
      paperScope.allowedSectionIds,
    );

    responses = filterResponsesByAcademicSection(
      responses,
      filterAcademicSectionId,
    );

    students = responses.map((response: any) => response.student).filter(Boolean);

    // --- Aggregate per-question stats for class level ---
    let questionStats: Record<
      string,
      {
        correct: number;
        incorrect: number;
        unattempted: number;
        correctStudents: any[];
        incorrectStudents: any[];
        unattemptedStudents: any[];
        correctQuestionIds?: any[];
        incorrectQuestionIds?: any[];
        unattemptedQuestionIds?: any[];
        optionTags?: any[];
      }
    > = {};

    for (const response of responses) {
      const studentInfo = {
        name: response.student?.name || "",
        rollNumber: response.student?.rollNumber || "",
      };
      const answerMap: Record<string, Record<string, any>> = {};
      (response.sectionAnswers || []).forEach((section: any) => {
        answerMap[section.sectionName] = {};
        (section.answers || []).forEach((ans: any) => {
          answerMap[section.sectionName][
            String(ans.question?._id || ans.question)
          ] = ans;
        });
      });

      for (const paperSection of paperSections) {
        const sectionName = paperSection.name;
        const questions = paperSection.questions || [];
        for (const qWrap of questions) {
          const question = qWrap.question;
          if (!question || !question._id) continue;
          const qid = String(question._id);
          const ans = answerMap[sectionName]?.[qid];
          const evaluation = evaluateQuestionAnswer(
            questionLookup.get(`${sectionName}::${qid}`),
            ans,
          );
          const attempted = evaluation.attempted;
          const isCorrect = evaluation.isCorrect;
          if (!questionStats[qid])
            questionStats[qid] = {
              correct: 0,
              incorrect: 0,
              unattempted: 0,
              correctStudents: [],
              incorrectStudents: [],
              unattemptedStudents: [],
            };
          if (!attempted) {
            questionStats[qid].unattempted += 1;
            questionStats[qid].unattemptedStudents.push(studentInfo);
          } else if (isCorrect) {
            questionStats[qid].correct += 1;
            questionStats[qid].correctStudents.push(studentInfo);
          } else {
            questionStats[qid].incorrect += 1;
            questionStats[qid].incorrectStudents.push(studentInfo);
          }
        }
      }
    }

    // --- Aggregate stats using shared helper ---
    const stats = buildTagReport({
      responses,
      paperSections,
      groupBy,
      isClassLevel: true,
      questionStats,
      filters: {
        classId: rawClassId || undefined,
        subjectId: rawSubjectId || undefined,
        subjectIds: paperScope.requiresSubjectIntersection
          ? paperScope.allowedSubjectIds
          : undefined,
        tagFilters: requestedTagFilters,
        paperDefaultSubject: getLegacyPaperSubject(paperObj),
      },
      tagLookup,
    });
    const paperSubjects = serializePaperSubjects(paperObj);

    if (req.nextUrl.searchParams.get("json") === "1") {
      dedupeStatsArrays(stats);
      // Optional compact mode to reduce payload: aggregate students at group-level and prune per-question arrays
      if (req.nextUrl.searchParams.get("compact") === "1") {
        const aggregateAndPrune = (node: any) => {
          if (!node || typeof node !== "object") return;
          const hasCounts =
            "correct" in node && "incorrect" in node && "unattempted" in node;
          if (hasCounts) {
            const collect = (
              arr: any[] | undefined,
              key:
                | "correctStudents"
                | "incorrectStudents"
                | "unattemptedStudents",
            ) => {
              const students: { name: string; rollNumber: string }[] = [];
              if (Array.isArray(arr)) {
                arr.forEach((q: any) => {
                  if (Array.isArray(q?.[key])) students.push(...q[key]);
                });
              }
              const map = new Map<
                string,
                { name: string; rollNumber: string }
              >();
              students.forEach((s) => {
                const k = `${s.rollNumber}|${s.name}`;
                if (!map.has(k)) map.set(k, s);
              });
              return Array.from(map.values());
            };
            const correctAgg = collect(
              node.correctQuestionIds,
              "correctStudents",
            );
            const incorrectAgg = collect(
              node.incorrectQuestionIds,
              "incorrectStudents",
            );
            const unattemptedAgg = collect(
              node.unattemptedQuestionIds,
              "unattemptedStudents",
            );
            if (correctAgg.length) node.correctStudents = correctAgg;
            if (incorrectAgg.length) node.incorrectStudents = incorrectAgg;
            if (unattemptedAgg.length)
              node.unattemptedStudents = unattemptedAgg;
            if (Array.isArray(node.correctQuestionIds)) {
              node.correctQuestionIds = node.correctQuestionIds.map(
                (q: any) => ({
                  id: q.id,
                  number: q.number,
                  section: q.section,
                }),
              );
            }
            if (Array.isArray(node.incorrectQuestionIds)) {
              node.incorrectQuestionIds = node.incorrectQuestionIds.map(
                (q: any) => ({
                  id: q.id,
                  number: q.number,
                  section: q.section,
                }),
              );
            }
            if (Array.isArray(node.unattemptedQuestionIds)) {
              node.unattemptedQuestionIds = node.unattemptedQuestionIds.map(
                (q: any) => ({
                  id: q.id,
                  number: q.number,
                  section: q.section,
                }),
              );
            }
          }
          Object.values(node).forEach(aggregateAndPrune);
        };
        aggregateAndPrune(stats);
      }
      const responsePayload = {
        success: true,
        stats,
        students,
        paper: paperTitle,
        paperSubjects: paperSubjects.subjects,
      };
      const res = NextResponse.json(responsePayload);
      try {
        res.headers.set("X-Stats-Bytes", String(JSON.stringify(stats).length));
      } catch {}
      return res;
    }

    // PDF generation (optional, similar to student route)
    // ...implement if needed...

        return NextResponse.json({
          success: true,
          stats,
          students,
          paper: paperTitle,
          paperSubjects: paperSubjects.subjects,
        });
      } catch (error: any) {
        console.error("Error in class analytics route:", error);
        return NextResponse.json(
          { success: false, message: error.message },
          { status: 500 },
        );
      }
    },
  );
}
