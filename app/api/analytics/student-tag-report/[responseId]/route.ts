export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import QuestionPaperResponse from "@/models/QuestionPaperResponse";
import QuestionPaper from "@/models/QuestionPaper";
import PDFDocument from "pdfkit";
import { Readable } from "stream";
import path from "node:path";
import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveExamRuntimeMongoResponseIdWithCooldown } from "@/lib/exam-runtime-sync-cache";
import {
  filterItemsByScopedSection,
  isSectionInScope,
  resolveTeacherPaperScope,
  toUniqueScopeIds,
} from "@/lib/question-paper/access";
import {
  getLegacyPaperSubject,
  resolvePaperSubjectIds,
} from "@/lib/question-paper/subjects";
import { isStudentResultReleasedForPaper } from "@/lib/student-tests";
import "@/models/User";
import "@/models/Subject";
import "@/models/Class";
import "@/models/TagType";
import "@/models/Tag";
import { buildTagReport } from "@/lib/analytics/tagReport";
import {
  buildAnalyticsTagLookup,
  resolveAnalyticsTags,
} from "@/lib/analytics/tag-resolution";
import {
  filterResponsesByAcademicSection,
  getStudentAcademicSectionId,
  hydrateResponsesWithStudents,
} from "@/lib/analytics/hydrateResponses";
import {
  buildPaperQuestionLookup,
  evaluateQuestionAnswer,
} from "@/lib/question-paper/grading";
import { z } from "zod";
import { objectIdSchema, parseOr400 } from "@/lib/validation";
import { toBinaryResponseBody } from "@/lib/server/binary-response";
import { withRequestBudget } from "@/lib/server/request-governor";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";

