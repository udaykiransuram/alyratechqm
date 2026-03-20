"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import PageHero from "@/components/layout/PageHero";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLoadingState from "@/components/ui/page-loading-state";
import { fetchApiJson } from "@/lib/client/api";

type StudentTest = {
  _id: string;
  title: string;
  duration: number;
  passingMarks: number;
  totalMarks: number;
  examDate?: string | null;
  onlineStartsAt?: string | null;
  onlineEndsAt?: string | null;
  class?: { _id: string; name: string } | null;
  subject?: { _id: string; name: string } | null;
  status: string;
  remainingTimeMs?: number | null;
  requiresManualReview?: boolean;
  attempt?: {
    submittedAt?: string | null;
    status?: string;
    totalMarksAwarded?: number;
  } | null;
};

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

function formatRemainingTime(value?: number | null) {
  if (value === null || value === undefined) return "—";
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function getStatusVariant(status: string) {
  if (status === "available" || status === "in_progress") return "default";
  if (status === "submitted" || status === "auto_submitted") return "secondary";
  return "outline";
}

export default function StudentTestsPage() {
  const searchParams = useSearchParams();
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTests() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchApiJson<any>("/api/student/tests", {
          cache: "no-store",
          fallbackMessage: "Failed to load assigned tests.",
        });
        if (!mounted) return;
        setTests(Array.isArray(data.tests) ? data.tests : []);
      } catch (loadError: any) {
        if (!mounted) return;
        setError(loadError?.message || "Failed to load assigned tests.");
        setTests([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTests();

    return () => {
      mounted = false;
    };
  }, []);

  const submissionNotice = useMemo(() => {
    return searchParams.get("submitted") === "1"
      ? "Your test has been submitted successfully."
      : null;
  }, [searchParams]);

  const inProgressCount = useMemo(
    () => tests.filter((test) => test.status === "in_progress").length,
    [tests],
  );

  const submittedCount = useMemo(
    () =>
      tests.filter(
        (test) =>
          test.status === "submitted" || test.status === "auto_submitted",
      ).length,
    [tests],
  );

  const availableCount = useMemo(
    () => tests.filter((test) => test.status === "available").length,
    [tests],
  );

  if (loading) {
    return (
      <PageLoadingState
        title="Loading assigned tests"
        description="Preparing your available online tests and saved attempts."
      />
    );
  }

  if (error) {
    return (
      <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
        <PageHero
          eyebrow="Student Portal"
          title="Student Tests"
          description="Review assigned tests, continue active attempts, and submit online assessments."
          meta={
            <>
              <span className="app-meta-chip">Autosave enabled</span>
              <span className="app-meta-chip">Server-side deadlines</span>
            </>
          }
        >
          <StudentPortalNav />
        </PageHero>
        <div className="app-feedback app-feedback-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Student Portal"
        title="Student Tests"
        description="Start assigned online tests, resume saved work, and review submitted attempts."
        meta={
          <>
            <span className="app-meta-chip">Objective and descriptive support</span>
            <span className="app-meta-chip">Resume saved attempts</span>
          </>
        }
        stats={[
          {
            label: "Assigned tests",
            value: String(tests.length),
            meta: "All papers currently visible to your account.",
          },
          {
            label: "Ready now",
            value: String(availableCount),
            meta: "Tests currently open and available to start.",
          },
          {
            label: "In progress",
            value: String(inProgressCount),
            meta: "Attempts with active saved work and remaining time.",
          },
          {
            label: "Submitted",
            value: String(submittedCount),
            meta: "Completed or auto-submitted attempts.",
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

      {submissionNotice ? (
        <div className="app-feedback app-feedback-success">
          {submissionNotice}
        </div>
      ) : null}

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">How this portal works</p>
          <h2 className="app-spotlight-title">
            Start when the paper opens, save as you go, and submit from the same test flow
          </h2>
          <p className="app-spotlight-copy">
            Each visible test is already matched to your student account. The
            portal keeps your saved work attached to the same attempt, then
            blocks further edits once the test is submitted or auto-submitted.
          </p>
          <div className="app-flow-list">
            <div className="app-flow-item">
              <div className="app-flow-index">1</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Available</p>
                <p className="app-flow-note">
                  The paper is inside its live schedule window and you can start now.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">2</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">In progress</p>
                <p className="app-flow-note">
                  Your saved attempt already exists, so you can continue from the same paper.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">3</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Submitted or expired</p>
                <p className="app-flow-note">
                  Submitted attempts stay visible for review, while expired papers stop accepting work.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Student checklist</p>
          <h2 className="text-lg font-semibold text-foreground">
            Small checks before opening a test
          </h2>
          <div className="mt-4 space-y-2">
            <div className="app-note-item">
              Open the paper only when you are ready to stay with the test window and finish within the timer.
            </div>
            <div className="app-note-item">
              Use the portal status badge to tell whether you should start, continue, or just review a submission.
            </div>
            <div className="app-note-item">
              If a paper includes descriptive questions, the final score may still wait for manual review after submission.
            </div>
          </div>
        </div>
      </div>

      {tests.length === 0 ? (
        <Card className="app-surface">
          <CardContent className="app-empty-state py-12">
            No online tests are assigned to you right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tests.map((test) => {
            const actionLabel =
              test.status === "in_progress"
                ? "Continue Test"
                : test.status === "available"
                  ? "Start Test"
                  : test.status === "submitted" || test.status === "auto_submitted"
                    ? "View Submission"
                    : "View Details";

            return (
              <Card key={test._id} className="app-surface overflow-hidden">
                <CardHeader className="app-section-header space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">{test.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {test.subject?.name || "Subject"} • {test.class?.name || "Class"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getStatusVariant(test.status)}>
                        {STATUS_LABELS[test.status] || test.status}
                      </Badge>
                      <Badge variant="outline">{test.totalMarks} marks</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Duration
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {test.duration} minutes
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Passing Marks
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {test.passingMarks} / {test.totalMarks}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Opens
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {formatDateTime(test.onlineStartsAt || test.examDate)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Closes
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {formatDateTime(test.onlineEndsAt)}
                      </p>
                    </div>
                  </div>

                  {test.status === "in_progress" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Time remaining: {formatRemainingTime(test.remainingTimeMs)}
                    </div>
                  ) : null}

                  {(test.status === "submitted" || test.status === "auto_submitted") &&
                  test.attempt ? (
                    <div className="space-y-2">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {test.requiresManualReview ? "Auto-graded score" : "Score"}:{" "}
                        {test.attempt.totalMarksAwarded ?? 0} / {test.totalMarks}
                      </div>
                      {test.requiresManualReview ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          Descriptive answers are still pending manual review.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end">
                    <Button asChild>
                      <Link href={`/student/tests/${test._id}`}>{actionLabel}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
