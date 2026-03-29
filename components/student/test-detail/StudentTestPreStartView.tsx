"use client";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Spinner } from "@/components/ui/spinner";

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

  return (
    <div className="app-student-page-shell">
      <PageHero
        eyebrow="Student Portal"
        title={paper.title}
        variant="overview"
        description="Review the test window, instructions, and scoring details before you begin your online attempt."
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
              ? "This test is ready to begin now."
              : testStatus === "upcoming"
                ? "Wait for the scheduled opening time."
                : "This test is not currently available to start.",
          },
          {
            label: "Questions",
            value: String(questionCount),
            meta: "Questions across every section in this paper.",
          },
          {
            label: "Duration",
            value: `${paper.duration} min`,
            meta: "One timer runs for the full test once you start.",
          },
          {
            label: "Marks",
            value: String(paper.totalMarks),
            meta: `Passing marks: ${paper.passingMarks}`,
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

      {actionError ? (
        <FeedbackNotice variant="error">{actionError}</FeedbackNotice>
      ) : null}

      {testStatus === "upcoming" ? (
        <FeedbackNotice variant="info">
          This test has not opened yet. Online access starts at {effectiveStart}.
        </FeedbackNotice>
      ) : null}

      {testStatus === "expired" ? (
        <FeedbackNotice variant="error">
          This test is closed and can no longer be started.
        </FeedbackNotice>
      ) : null}

      <div className="app-toolbar">
        <div className="app-toolbar-row">
          <div className="app-toolbar-copy">
            <p className="app-toolbar-title">Before you start</p>
            <p className="app-toolbar-note">
              Double-check the test window, scoring, and review rules before launching the timer.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-meta-chip">{questionCount} questions</span>
            <span className="app-meta-chip">Opens {effectiveStart}</span>
            <span className="app-meta-chip">Closes {effectiveEnd}</span>
            <span className="app-meta-chip">Passing {paper.passingMarks}</span>
          </div>
        </div>
      </div>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Test Details</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          <div className="app-detail-grid">
            <div className="app-detail-item">
              <p className="app-detail-label">Status</p>
              <div className="app-detail-value">{statusLabel}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Subjects</p>
              <div className="app-detail-value">{paperSubjectLabel || "—"}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Class</p>
              <div className="app-detail-value">{paperClassLabel || "—"}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Questions</p>
              <div className="app-detail-value">{questionCount}</div>
            </div>
            <div className="app-detail-item">
              <p className="app-detail-label">Duration</p>
              <div className="app-detail-value">{paper.duration} min</div>
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

      {hasManualReviewQuestions ? (
        <FeedbackNotice variant="info">
          Descriptive answers will be reviewed after submission.
        </FeedbackNotice>
      ) : null}

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
    </div>
  );
}