type ScopedAnalyticsUser = {
  hasAllClasses?: boolean;
  classIds?: any[];
  hasAllSubjects?: boolean;
  subjectIds?: any[];
  hasAllSections?: boolean;
  academicSectionIds?: any[];
};

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ responseId: string }> },
) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher", "student"],
  });
  if (!auth.ok) return auth.response;

  const tenantKey = auth.schoolKey as string;
  const { responseId } = await params;
  let resolvedResponseId = String(responseId || "").trim();
  if (
    resolvedResponseId &&
    !mongoose.Types.ObjectId.isValid(resolvedResponseId)
  ) {
    resolvedResponseId =
      (await resolveExamRuntimeMongoResponseIdWithCooldown(
        tenantKey,
        resolvedResponseId,
      )) ||
      resolvedResponseId;
  }
  const isStudentSession = auth.session.user.role === "student";
  if (isStudentSession) {
    const accessCheck = await assertSummerCrashStudentApiAccess({
      schoolKey: tenantKey,
      studentId: auth.session.user.id,
      target: {
        kind: "diagnostic-report",
        responseId: resolvedResponseId,
      },
    });
    if (!accessCheck.allowed) {
      return NextResponse.json(
        { success: false, message: accessCheck.message },
        { status: 403 },
      );
    }
  }

  const responseQuery = isStudentSession
    ? { _id: resolvedResponseId, student: auth.session.user.id }
    : { _id: resolvedResponseId };

  // Validate params and query
  const groupByParam = req.nextUrl.searchParams.get("groupBy");
  const filterClassId = req.nextUrl.searchParams.get("classId")?.trim() || "";
  const filterSubjectId = req.nextUrl.searchParams.get("subjectId")?.trim() || "";
  const rawAcademicSectionId =
    req.nextUrl.searchParams.get("academicSectionId")?.trim() || "";
  if (
    rawAcademicSectionId &&
    !mongoose.Types.ObjectId.isValid(rawAcademicSectionId)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid academicSectionId" },
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
  const jsonParam = req.nextUrl.searchParams.get("json") || undefined;
  const groupFieldsParam =
    req.nextUrl.searchParams.get("groupFields") || undefined;
  const classLevelParam =
    req.nextUrl.searchParams.get("classLevel") || undefined;

  if (!mongoose.Types.ObjectId.isValid(resolvedResponseId)) {
    return NextResponse.json(
      { success: false, message: "Invalid responseId." },
      { status: 400 },
    );
  }

  const querySchema = z.object({
    responseId: objectIdSchema,
    groupBy: z.array(z.string()).max(5).optional(),
    json: z.string().optional(),
    groupFields: z.string().optional(),
    classLevel: z.string().optional(),
    classId: z.string().optional(),
    subjectId: z.string().optional(),
    academicSectionId: objectIdSchema.optional(),
  });
  const qRes = parseOr400(querySchema, {
    responseId: resolvedResponseId,
    groupBy: groupByParts,
    json: jsonParam,
    groupFields: groupFieldsParam,
    classLevel: classLevelParam,
    classId: filterClassId || undefined,
    subjectId: filterSubjectId || undefined,
    academicSectionId: filterAcademicSectionId || undefined,
  });
  if (!qRes.ok) {
    return NextResponse.json(
      { success: false, message: qRes.message || "Invalid responseId." },
      { status: qRes.status || 400 },
    );
  }

  return withRequestBudget(
    {
      request: req,
      policy: "analyticsStudentTagReport",
      schoolKey: tenantKey,
      userId: auth.session.user.id,
      scopeId: `${tenantKey}:${resolvedResponseId}`,
    },
    async () => {
      // --- Handle groupFields=1 for dynamic grouping options ---

      // Resolve tenant-bound models consistently with other APIs
      // Ensure related models (Question, Tag, TagType) are registered on the tenant connection
      const {
        QuestionPaperResponse: QPRModel,
        QuestionPaper: QPModel,
        Tag: TagModel,
        TagType: TagTypeModel,
        User: UserModel,
        Class: ClassModel,
        AcademicSection: AcademicSectionModel,
      } = await getTenantModels(tenantKey, [
        "QuestionPaperResponse",
        "QuestionPaper",
        "Question",
        "Tag",
        "TagType",
        "Subject",
        "Class",
        "User",
        "AcademicSection",
      ]);
      const scopedUser: ScopedAnalyticsUser | null = !isStudentSession
        ? ((await UserModel.findById(auth.session.user.id)
            .select(
              "hasAllClasses classIds hasAllSubjects subjectIds hasAllSections academicSectionIds",
            )
            .lean()) as ScopedAnalyticsUser | null)
        : null;

      if (req.nextUrl.searchParams.get("groupFields") === "1") {
        try {
      const response = await QPRModel.findOne(responseQuery)
        .populate({
          path: "paper",
          select:
            "title class subject subjectIds sections assignedAcademicSections onlineEnabled onlineEndsAt",
          populate: [
            {
              path: "sections.questions.question",
              select: "tags subject class",
              populate: [
                {
                  path: "tags",
                  populate: { path: "type", select: "name" },
                },
                { path: "subject", select: "name" },
                { path: "class", select: "name" },
              ],
            },
            {
              path: "assignedAcademicSections",
              select: "name class",
            },
            {
              path: "subject",
              select: "name",
            },
            {
              path: "subjectIds",
              select: "name",
            },
          ],
        })
        .lean();

      if (!response) {
        return NextResponse.json(
          { success: false, message: "Response not found." },
          { status: 404 },
        );
      }

      const paperObj = Array.isArray(response)
        ? response[0]?.paper
        : response?.paper;
      if (
        isStudentSession &&
        paperObj?.onlineEnabled &&
        !isStudentResultReleasedForPaper(paperObj)
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This report is not available until the online test window closes.",
          },
          { status: 403 },
        );
      }
      let teacherScope:
        | ReturnType<typeof resolveTeacherPaperScope>
        | null = null;
      if (!isStudentSession) {
        teacherScope = resolveTeacherPaperScope(
          scopedUser,
          String(paperObj?.class?._id || paperObj?.class || "").trim(),
          resolvePaperSubjectIds(paperObj),
          toUniqueScopeIds(paperObj?.assignedAcademicSections),
        );

        if (
          !teacherScope.hasClassAccess ||
          !teacherScope.hasSubjectAccess ||
          !teacherScope.hasSectionAccess
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "You do not have access to analytics for this paper.",
            },
            { status: 403 },
          );
        }
      }
      const paperSections = Array.isArray(response)
        ? response[0]?.paper?.sections || []
        : response?.paper?.sections || [];
      const paperDefaultSubject = getLegacyPaperSubject(paperObj);
      const tagLookup = await buildAnalyticsTagLookup({
        TagModel,
        TagTypeModel,
        paperSections,
      });
      const tagTypeSet = new Set<string>();
      const classMap = new Map<string, { value: string; label: string }>();
      const subjectMap = new Map<string, { value: string; label: string }>();

      paperSections.forEach((section: any) => {
        (section.questions || []).forEach((qWrap: any) => {
          const question = qWrap.question;
          const questionClassId = String(
            question?.class?._id || question?.class || "",
          ).trim();
          const subjectCandidate = question?.subject || paperDefaultSubject;
          const candidateSubjectId = String(subjectCandidate?._id || "").trim();
          const isSubjectInScope =
            isStudentSession ||
            !teacherScope?.requiresSubjectIntersection ||
            teacherScope.allowedSubjectIds.includes(candidateSubjectId);
          const matchesSelectedClass =
            !filterClassId || questionClassId === filterClassId;
          const matchesSelectedSubject =
            isSubjectInScope &&
            (!filterSubjectId || candidateSubjectId === filterSubjectId);

          if (matchesSelectedClass && matchesSelectedSubject) {
            resolveAnalyticsTags(question?.tags || [], tagLookup).forEach(
              (tag) => {
                if (tag.type?.name) {
                  tagTypeSet.add(tag.type.name);
                }
              },
            );
          }

          if (question?.class?._id) {
            classMap.set(String(question.class._id), {
              value: String(question.class._id),
              label: question.class.name || "Unknown Class",
            });
          }
          if (subjectCandidate?._id) {
            if (
              isStudentSession ||
              !scopedUser ||
              Boolean(scopedUser?.hasAllSubjects) ||
              (Array.isArray(scopedUser?.subjectIds) &&
                scopedUser.subjectIds.some(
                  (subjectId: any) => String(subjectId || "") === candidateSubjectId,
                ))
            ) {
              subjectMap.set(candidateSubjectId, {
                value: candidateSubjectId,
                label: subjectCandidate.name || "Unknown Subject",
              });
            }
          }
        });
      });

      const fields = [
        { value: "section", label: "Section" },
        { value: "class", label: "Class" },
        { value: "subject", label: "Subject" },
      ].concat(
        Array.from(tagTypeSet).map((name) => ({
          value: name.toLowerCase(),
          label: name,
        })),
      );

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
      const academicSections = (
        configuredAcademicSections.length > 0
          ? configuredAcademicSections.map((section: any) => ({
              value: String(section?._id || ""),
              label: section?.name || "Unknown Section",
            }))
          : fallbackAcademicSections.map((section: any) => ({
              value: String(section?._id || ""),
              label: section?.name || "Unknown Section",
            }))
      )
        .filter((section: any) => section.value)
        .filter(
          (section: any) =>
            !teacherScope ||
            teacherScope.allowedSectionIds === null ||
            teacherScope.allowedSectionIds.includes(section.value),
        )
        .sort((a: any, b: any) => a.label.localeCompare(b.label));

      const res = NextResponse.json({
        fields,
        filters: {
          classes: Array.from(classMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
          subjects: Array.from(subjectMap.values()).sort((a, b) =>
            a.label.localeCompare(b.label),
          ),
          academicSections,
        },
      });
      res.headers.set("X-Debug-Student-GF", "ok");
      return res;
    } catch (e: any) {
      console.error("student groupFields error:", e?.message || e);
      const res = NextResponse.json({
        fields: [
          { value: "section", label: "Section" },
          { value: "class", label: "Class" },
          { value: "subject", label: "Subject" },
        ],
        filters: { classes: [], subjects: [], academicSections: [] },
      });
      res.headers.set("X-Debug-Student-GF", "fallback");
      return res;
    }
  }

  const isClassLevel = req.nextUrl.searchParams.get("classLevel") === "1";

  if (isStudentSession && isClassLevel) {
    return NextResponse.json(
      {
        success: false,
        message: "Student accounts can view only their own report details.",
      },
      { status: 403 },
    );
  }

  try {
    await connectDB();

    const groupBy = groupByParts;

    let responses: any[] = [];
    let paperTitle = "";
    let paperId = "";
    let students: any[] = [];
    let paperSections: any[] = [];
    let tagLookup = new Map();
    let paperDefaultSubject: { _id: string; name: string } | null = null;
    let scopedAllowedSubjectIds: string[] | undefined;
    let scopedAllowedSectionIds: string[] | null | undefined;

    // --- Per-question stats for class level ---
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
    if (isClassLevel) {
      const firstResponse = await QPRModel.findOne(responseQuery)
        .populate(
          "paper",
          "title class subject subjectIds sections assignedAcademicSections",
        )
        .lean();
      if (!firstResponse) {
        return NextResponse.json(
          { success: false, message: "Response not found" },
          { status: 404 },
        );
      }
      const paperObj = Array.isArray(firstResponse)
        ? firstResponse[0]?.paper
        : firstResponse.paper;
      paperId = paperObj?._id?.toString() || paperObj?.toString() || "";
      paperTitle = paperObj?.title || "";

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
            { path: "subject", select: "name" },
            { path: "class", select: "name" },
          ],
        })
        .populate({ path: "subject", select: "name" })
        .populate({ path: "subjectIds", select: "name" })
        .lean();

      const resolvedPaper = Array.isArray(paper) ? paper[0] : paper;
      if (!resolvedPaper) {
        return NextResponse.json(
          { success: false, message: "Paper not found" },
          { status: 404 },
        );
      }

      if (!isStudentSession) {
        const paperScope = resolveTeacherPaperScope(
          scopedUser,
          String(
            resolvedPaper?.class?._id || resolvedPaper?.class || "",
          ).trim(),
          resolvePaperSubjectIds(resolvedPaper),
          toUniqueScopeIds(resolvedPaper?.assignedAcademicSections),
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
          filterSubjectId &&
          paperScope.requiresSubjectIntersection &&
          !paperScope.allowedSubjectIds.includes(filterSubjectId)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "You do not have access to analytics for the selected subject.",
            },
            { status: 403 },
          );
        }

        scopedAllowedSubjectIds = paperScope.requiresSubjectIntersection
          ? paperScope.allowedSubjectIds
          : undefined;
        scopedAllowedSectionIds = paperScope.allowedSectionIds;
      }

      responses = await QPRModel.find({ paper: paperId })
        .populate({
          path: "sectionAnswers.answers.question",
          select: "answerIndexes tags content options subject class type matrixOptions matrixAnswers",
          populate: [
            {
              path: "tags",
              populate: { path: "type", select: "name" },
            },
            { path: "subject", select: "name" },
            { path: "class", select: "name" },
          ],
        })
        .lean();

      responses = await hydrateResponsesWithStudents({
        responses,
        UserModel,
        AcademicSectionModel,
        ClassModel,
        studentSelect: "name rollNumber academicSection",
      });
      if (!isStudentSession) {
        responses = filterItemsByScopedSection(
          responses,
          (response: any) =>
            response?.student?.academicSection?._id ||
            response?.student?.academicSection,
          scopedAllowedSectionIds ?? null,
        );
      }
      responses = filterResponsesByAcademicSection(
        responses,
        filterAcademicSectionId,
      );
      students = responses.map((r) => r.student).filter(Boolean);
      paperDefaultSubject = getLegacyPaperSubject(resolvedPaper);

      paperSections = Array.isArray(paper)
        ? paper[0]?.sections || []
        : paper?.sections || [];
      tagLookup = await buildAnalyticsTagLookup({
        TagModel,
        TagTypeModel,
        paperSections,
      });
      const questionLookup = buildPaperQuestionLookup({ sections: paperSections });

      // --- Aggregate per-question stats for class level ---
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
    } else {
      const rawResponse = await QPRModel.findOne(responseQuery)
        .populate({
          path: "sectionAnswers.answers.question",
          select: "answerIndexes tags content options subject class type matrixOptions matrixAnswers",
          populate: [
            {
              path: "tags",
              populate: { path: "type", select: "name" },
            },
            { path: "subject", select: "name" },
            { path: "class", select: "name" },
          ],
        })
        .populate({
          path: "paper",
          select: "title class subject subjectIds sections assignedAcademicSections",
          populate: {
            path: "sections.questions.question",
            select: "tags content answerIndexes options subject class type matrixOptions matrixAnswers",
            populate: [
              {
                path: "tags",
                populate: { path: "type", select: "name" },
              },
              { path: "subject", select: "name" },
              { path: "class", select: "name" },
            ],
          },
        })
        .lean();
      if (!rawResponse) {
        const res = NextResponse.json(
          {
            success: false,
            message: `Response not found in selected school${tenantKey ? `: ${tenantKey}` : ""}. Please verify the school and responseId.`,
          },
          { status: 404 },
        );
        try {
          res.headers.set("X-Debug-Tenant", tenantKey || "default");
        } catch {}
        return res;
      }
      const hydratedResponses = await hydrateResponsesWithStudents({
        responses: [rawResponse],
        UserModel,
        AcademicSectionModel,
        ClassModel,
        studentSelect: "name rollNumber class academicSection",
      });
      const response = hydratedResponses[0];
      if (!response) {
        const res = NextResponse.json(
          {
            success: false,
            message: `Response student not found in selected school${tenantKey ? `: ${tenantKey}` : ""}. Please verify the school and responseId.`,
          },
          { status: 404 },
        );
        try {
          res.headers.set("X-Debug-Tenant", tenantKey || "default");
        } catch {}
        return res;
      }
      responses = [response];
      paperTitle = Array.isArray(response)
        ? response[0]?.paper?.title || ""
        : response.paper?.title || "";
      students = Array.isArray(response)
        ? response.map((r) => r.student)
        : [response.student];
      const responsePaper = Array.isArray(response)
        ? response[0]?.paper
        : response.paper;
      paperDefaultSubject = getLegacyPaperSubject(responsePaper);
      if (!isStudentSession) {
        const paperScope = resolveTeacherPaperScope(
          scopedUser,
          String(responsePaper?.class?._id || responsePaper?.class || "").trim(),
          resolvePaperSubjectIds(responsePaper),
          toUniqueScopeIds(responsePaper?.assignedAcademicSections),
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
          filterSubjectId &&
          paperScope.requiresSubjectIntersection &&
          !paperScope.allowedSubjectIds.includes(filterSubjectId)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "You do not have access to analytics for the selected subject.",
            },
            { status: 403 },
          );
        }

        scopedAllowedSubjectIds = paperScope.requiresSubjectIntersection
          ? paperScope.allowedSubjectIds
          : undefined;
        scopedAllowedSectionIds = paperScope.allowedSectionIds;

        const responseStudentSectionId = getStudentAcademicSectionId(students[0]);
        if (!responseStudentSectionId && paperScope.allowedSectionIds !== null) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Teacher-scoped analytics requires the student to belong to an assigned section.",
            },
            { status: 403 },
          );
        }
        if (
          responseStudentSectionId &&
          !isSectionInScope(responseStudentSectionId, paperScope.allowedSectionIds)
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "You do not have access to analytics for this student's section.",
            },
            { status: 403 },
          );
        }
      }
      paperSections = Array.isArray(response)
        ? response[0]?.paper?.sections || []
        : response.paper?.sections || [];
      tagLookup = await buildAnalyticsTagLookup({
        TagModel,
        TagTypeModel,
        paperSections,
      });
    }

    // --- Aggregate stats using shared helper ---
    const stats = buildTagReport({
      responses,
      paperSections,
      groupBy,
      isClassLevel,
      questionStats,
      filters: {
        classId: filterClassId || undefined,
        subjectId: filterSubjectId || undefined,
        subjectIds: scopedAllowedSubjectIds,
        paperDefaultSubject,
      },
      tagLookup,
    });

    if (req.nextUrl.searchParams.get("json") === "1") {
      dedupeStatsArrays(stats);
      // Optional compact mode to reduce payload size: aggregates students at group-level and prunes per-question arrays
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
              // Deduplicate by rollNumber|name and keep counts collapsed client-side
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
            // prune per-question student arrays to shrink payload
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
        student: !isClassLevel ? students[0]?.name : undefined,
        rollNumber: !isClassLevel ? students[0]?.rollNumber : undefined,
        students: isClassLevel ? students : undefined,
        paper: paperTitle,
        paperId: paperId || undefined,
        academicSectionId: !isClassLevel
          ? getStudentAcademicSectionId(students[0]) || undefined
          : filterAcademicSectionId || undefined,
      };
      const res = NextResponse.json(responsePayload);
      try {
        res.headers.set("X-Stats-Bytes", String(JSON.stringify(stats).length));
      } catch {}
      return res;
    }

    // PDF generation (unchanged)
    const fontPath = path.join(process.cwd(), "fonts", "Roboto-Regular.ttf");
    // Set font at constructor level so PDFKit does not try to initialize default Helvetica AFM
    const doc = new PDFDocument({ font: fontPath });
    const stream = new Readable().wrap(doc);

    let buffers: Buffer[] = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {});

    doc.fontSize(18).text("Student Tag Analytics Report", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(14)
      .text(`Student: ${responses[0].student?.name || responses[0].student}`);
    doc
      .fontSize(14)
      .text(`Roll Number: ${responses[0].student?.rollNumber || ""}`);
    doc
      .fontSize(14)
      .text(`Paper: ${responses[0].paper?.title || responses[0].paper}`);
    doc.moveDown();
    doc
      .fontSize(14)
      .text("Subject → Topic → TagType: Tag-wise Correct/Incorrect Count:", {
        underline: true,
      });
    doc.moveDown();

    const renderStatsNode = (node: any, depth = 0, label?: string) => {
      if (!node || typeof node !== "object") return;

      const hasCounts =
        typeof node.correct === "number" && typeof node.incorrect === "number";

      if (hasCounts) {
        const prefix = "  ".repeat(Math.max(0, depth));
        doc
          .fontSize(12)
          .text(
            `${prefix}${label || "Total"}: Correct: ${node.correct}, Incorrect: ${node.incorrect}`,
          );
        return;
      }

      Object.entries(node).forEach(([k, v]) => {
        if (v && typeof v === "object") {
          const prefix = "  ".repeat(Math.max(0, depth));
          doc.fontSize(Math.max(11, 15 - depth)).text(`${prefix}${k}:`, {
            underline: depth <= 1,
          });
          renderStatsNode(v, depth + 1, k);
          doc.moveDown(0.3);
        }
      });
    };

    renderStatsNode(stats, 0);

    doc.end();

    await new Promise((resolve) => doc.on("end", resolve));
    const pdfBuffer = Buffer.concat(buffers);

      return new NextResponse(toBinaryResponseBody(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="student_tag_analytics.pdf"`,
        },
      });
    } catch (error: any) {
      console.error("Error in analytics route:", error);
      return NextResponse.json(
        { success: false, message: error?.message || "Failed to load analytics." },
        { status: 500 },
      );
    }
    },
  );
}
