import { ArrowLeft, CheckCircle, Grid3X3, Info } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { ContentRenderer } from "@/components/ContentRenderer";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildHrefWithReturnTo, getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { getWorkspaceQuestionById } from "@/lib/server/workspace-assessment-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";
import { sanitizeRichTextHtml } from "@/lib/security/html-sanitize";

export const dynamic = "force-dynamic";

type ViewQuestionPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function ViewQuestionPage({
  params,
  searchParams,
}: ViewQuestionPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { schoolKey } = await requireWorkspaceStaffSession();
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const backHref = getSafeReturnToPath(rawReturnTo) || "/workspace/questions";
  const currentPath = buildHrefWithReturnTo(
    `/workspace/questions/view/${encodeURIComponent(id)}`,
    backHref,
  );
  const editHref = buildHrefWithReturnTo(
    `/workspace/questions/edit/${encodeURIComponent(id)}`,
    currentPath,
  );
  const question = await getWorkspaceQuestionById(schoolKey, id);

  if (!question) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          variant="editor"
          eyebrow="Question Bank"
          title="View Question"
          description="The requested question could not be loaded."
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back to Questions
              </AppPrefetchLink>
            </Button>
          }
        />
        <div className="app-feedback app-feedback-error text-center">
          Question not found.
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="editor"
        eyebrow="Question Bank"
        title="View Question"
        description="Detailed view of a single question, its answer data, and the metadata used across paper building."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </AppPrefetchLink>
            </Button>
            <Button asChild className="app-button-page">
              <AppPrefetchLink
                href={editHref}
                relatedApiPrefetches={[
                  `/api/questions/${id}`,
                  "/api/classes",
                  "/api/tags/with-subjects",
                ]}
              >
                Edit
              </AppPrefetchLink>
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {question.class?.name || "No class assigned"}
            </span>
            <span className="app-meta-chip">
              {question.subject?.name || "No subject assigned"}
            </span>
          </>
        }
        stats={[
          {
            label: "Question type",
            value: question.type,
            meta: "This determines how the item behaves in authoring and delivery flows.",
          },
          {
            label: "Marks",
            value: String(question.marks ?? "-"),
            meta: "Current mark value stored for this question.",
          },
          {
            label: "Linked tags",
            value: String(question.tags?.length ?? 0),
            meta: "Tags help the question appear in filters, papers, and analytics.",
          },
        ]}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Question</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body prose max-w-none dark:prose-invert">
              <ContentRenderer htmlContent={sanitizeRichTextHtml(question.content)} />
            </CardContent>
          </Card>

          {question.options && question.options.length > 0 ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <ul className="space-y-2.5">
                  {question.options.map((option: any, index: number) => {
                    const isAnswer = question.answerIndexes?.includes(index);
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
                            htmlContent={sanitizeRichTextHtml(option.content || "")}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {question.type === "matrix-match" && question.matrixOptions?.length ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-primary" />
                  Matrix Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.matrixOptions.map((option: any, index: number) => (
                    <div key={index} className="app-detail-item">
                      <p className="app-detail-label">Pair {index + 1}</p>
                      <div className="space-y-2 text-sm text-foreground">
                        <div>
                          <span className="font-medium text-muted-foreground">Left:</span>{" "}
                          <span>{option.left || "-"}</span>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Right:</span>{" "}
                          <span>{option.right || "-"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {question.explanation ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Explanation
                </CardTitle>
              </CardHeader>
              <CardContent className="app-section-body prose prose-sm max-w-none dark:prose-invert">
                <ContentRenderer
                  htmlContent={sanitizeRichTextHtml(question.explanation)}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] xl:self-start">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-detail-grid">
                <div className="app-detail-item">
                  <p className="app-detail-label">Type</p>
                  <div className="app-detail-value capitalize">{question.type}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Marks</p>
                  <div className="app-detail-value">{question.marks ?? "-"}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Class</p>
                  <div className="app-detail-value">{question.class?.name || "-"}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Subject</p>
                  <div className="app-detail-value">{question.subject?.name || "-"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {question.tags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {question.tags.map((tag: any) => (
                    <Badge key={tag._id} variant="secondary">
                      {tag.type?.name ? `${tag.type.name}: ` : ""}
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="app-empty-state py-6">No tags linked.</div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
}
