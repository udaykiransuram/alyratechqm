import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ArrowLeft, CheckCircle, Grid3X3, Info } from "lucide-react";

import { ContentRenderer } from "@/components/ContentRenderer";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import {
  assertSummerCrashStudentPageAccess,
} from "@/lib/server/summer-crash";
import { getStudentReportQuestionDetail } from "@/lib/server/student-report-questions";
import { buildSummerCrashStudentReportHref } from "@/lib/summer-crash/shared";
import { isStudentResultReleasedForPaper } from "@/lib/student-tests";
import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";


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

  const accessCheck = await assertSummerCrashStudentPageAccess({
    schoolKey,
    studentId,
    target: {
      kind: "diagnostic-report",
      responseId,
    },
  });
  if (!accessCheck.allowed) {
    redirect(accessCheck.policy.redirectHref);
  }

  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const reportPath = `/student/reports/${encodeURIComponent(responseId)}`;
  const restrictedReportHref =
    buildSummerCrashStudentReportHref(responseId) || reportPath;
  const isSummerDiagnosticReport =
    accessCheck.policy.applies &&
    accessCheck.policy.allowedDiagnosticResponseId === responseId;
  const backHref =
    accessCheck.policy.applies && !accessCheck.policy.isUnlocked
      ? restrictedReportHref
      : getSafeReturnToPath(rawReturnTo) || reportPath;
  const reportQuestion = await getStudentReportQuestionDetail({
    schoolKey,
    studentId,
    responseId,
    questionId,
  });
  const paper = reportQuestion.paper;

  if (reportQuestion.status === "paper_not_available") {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          className="app-learning-hero"
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
    redirect(
      accessCheck.policy.applies && !accessCheck.policy.isUnlocked
        ? restrictedReportHref
        : backHref,
    );
  }

  const {
    questionNumber,
    matchedQuestion,
    matchedSectionName,
    matchedSectionDescription,
    matchedMarks,
    matchedNegativeMarks,
    paperSubjectNames,
    metaSubjectName,
    metaClassName,
    answerStatus,
    studentAnswerSummary,
    correctAnswerSummary,
    weakAreaLabel,
    topicLabel,
  } = reportQuestion;
  const resultVariant =
    answerStatus === "correct"
      ? "success"
      : answerStatus === "incorrect"
        ? "warning"
        : "secondary";
  const resultLabel =
    answerStatus === "correct"
      ? "Correct"
      : answerStatus === "incorrect"
        ? "Needs support"
        : "Skipped";

  if (reportQuestion.status === "question_not_found") {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          className="app-learning-hero"
          eyebrow={isSummerDiagnosticReport ? "Diagnostic Review" : "Analysis Report"}
          title="Question Not Found"
          description={
            isSummerDiagnosticReport
              ? "We could not find this question in the diagnostic report."
              : "This question is not part of the selected report."
          }
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                {isSummerDiagnosticReport ? "Back to Diagnostic Report" : "Back to Report"}
              </AppPrefetchLink>
            </Button>
          }
        >
          {!isSummerDiagnosticReport ? <StudentPortalNav /> : null}
        </PageHero>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        className="app-learning-hero"
        variant="editor"
        eyebrow={isSummerDiagnosticReport ? "Diagnostic Review" : "Analysis Report"}
        title={`Question ${questionNumber || "—"}`}
        description={
          isSummerDiagnosticReport
            ? "Review this question together to see where your child needs more support."
            : "Review this question directly from your analysis report."
        }
        actions={
          <Button asChild variant="outline" className="app-button-back">
            <AppPrefetchLink href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              {isSummerDiagnosticReport ? "Back to Diagnostic Report" : "Back to Report"}
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
            {weakAreaLabel ? (
              <span className="app-meta-chip">Focus: {weakAreaLabel}</span>
            ) : null}
          </>
        }
        stats={
          isSummerDiagnosticReport
            ? [
                {
                  label: "Result",
                  value: resultLabel,
                  meta:
                    weakAreaLabel || topicLabel || "Focus on the explanation below.",
                },
                {
                  label: "Focus Area",
                  value: weakAreaLabel || topicLabel || "Needs review",
                  meta: "This is the main skill or topic linked to this question.",
                },
                {
                  label: "Marks",
                  value: String(matchedMarks || matchedQuestion?.marks || "-"),
                  meta:
                    matchedNegativeMarks > 0
                      ? `Negative: ${matchedNegativeMarks}`
                      : "No negative marking",
                },
              ]
            : [
                {
                  label: "Marks",
                  value: String(matchedMarks || matchedQuestion?.marks || "-"),
                  meta:
                    matchedNegativeMarks > 0
                      ? `Negative: ${matchedNegativeMarks}`
                      : "No negative marking",
                },
                {
                  label: "Question Type",
                  value: String(matchedQuestion?.type || "-").replace(/-/g, " "),
                  meta: "Read-only detail from your completed report.",
                },
                {
                  label: "Section",
                  value: matchedSectionName || "Unassigned",
                  meta:
                    matchedSectionDescription ||
                    "This question is grouped under the section shown above.",
                },
              ]
        }
      >
        {!isSummerDiagnosticReport ? <StudentPortalNav /> : null}
      </PageHero>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {isSummerDiagnosticReport ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Answer summary</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.25rem] border border-border/60 bg-background/88 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Result
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={resultVariant}>{resultLabel}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {answerStatus === "correct"
                      ? "Your child answered this correctly."
                      : answerStatus === "incorrect"
                        ? "This is one of the questions that needs more support."
                        : "This question was skipped in the diagnostic."}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-background/88 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Your child&apos;s answer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {studentAnswerSummary}
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-emerald-200/80 bg-emerald-50/70 px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800">
                    Correct answer
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-950">
                    {correctAnswerSummary}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>{isSummerDiagnosticReport ? "Question to review" : "Question"}</CardTitle>
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
                <CardTitle>{isSummerDiagnosticReport ? "Answer choices" : "Options"}</CardTitle>
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
                  {isSummerDiagnosticReport ? "How to explain it" : "Explanation"}
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
              <CardTitle>{isSummerDiagnosticReport ? "Quick details" : "Question Details"}</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              {isSummerDiagnosticReport ? (
                <div className="app-detail-item">
                  <p className="app-detail-label">Main focus</p>
                  <p className="app-detail-value">
                    {weakAreaLabel || topicLabel || matchedSectionName || "-"}
                  </p>
                </div>
              ) : null}
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
