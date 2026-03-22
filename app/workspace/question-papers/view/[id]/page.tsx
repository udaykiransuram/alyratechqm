"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import { PaperSummary } from "@/components/PaperSummary";
import { PrintEditToolbar } from "@/components/PrintEditToolbar";
import { QuestionPaperToolbar } from "@/components/QuestionPaperToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLoadingState from "@/components/ui/page-loading-state";
import QuestionItemClient from "@/components/QuestionItemClient";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson, peekCachedApiJson } from "@/lib/client/api";
import { getSchoolKeyFromCookie } from "@/lib/client/school";

const DETAIL_PAGE_CACHE_TTL_MS = 30_000;

async function getQuestionPaper(id: string) {
  const payload = await fetchApiJson<any>(`/api/question-papers/${id}`, {
    cache: "no-store",
    fallbackMessage: "Failed to load question paper.",
    clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
  });

  return payload.paper;
}

export default function ViewQuestionPaperPage({
  params,
}: {
  params: { id: string };
}) {
  const { navigateBack } = useBackNavigation("/workspace/question-papers");
  const cachedPaperResponse = peekCachedApiJson<{ paper?: any }>(
    `/api/question-papers/${params.id}`,
    {
      schoolKey: getSchoolKeyFromCookie(),
      clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
    },
  );
  const [paper, setPaper] = useState<any>(() => cachedPaperResponse?.paper || null);
  const [loading, setLoading] = useState(() => !cachedPaperResponse?.paper);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schoolKey, setSchoolKey] = useState(() => getSchoolKeyFromCookie());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSchoolKey(getSchoolKeyFromCookie());
  }, []);

  useEffect(() => {
    const fetchPaper = async () => {
      if (!schoolKey) {
        setPaper(null);
        setLoading(false);
        return;
      }

      if (cachedPaperResponse?.paper) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const fetchedPaper = await getQuestionPaper(params.id);
        setPaper(fetchedPaper);
      } catch (err: any) {
        setPaper(null);
        setError(err?.message || "Failed to load question paper.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    void fetchPaper();
  }, [cachedPaperResponse?.paper, params.id, schoolKey]);

  const paperSections = useMemo(
    () => (Array.isArray(paper?.sections) ? paper.sections : []),
    [paper?.sections],
  );

  const assignedAcademicSectionNames = useMemo(
    () =>
      (Array.isArray(paper?.assignedAcademicSections)
        ? paper.assignedAcademicSections
        : []
      )
        .map((section: any) => section?.name || "-")
        .filter(Boolean),
    [paper?.assignedAcademicSections],
  );

  const summarySections = useMemo(
    () =>
      paperSections.map((section: any, sectionIndex: number) => {
        const questions = Array.isArray(section?.questions) ? section.questions : [];

        return {
          id: section?._id || `section-${sectionIndex}`,
          name: section?.name || `Section ${sectionIndex + 1}`,
          defaultMarks: section?.marks,
          defaultNegativeMarks: questions[0]?.negativeMarks ?? 0,
          questions: questions
            .filter(Boolean)
            .map((item: any) => ({
              question:
                item?.question && typeof item.question === "object" ? item.question : { tags: [] },
              marks: item?.marks ?? 0,
              negativeMarks: item?.negativeMarks ?? 0,
            })),
        };
      }),
    [paperSections],
  );

  if (!mounted && !paper) {
    return (
      <PageLoadingState
        title="Loading question paper"
        description="Resolving the selected school workspace and paper details."
      />
    );
  }

  if (!schoolKey) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Assessments"
          title="No School Selected"
          description="Select a school workspace before viewing question papers."
          actions={
            <Button variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />
        <div className="app-empty-state">
          A school context is required before this paper can be viewed.
        </div>
      </div>
    );
  }

  if (loading && !paper) {
    return (
      <PageLoadingState
        title="Loading question paper"
        description="Preparing the paper summary, sections, and linked questions."
      />
    );
  }

  if (error) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Assessments"
          title="Question Paper"
          description="The requested paper could not be loaded."
          actions={
            <Button variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Papers
            </Button>
          }
        />
        <div className="app-feedback app-feedback-error text-center">{error}</div>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Assessments"
          title="Question Paper"
          description="This paper may not belong to the currently selected school."
          actions={
            <Button variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Papers
            </Button>
          }
        />
        <div className="app-empty-state">Question paper not found.</div>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Assessments"
        title={paper.title || "Question Paper"}
        description="Review paper details, sections, question composition, and scoring rules from one consistent assessment workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={navigateBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <PrintEditToolbar paperId={paper._id} />
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">{paper.class?.name || "No class assigned"}</span>
            <span className="app-meta-chip">{paper.subject?.name || "No subject assigned"}</span>
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
          </>
        }
        stats={[
          {
            label: "Sections",
            value: String(paperSections.length),
            meta: "Total sections currently included in this paper.",
          },
          {
            label: "Total marks",
            value: String(paper.totalMarks ?? 0),
            meta: "Overall marks configured for the full paper.",
          },
          {
            label: "Delivery",
            value: paper.onlineEnabled ? "Online" : "Offline",
            meta: paper.onlineEnabled
              ? "Online windows are configured for student delivery."
              : "This paper is currently treated as offline or manual.",
          },
          {
            label: "Assigned sections",
            value: assignedAcademicSectionNames.length ? String(assignedAcademicSectionNames.length) : "All",
            meta: assignedAcademicSectionNames.length
              ? assignedAcademicSectionNames.join(", ")
              : "Available to all sections in the selected class.",
          },
        ]}
      />

      {error ? <div className="app-feedback app-feedback-info">{error}</div> : null}

      <QuestionPaperToolbar paper={paper} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-4">
          {paper.instructions ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body prose prose-sm max-w-none dark:prose-invert">
                <p>{paper.instructions}</p>
              </CardContent>
            </Card>
          ) : null}

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Paper Details</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-detail-grid">
                <div className="app-detail-item">
                  <p className="app-detail-label">Class</p>
                  <div className="app-detail-value">{paper.class?.name || "-"}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Subject</p>
                  <div className="app-detail-value">{paper.subject?.name || "-"}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Duration</p>
                  <div className="app-detail-value">{paper.duration ?? "-"} min</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Passing Marks</p>
                  <div className="app-detail-value">{paper.passingMarks ?? "-"}</div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Delivery</p>
                  <div className="app-detail-value">
                    {paper.onlineEnabled ? "Online" : "Offline / Manual"}
                  </div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Online Start</p>
                  <div className="app-detail-value">
                    {paper.onlineEnabled
                      ? paper.onlineStartsAt
                        ? new Date(paper.onlineStartsAt).toLocaleString()
                        : paper.examDate
                          ? new Date(paper.examDate).toLocaleString()
                          : "-"
                      : "-"}
                  </div>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Online End</p>
                  <div className="app-detail-value">
                    {paper.onlineEnabled && paper.onlineEndsAt
                      ? new Date(paper.onlineEndsAt).toLocaleString()
                      : "-"}
                  </div>
                </div>
                <div className="app-detail-item md:col-span-2">
                  <p className="app-detail-label">Assigned Sections</p>
                  <div className="app-detail-value">
                    {assignedAcademicSectionNames.length
                      ? assignedAcademicSectionNames.join(", ")
                      : "All sections in class"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {paperSections.length === 0 ? (
            <div className="app-empty-state">No sections are available in this paper yet.</div>
          ) : (
            paperSections.map((section: any, sectionIndex: number) => {
              const sectionQuestions = Array.isArray(section?.questions) ? section.questions : [];

              return (
                <Card key={section?._id || sectionIndex} className="app-surface overflow-hidden">
                  <CardHeader className="app-section-header">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {`Section ${sectionIndex + 1}: ${section?.name || 'Untitled Section'}`}
                        </CardTitle>
                        {section?.description ? (
                          <p className="mt-2 text-sm text-muted-foreground">{section.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{sectionQuestions.length} Questions</Badge>
                        <Badge variant="secondary">{section?.marks ?? 0} Marks</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body space-y-3">
                    {sectionQuestions.length === 0 ? (
                      <div className="app-empty-state">No questions were added to this section.</div>
                    ) : (
                      sectionQuestions.map((item: any, questionIndex: number) => {
                        const question =
                          item?.question && typeof item.question === "object" ? item.question : null;

                        return (
                          <div
                            key={question?._id || `${sectionIndex}-${questionIndex}`}
                            className="rounded-2xl border border-border/60 bg-muted/10 p-3"
                          >
                            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p className="text-sm font-semibold text-foreground">
                                Question {questionIndex + 1}
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{item?.marks ?? 0} Marks</Badge>
                                {(item?.negativeMarks ?? 0) > 0 ? (
                                  <Badge variant="destructive">{item.negativeMarks} Negative</Badge>
                                ) : null}
                              </div>
                            </div>

                            {question ? (
                              <QuestionItemClient
                                compact
                                question={{
                                  ...question,
                                  tags: Array.isArray(question.tags) ? question.tags : [],
                                  options: Array.isArray(question.options) ? question.options : [],
                                  answerIndexes: Array.isArray(question.answerIndexes)
                                    ? question.answerIndexes
                                    : [],
                                }}
                                readOnly
                                classes={[]}
                                subjects={[]}
                                allTags={[]}
                              />
                            ) : (
                              <div className="app-empty-state py-4">
                                This question record is missing or no longer available.
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </main>

        <aside className="space-y-4 xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] xl:self-start print:hidden">
          <PaperSummary
            sections={summarySections}
            totalPaperMarks={Number(paper.totalMarks ?? 0)}
            duration={Number(paper.duration ?? 0)}
            passingMarks={Number(paper.passingMarks ?? 0)}
            examDate={paper.examDate}
            onlineEnabled={Boolean(paper.onlineEnabled)}
            onlineStartsAt={paper.onlineStartsAt ?? null}
            onlineEndsAt={paper.onlineEndsAt ?? null}
          />
        </aside>
      </div>
    </div>
  );
}
