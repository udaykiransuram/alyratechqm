import dynamicComponent from "next/dynamic";
import { ArrowLeft, ChevronDown } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { PaperSummary } from "@/components/PaperSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuestionPaperReadOnlyQuestionCard } from "@/components/workspace/question-paper-view/QuestionPaperReadOnlyQuestionCard";
import {
  deriveSectionDefaultMarks,
  deriveSectionDefaultNegativeMarks,
} from "@/lib/question-paper/sections";
import { resolveSectionSubjects } from "@/lib/question-paper/subjects";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { getWorkspaceQuestionPaperById } from "@/lib/server/workspace-assessment-data";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


const PrintEditToolbar = dynamicComponent(
  () =>
    import("@/components/PrintEditToolbar").then((module) => ({
      default: module.PrintEditToolbar,
    })),
);
const QuestionPaperToolbar = dynamicComponent(
  () =>
    import("@/components/QuestionPaperToolbar").then((module) => ({
      default: module.QuestionPaperToolbar,
    })),
);

type ViewQuestionPaperPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

type ViewPaperSubject = {
  _id?: string;
  name?: string;
};

type ViewPaperAssignedAcademicSection = {
  _id?: string;
  name?: string;
};

type ViewPaperQuestion = {
  _id?: string;
  content?: string;
  tags?: unknown[];
  options?: unknown[];
  answerIndexes?: number[];
  createdAt?: string;
  [key: string]: unknown;
};

type ViewPaperSectionQuestion = {
  question?: ViewPaperQuestion | null;
  marks?: number;
  negativeMarks?: number;
};

type ViewPaperSection = {
  _id?: string;
  name?: string;
  description?: string;
  instructions?: string;
  marks?: number;
  questions?: ViewPaperSectionQuestion[];
};

type ViewQuestionPaper = {
  _id: string;
  title?: string;
  class?: {
    _id?: string;
    name?: string;
  } | null;
  subjects?: ViewPaperSubject[];
  assignedAcademicSections?: ViewPaperAssignedAcademicSection[];
  sections?: ViewPaperSection[];
  totalMarks?: number;
  onlineEnabled?: boolean;
  instructions?: string;
  duration?: number;
  passingMarks?: number;
  examDate?: string | null;
  onlineStartsAt?: string | null;
  onlineEndsAt?: string | null;
};

