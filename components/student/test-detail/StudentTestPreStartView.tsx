"use client";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Spinner } from "@/components/ui/spinner";
import { resolveSectionSubjects } from "@/lib/question-paper/subjects";

import type { StudentPaper } from "./student-test-types";

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_progress: "In Progress",
  upcoming: "Upcoming",
  submitted: "Submitted",
  auto_submitted: "Auto Submitted",
  expired: "Expired",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

type StudentTestPreStartViewProps = {
  paper: StudentPaper;
  paperSubjects: Array<{ _id: string; name: string }>;
  paperClassLabel: string;
  paperSubjectLabel: string;
  questionCount: number;
  hasManualReviewQuestions: boolean;
  testStatus: string;
  isStarting: boolean;
  actionError: string | null;
  testsHref: string;
  onStartAttempt: () => Promise<void>;
};

export default function StudentTestPreStartView({
  paper,
  paperSubjects,
  paperClassLabel,
  paperSubjectLabel,
  questionCount,
  hasManualReviewQuestions,
  testStatus,
  isStarting,
  actionError,
  testsHref,
  onStartAttempt,
}: StudentTestPreStartViewProps) {
  const effectiveStart = formatDateTime(paper.onlineStartsAt || paper.examDate);
  const effectiveEnd = formatDateTime(paper.onlineEndsAt);
  const statusLabel = STATUS_LABELS[testStatus] || testStatus;
  const canStartNow = testStatus === "available";
  const sectionSummaries = (Array.isArray(paper.sections) ? paper.sections : []).map(
    (section, index) => ({
      id: `${section.name}-${index}`,
      name: section.name || `Section ${index + 1}`,
      description: String(section.description || "").trim(),
      instructions: String(section.instructions || "").trim(),
      subjects: resolveSectionSubjects(section, paperSubjects),
      questionCount: Array.isArray(section.questions) ? section.questions.length : 0,
      totalMarks: Number(section.marks || 0),
      defaultMarks: Number(section.defaultMarks || 0),
      defaultNegativeMarks: Number(section.defaultNegativeMarks || 0),
    }),
  );

  return (
    <div className="app-student-page-shell">
      <PageHero
        eyebrow="Student Portal"
        title={paper.title}
        variant="overview"
        density="compact"
        description="Review details before you start."
        actions={
          <div className="app-student-action-cluster">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="app-student-action-secondary"
            >
              <AppPrefetchLink href={testsHref}>
                Back to Tests
              </AppPrefetchLink>
            </Button>
            <Button
              size="lg"
              className="app-student-action-primary"
              onClick={() => void onStartAttempt()}
              disabled={!canStartNow || isStarting}
            >
              {isStarting ? <Spinner /> : "Start Test"}
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">{statusLabel}</span>
            {paperSubjects.length > 0
              ? paperSubjects.map((subject) => (
                  <span key={subject._id} className="app-meta-chip">
                    {subject.name || subject._id}
                  </span>
                ))
              : null}
            {paperClassLabel ? (
              <span className="app-meta-chip">{paperClassLabel}</span>
            ) : null}
            <span className="app-meta-chip">{paper.duration} min</span>
          </>
        }
        stats={[
          {
            label: "Status",
            value: statusLabel,
            meta: canStartNow
              ? "Ready to start"
              : testStatus === "upcoming"
                ? "Opens at scheduled time"
                : "Unavailable now",
          },
          {
            label: "Questions",
            value: String(questionCount),
            meta: "Total",
          },
          {
            label: "Duration",
            value: `${paper.duration} min`,
            meta: "Single timer",
          },
          {
            label: "Marks",
            value: String(paper.totalMarks),
            meta: `Passing marks: ${paper.passingMarks}`,
          },
        ]}
      />

      {actionError ? (
        <FeedbackNotice variant="error">{actionError}</FeedbackNotice>
      ) : null}

      {testStatus === "upcoming" ? (
        <FeedbackNotice variant="info">
          This test opens at {effectiveStart}.
        </FeedbackNotice>
      ) : null}

      {testStatus === "expired" ? (
        <FeedbackNotice variant="error">
          This test is closed and can no longer be started.
        </FeedbackNotice>
      ) : null}

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          <div className="app-detail-grid app-exam-detail-grid">
            <div className="app-detail-item">
              <p className="app-detail-label">Subjects</p>
              <div className="app-detail-value">{paperSubjectLabel || "—"}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Class</p>
              <div className="app-detail-value">{paperClassLabel || "—"}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Passing Marks</p>
              <div className="app-detail-value">{paper.passingMarks}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Total Marks</p>
              <div className="app-detail-value">{paper.totalMarks}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Online Start</p>
              <div className="app-detail-value">{effectiveStart}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Online End</p>
              <div className="app-detail-value">{effectiveEnd}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {sectionSummaries.length > 0 ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Test Structure</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body space-y-3">
            {sectionSummaries.map((section, index) => (
              <div
                key={section.id}
                className="rounded-[1.2rem] border border-border/60 bg-muted/15 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <p className="app-title-sm">
                      {`Section ${index + 1}: ${section.name}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {section.questionCount} question{section.questionCount === 1 ? "" : "s"} • {section.totalMarks} marks • +{section.defaultMarks} / -{section.defaultNegativeMarks}
                    </p>
                    {section.description ? (
                      <p className="whitespace-pre-line text-sm text-muted-foreground">
                        {section.description}
                      </p>
                    ) : null}
                    {section.instructions ? (
                      <p className="whitespace-pre-line text-sm leading-6 text-foreground/82">
                        {section.instructions}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {section.subjects.length > 0 ? (
                      section.subjects.map((subject) => (
                        <span key={`${section.id}-${subject._id}`} className="app-meta-chip">
                          {subject.name || subject._id}
                        </span>
                      ))
                    ) : (
                      <span className="app-meta-chip">Subject mix pending</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {hasManualReviewQuestions ? (
        <FeedbackNotice variant="info">
          Descriptive answers are reviewed after submission.
        </FeedbackNotice>
      ) : null}

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
    </div>
  );
}
