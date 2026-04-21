export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireTenantSession } from "@/lib/api-auth";
import {
  buildAnalyticsTagLookup,
  resolveAnalyticsTags,
} from "@/lib/analytics/tag-resolution";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import {
  getQuestionImportDiagnosticTagLabel,
  normalizeQuestionImportDiagnosticTagType,
  QUESTION_IMPORT_DIAGNOSTIC_TAGS,
} from "@/lib/question-import/diagnostic-tags";
import { buildDiagnosticQuestionWorkbookBuffer } from "@/lib/question-import/xlsx";
import { resolveTeacherPaperScope, toUniqueScopeIds } from "@/lib/question-paper/access";
import { resolvePaperSubjectIds } from "@/lib/question-paper/subjects";
import { toBinaryResponseBody } from "@/lib/server/binary-response";
import { withRequestBudget } from "@/lib/server/request-governor";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeFileNameSegment(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "diagnostic-question-export";
}

function normalizeDateToken(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function answerIndexesToLetters(value: unknown) {
  const indexes = Array.isArray(value) ? value : [];
  return indexes
    .filter((index) => Number.isInteger(index) && index >= 0 && index < 26)
    .map((index) => String.fromCharCode(65 + Number(index)))
    .join(", ");
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const paperId = normalizeText(req.nextUrl.searchParams.get("paperId"));
  if (!mongoose.Types.ObjectId.isValid(paperId)) {
    return NextResponse.json(
      {
        success: false,
        message: "A valid paperId is required.",
      },
      { status: 400 },
    );
  }

  return withRequestBudget(
    {
      request: req,
      policy: "questionImportCreate",
      schoolKey: auth.schoolKey,
      userId: auth.session.user.id,
      scopeId: `${auth.schoolKey}:${paperId}:export`,
    },
    async () => {
      await connectDB();
      const {
        QuestionPaper: QuestionPaperModel,
        Tag: TagModel,
        TagType: TagTypeModel,
        Subject: SubjectModel,
        Class: ClassModel,
        User: UserModel,
      } = await getTenantModels(auth.schoolKey, [
        "QuestionPaper",
        "Question",
        "Tag",
        "TagType",
        "Subject",
        "Class",
        "User",
      ]);

      const paper = await QuestionPaperModel.findById(paperId)
        .select(
          "title instructions class subject subjectIds duration passingMarks examDate sections assignedAcademicSections",
        )
        .populate([
          { path: "class", model: ClassModel, select: "name" },
          { path: "subject", model: SubjectModel, select: "name" },
          { path: "subjectIds", model: SubjectModel, select: "name" },
          {
            path: "sections.questions.question",
            select: "content options answerIndexes explanation subject tags type",
            populate: [
              { path: "subject", model: SubjectModel, select: "name" },
              {
                path: "tags",
                model: TagModel,
                populate: { path: "type", model: TagTypeModel, select: "name" },
              },
            ],
          },
        ])
        .lean();

      if (!paper?._id) {
        return NextResponse.json(
          {
            success: false,
            message: "Question paper not found.",
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
        const teacherScope = resolveTeacherPaperScope(
          scopedUser,
          String((paper as any)?.class?._id || (paper as any)?.class || "").trim(),
          resolvePaperSubjectIds(paper),
          toUniqueScopeIds((paper as any)?.assignedAcademicSections),
        );

        if (
          !teacherScope.hasClassAccess ||
          !teacherScope.hasSubjectAccess ||
          !teacherScope.hasSectionAccess
        ) {
          return NextResponse.json(
            {
              success: false,
              message: "You do not have access to export this paper.",
            },
            { status: 403 },
          );
        }
      }

      const paperSections = Array.isArray((paper as any)?.sections)
        ? (paper as any).sections
        : [];
      const tagLookup = await buildAnalyticsTagLookup({
        TagModel,
        TagTypeModel,
        paperSections,
      });
      const fallbackPaperSubjectName =
        normalizeText((paper as any)?.subject?.name) ||
        (Array.isArray((paper as any)?.subjectIds)
          ? (paper as any).subjectIds.map((subject: any) => normalizeText(subject?.name)).find(Boolean)
          : "") ||
        "";

      const rows: Array<Record<string, unknown>> = [];
      let questionNumber = 0;
      paperSections.forEach((section: any) => {
        (Array.isArray(section?.questions) ? section.questions : []).forEach(
          (entry: any) => {
            const question = entry?.question;
            if (!question?._id) {
              return;
            }

            questionNumber += 1;
            const resolvedTags = resolveAnalyticsTags(question?.tags || [], tagLookup);
            const additionalTags: string[] = [];
            const row: Record<string, unknown> = {
              "Paper Title": normalizeText((paper as any)?.title),
              Class: normalizeText((paper as any)?.class?.name),
              "Duration (minutes)": Number((paper as any)?.duration) || 60,
              "Passing Marks": Number((paper as any)?.passingMarks) || 0,
              "Exam Date": normalizeDateToken((paper as any)?.examDate),
              "Paper Instructions": String((paper as any)?.instructions || ""),
              "Section Name": normalizeText(section?.name) || "Section A",
              "Section Subject":
                normalizeText(question?.subject?.name) || fallbackPaperSubjectName,
              "Section Default Marks": Number(section?.defaultMarks) || 1,
              "Section Default Negative Marks":
                Number(section?.defaultNegativeMarks) || 0,
              "Section Description": String(section?.description || ""),
              "Section Instructions": String(section?.instructions || ""),
              "Question Number": String(questionNumber),
              "Question Type": normalizeText(question?.type) || "single",
              Subject: normalizeText(question?.subject?.name) || fallbackPaperSubjectName,
              Marks: Number(entry?.marks) || Number(section?.defaultMarks) || 1,
              "Negative Marks":
                Number(entry?.negativeMarks) ||
                Number(section?.defaultNegativeMarks) ||
                0,
              Question: String(question?.content || ""),
              Explanation: String(question?.explanation || ""),
              "Correct (letter)": answerIndexesToLetters(question?.answerIndexes),
            };

            (Array.isArray(question?.options) ? question.options : []).forEach(
              (option: any, index: number) => {
                row[`Option ${String.fromCharCode(65 + index)}`] = String(
                  option?.content || "",
                );
              },
            );

            resolvedTags.forEach((tag) => {
              const normalizedType = normalizeQuestionImportDiagnosticTagType(
                tag?.type?.name,
              );
              const value = normalizeText(tag?.name);
              if (!normalizedType || !value) {
                if (normalizeText(tag?.type?.name) && value) {
                  additionalTags.push(`${normalizeText(tag.type?.name)}=${value}`);
                }
                return;
              }

              row[getQuestionImportDiagnosticTagLabel(normalizedType)] = value;
            });

            const knownTagLabels = new Set(
              QUESTION_IMPORT_DIAGNOSTIC_TAGS.map((config) =>
                getQuestionImportDiagnosticTagLabel(config.type),
              ),
            );
            Object.keys(row).forEach((key) => {
              if (!knownTagLabels.has(key)) {
                return;
              }

              if (!normalizeText(row[key])) {
                delete row[key];
              }
            });

            if (additionalTags.length > 0) {
              row["Additional Tags"] = additionalTags.join(" | ");
            }

            rows.push(row);
          },
        );
      });

      const workbookBuffer = buildDiagnosticQuestionWorkbookBuffer({
        rows,
      });
      const fileName = `${normalizeFileNameSegment(
        (paper as any)?.title,
      )}-diagnostic-export.xlsx`;

      return new NextResponse(toBinaryResponseBody(workbookBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      });
    },
  );
}

