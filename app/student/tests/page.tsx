"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
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

function StudentTestsPageContent() {
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

export default function StudentTestsPage() {
  return (
    <Suspense
      fallback={
        <PageLoadingState
          title="Loading assigned tests"
          description="Preparing your available online tests and saved attempts."
        />
      }
    >
      <StudentTestsPageContent />
    </Suspense>
  );
}