export default async function ViewQuestionPaperPage({
  params,
  searchParams,
}: ViewQuestionPaperPageProps) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const { schoolKey } = await requireWorkspaceStaffSession();
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const backHref =
    getSafeReturnToPath(rawReturnTo) || "/workspace/question-papers";
  const paper = id
    ? ((await getWorkspaceQuestionPaperById(
        schoolKey,
        id,
      )) as ViewQuestionPaper | null)
    : null;

  if (!paper) {
    return (
      <PageShell
        width="wide"
        padding="standard"
        className="app-directory-stack"
      >
        <PageHero
          variant="editor"
          eyebrow="Assessments"
          title="Question Paper"
          description="The requested paper could not be loaded."
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back to Papers
              </AppPrefetchLink>
            </Button>
          }
        />
        <div className="app-empty-state">Question paper not found.</div>
      </PageShell>
    );
  }

  const paperSections = Array.isArray(paper.sections) ? paper.sections : [];
  const paperSubjects = Array.isArray(paper.subjects) ? paper.subjects : [];
  const assignedAcademicSectionNames = (
    Array.isArray(paper.assignedAcademicSections)
      ? paper.assignedAcademicSections
      : []
  )
    .map((section: any) => section?.name || "-")
    .filter(Boolean);
  const summarySections = paperSections.map((section: any, sectionIndex: number) => {
    const questions = Array.isArray(section?.questions) ? section.questions : [];

    return {
      id: section?._id || `section-${sectionIndex}`,
      name: section?.name || `Section ${sectionIndex + 1}`,
      description: section?.description || "",
      instructions: section?.instructions || "",
      defaultMarks: deriveSectionDefaultMarks(section, 1),
      defaultNegativeMarks: deriveSectionDefaultNegativeMarks(section, 0),
      questions: questions
        .filter(Boolean)
        .map((item: any) => ({
          question:
            item?.question && typeof item.question === "object"
              ? item.question
              : { tags: [] },
          marks: item?.marks ?? 0,
          negativeMarks: item?.negativeMarks ?? 0,
        })),
    };
  });

  return (
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="editor"
        eyebrow="Assessments"
        title={paper.title || "Question Paper"}
        description="Review paper details, sections, question composition, and scoring rules from one consistent assessment workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </AppPrefetchLink>
            </Button>
            <PrintEditToolbar paperId={paper._id} />
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {paper.class?.name || "No class assigned"}
            </span>
            {paperSubjects.length > 0 ? (
              paperSubjects.map((subject: any) => (
                <span key={subject._id || subject.name} className="app-meta-chip">
                  {subject.name || subject._id}
                </span>
              ))
            ) : (
              <span className="app-meta-chip">No subject assigned</span>
            )}
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
            value: assignedAcademicSectionNames.length
              ? String(assignedAcademicSectionNames.length)
              : "All",
            meta: assignedAcademicSectionNames.length
              ? assignedAcademicSectionNames.join(", ")
              : "Available to all sections in the selected class.",
          },
        ]}
      />

      <div className="app-toolbar app-toolbar-compact">
        <div className="app-toolbar-row">
          <div className="app-toolbar-copy">
            <p className="app-toolbar-title">Paper actions</p>
            <p className="app-toolbar-note">
              Edit, duplicate, or create multiple copies without leaving this
              review page.
            </p>
          </div>
          <div className="app-toolbar-actions">
            <QuestionPaperToolbar paper={paper} />
          </div>
        </div>
      </div>

      <Card className="app-surface overflow-hidden xl:hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Paper Summary</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          <details open className="group rounded-xl border border-border/60 bg-background/72 px-3 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
              Section and scoring overview
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="mt-3">
              <PaperSummary
                sections={summarySections}
                totalPaperMarks={Number(paper.totalMarks ?? 0)}
                duration={Number(paper.duration ?? 0)}
                passingMarks={Number(paper.passingMarks ?? 0)}
                examDate={paper.examDate ?? ""}
                onlineEnabled={Boolean(paper.onlineEnabled)}
                onlineStartsAt={paper.onlineStartsAt ?? null}
                onlineEndsAt={paper.onlineEndsAt ?? null}
                subjects={paperSubjects.map((subject) => ({
                  _id: subject._id || "",
                  name: subject.name || "",
                }))}
              />
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-4">
          {paper.instructions ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body prose prose-sm max-w-none dark:prose-invert">
                <p className="whitespace-pre-line">{paper.instructions}</p>
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
                  <p className="app-detail-label">Subjects</p>
                  <div className="app-detail-value">
                    {paperSubjects.length > 0
                      ? paperSubjects
                          .map((subject: any) => subject?.name || subject?._id || "")
                          .filter(Boolean)
                          .join(", ")
                      : "-"}
                  </div>
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
              const sectionQuestions = Array.isArray(section?.questions)
                ? section.questions
                : [];
              const sectionSubjects = resolveSectionSubjects(
                section,
                paperSubjects,
              );
              const sectionDefaultMarks = deriveSectionDefaultMarks(section, 1);
              const sectionDefaultNegativeMarks =
                deriveSectionDefaultNegativeMarks(section, 0);

              return (
                <Card
                  key={section?._id || sectionIndex}
                  className="app-surface overflow-hidden"
                >
                  <CardHeader className="app-section-header">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {`Section ${sectionIndex + 1}: ${section?.name || "Untitled Section"}`}
                        </CardTitle>
                        {section?.description ? (
                          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                            {section.description}
                          </p>
                        ) : null}
                        {section?.instructions ? (
                          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-foreground/82">
                            {section.instructions}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {sectionSubjects.map((subject) => (
                          <Badge
                            key={`${section?._id || sectionIndex}-${subject._id}`}
                            variant="outline"
                          >
                            {subject.name || subject._id}
                          </Badge>
                        ))}
                        <Badge variant="outline">
                          {sectionQuestions.length} Questions
                        </Badge>
                        <Badge variant="secondary">{section?.marks ?? 0} Marks</Badge>
                        <Badge variant="secondary">
                          +{sectionDefaultMarks} / -{sectionDefaultNegativeMarks}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="app-section-body space-y-3">
                    {sectionQuestions.length === 0 ? (
                      <div className="app-empty-state">
                        No questions were added to this section.
                      </div>
                    ) : (
                      sectionQuestions.map((item: any, questionIndex: number) => {
                        const question =
                          item?.question && typeof item.question === "object"
                            ? item.question
                            : null;

                        return (
                          question ? (
                            <QuestionPaperReadOnlyQuestionCard
                              key={question?._id || `${sectionIndex}-${questionIndex}`}
                              questionNumber={questionIndex + 1}
                              marks={Number(item?.marks ?? 0)}
                              negativeMarks={Number(item?.negativeMarks ?? 0)}
                              question={{
                                ...question,
                                content:
                                  typeof question.content === "string"
                                    ? question.content
                                    : "",
                                tags: Array.isArray(question.tags)
                                  ? question.tags
                                  : [],
                                options: Array.isArray(question.options)
                                  ? question.options
                                  : [],
                                answerIndexes: Array.isArray(question.answerIndexes)
                                  ? question.answerIndexes
                                  : [],
                                createdAt: question.createdAt || "",
                              }}
                            />
                          ) : (
                            <div
                              key={`${sectionIndex}-${questionIndex}`}
                              className="app-empty-state py-4"
                            >
                              This question record is missing or no longer available.
                            </div>
                          )
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </main>

        <aside className="hidden space-y-4 print:hidden xl:block xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] xl:self-start">
          <PaperSummary
            sections={summarySections}
            totalPaperMarks={Number(paper.totalMarks ?? 0)}
            duration={Number(paper.duration ?? 0)}
            passingMarks={Number(paper.passingMarks ?? 0)}
            examDate={paper.examDate ?? ""}
            onlineEnabled={Boolean(paper.onlineEnabled)}
            onlineStartsAt={paper.onlineStartsAt ?? null}
            onlineEndsAt={paper.onlineEndsAt ?? null}
            subjects={paperSubjects.map((subject) => ({
              _id: subject._id || "",
              name: subject.name || "",
            }))}
          />
        </aside>
      </div>
    </PageShell>
  );
}
