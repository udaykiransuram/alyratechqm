import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { ArrowLeft, CheckCircle, Grid3X3, Info } from "lucide-react";

import { ContentRenderer } from "@/components/ContentRenderer";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { resolveExamRuntimeMongoResponseIdWithCooldown } from "@/lib/exam-runtime-sync-cache";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { isStudentResultReleasedForPaper } from "@/lib/student-tests";
import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";

export const dynamic = "force-dynamic";

type StudentReportQuestionPageProps = {
  params: Promise<{ responseId: string; questionId: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

function normalizeId(value: unknown) {
  return String(value || "").trim();
}

export default async function StudentReportQuestionPage({
  params,
  searchParams,
}: StudentReportQuestionPageProps) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "school_user" ||
    session.user.role !== "student"
  ) {
    redirect("/auth/signin");
  }

  const { responseId, questionId } = await params;
  const resolvedSearchParams = await searchParams;
  const schoolKey = normalizeId(session.user.schoolKey);
  const studentId = normalizeId(session.user.id);

  if (!schoolKey || !studentId) {
    redirect("/auth/signin");
  }

  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const reportPath = `/student/reports/${encodeURIComponent(responseId)}`;
  const backHref = getSafeReturnToPath(rawReturnTo) || reportPath;
  let resolvedResponseId = normalizeId(responseId);

  if (
    resolvedResponseId &&
    !mongoose.Types.ObjectId.isValid(resolvedResponseId)
  ) {
    resolvedResponseId =
      (await resolveExamRuntimeMongoResponseIdWithCooldown(
        schoolKey,
        resolvedResponseId,
      )) || resolvedResponseId;
  }

  await connectDB();
  const {
    QuestionPaperResponse: QuestionPaperResponseModel,
    QuestionPaper: QuestionPaperModel,
    Question: QuestionModel,
    Tag: TagModel,
    TagType: TagTypeModel,
    Subject: SubjectModel,
    Class: ClassModel,
  } = await getTenantModels(schoolKey, [
    "QuestionPaperResponse",
    "QuestionPaper",
    "Question",
    "Tag",
    "TagType",
    "Subject",
    "Class",
  ]);

  const response =
    resolvedResponseId && mongoose.Types.ObjectId.isValid(resolvedResponseId)
      ? await QuestionPaperResponseModel.findOne({
          _id: resolvedResponseId,
          student: studentId,
        })
    .select("paper")
    .populate({
      path: "paper",
      model: QuestionPaperModel,
      select: "title class subject subjectIds sections onlineEnabled onlineEndsAt examDate",
      populate: [
        { path: "class", model: ClassModel, select: "name" },
        { path: "subject", model: SubjectModel, select: "name" },
        { path: "subjectIds", model: SubjectModel, select: "name" },
        {
          path: "sections.questions.question",
          model: QuestionModel,
          select:
            "content options answerIndexes matrixOptions matrixAnswers explanation marks type subject class tags",
          populate: [
            {
              path: "tags",
              model: TagModel,
              populate: { path: "type", model: TagTypeModel, select: "name" },
            },
            { path: "subject", model: SubjectModel, select: "name" },
            { path: "class", model: ClassModel, select: "name" },
          ],
        },
      ],
    })
          .lean()
      : null;

  const paper = response?.paper as any;

  if (!paper) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          eyebrow="Analysis Report"
          title="Question Not Available"
          description="We could not load this question from your report."
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back to Report
              </AppPrefetchLink>
            </Button>
          }
        >
          <StudentPortalNav />
        </PageHero>
      </PageShell>
    );
  }

  if (paper.onlineEnabled && !isStudentResultReleasedForPaper(paper, new Date())) {
    redirect(backHref);
  }

  let questionNumber = 0;
  let matchedQuestion: any = null;
  let matchedSectionName = "";
  let matchedSectionDescription = "";
  let matchedMarks = 0;
  let matchedNegativeMarks = 0;

  for (const section of Array.isArray(paper.sections) ? paper.sections : []) {
    for (const entry of Array.isArray(section?.questions) ? section.questions : []) {
      questionNumber += 1;
      if (normalizeId(entry?.question?._id) !== normalizeId(questionId)) {
        continue;
      }

      matchedQuestion = entry.question;
      matchedSectionName = String(section?.name || "").trim();
      matchedSectionDescription = String(section?.description || "").trim();
      matchedMarks = Number(entry?.marks || matchedQuestion?.marks || 0);
      matchedNegativeMarks = Number(entry?.negativeMarks || 0);
      break;
    }

    if (matchedQuestion) {
      break;
    }
  }

  if (!matchedQuestion) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          eyebrow="Analysis Report"
          title="Question Not Found"
          description="This question is not part of the selected report."
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back to Report
              </AppPrefetchLink>
            </Button>
          }
        >
          <StudentPortalNav />
        </PageHero>
      </PageShell>
    );
  }

  const paperSubjectNames = [
    paper?.subject?.name,
    ...(Array.isArray(paper?.subjectIds)
      ? paper.subjectIds.map((subject: any) => subject?.name)
      : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const metaSubjectName = String(matchedQuestion?.subject?.name || "").trim();
  const metaClassName =
    String(matchedQuestion?.class?.name || paper?.class?.name || "").trim();

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="editor"
        eyebrow="Analysis Report"
        title={`Question ${questionNumber || "—"}`}
        description="Review this question directly from your analysis report."
        actions={
          <Button asChild variant="outline" className="app-button-back">
            <AppPrefetchLink href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Back to Report
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            {paper?.title ? (
              <span className="app-meta-chip">{String(paper.title)}</span>
            ) : null}
            {matchedSectionName ? (
              <span className="app-meta-chip">{matchedSectionName}</span>
            ) : null}
            {metaSubjectName ? (
              <span className="app-meta-chip">{metaSubjectName}</span>
            ) : paperSubjectNames.length === 1 ? (
              <span className="app-meta-chip">{paperSubjectNames[0]}</span>
            ) : null}
            {metaClassName ? (
              <span className="app-meta-chip">{metaClassName}</span>
            ) : null}
          </>
        }
        stats={[
          {
            label: "Marks",
            value: String(matchedMarks || matchedQuestion?.marks || "-"),
            meta: matchedNegativeMarks > 0 ? `Negative: ${matchedNegativeMarks}` : "No negative marking",
          },
          {
            label: "Question Type",
            value: String(matchedQuestion?.type || "-").replace(/-/g, " "),
            meta: "Read-only detail from your completed report.",
          },
          {
            label: "Section",
            value: matchedSectionName || "Unassigned",
            meta: matchedSectionDescription || "This question is grouped under the section shown above.",
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Question</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body prose max-w-none dark:prose-invert">
              <ContentRenderer
                htmlContent={sanitizeRichTextHtml(String(matchedQuestion?.content || ""))}
              />
            </CardContent>
          </Card>

          {Array.isArray(matchedQuestion?.options) && matchedQuestion.options.length > 0 ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <ul className="space-y-2.5">
                  {matchedQuestion.options.map((option: any, index: number) => {
                    const isAnswer = Array.isArray(matchedQuestion?.answerIndexes)
                      ? matchedQuestion.answerIndexes.includes(index)
                      : false;

                    return (
                      <li
                        key={index}
                        className={`flex items-start gap-3 rounded-2xl border px-3 py-2.5 ${
                          isAnswer
                            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/40"
                            : "border-border/60 bg-muted/10"
                        }`}
                      >
                        {isAnswer ? (
                          <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
                        ) : null}
                        <div
                          className={`min-w-0 flex-1 prose prose-sm max-w-none dark:prose-invert ${
                            isAnswer ? "font-medium" : ""
                          }`}
                        >
                          <ContentRenderer
                            htmlContent={sanitizeRichTextHtml(String(option?.content || ""))}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {matchedQuestion?.type === "matrix-match" &&
          Array.isArray(matchedQuestion?.matrixOptions) &&
          matchedQuestion.matrixOptions.length > 0 ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-primary" />
                  Matrix Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <div className="grid gap-3 sm:grid-cols-2">
                  {matchedQuestion.matrixOptions.map((option: any, index: number) => (
                    <div key={index} className="app-detail-item">
                      <p className="app-detail-label">Pair {index + 1}</p>
                      <div className="space-y-2 text-sm text-foreground">
                        <div>
                          <span className="font-medium text-muted-foreground">Left:</span>{" "}
                          <span>{String(option?.left || "-")}</span>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Right:</span>{" "}
                          <span>{String(option?.right || "-")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {matchedQuestion?.explanation ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Explanation
                </CardTitle>
              </CardHeader>
              <CardContent className="app-section-body prose prose-sm max-w-none dark:prose-invert">
                <ContentRenderer
                  htmlContent={sanitizeRichTextHtml(String(matchedQuestion.explanation || ""))}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Question Details</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <div className="app-detail-item">
                <p className="app-detail-label">Paper</p>
                <p className="app-detail-value">{String(paper?.title || "-")}</p>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Section</p>
                <p className="app-detail-value">{matchedSectionName || "-"}</p>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Subject</p>
                <p className="app-detail-value">
                  {metaSubjectName || paperSubjectNames.join(", ") || "-"}
                </p>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Class</p>
                <p className="app-detail-value">{metaClassName || "-"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
