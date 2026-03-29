"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { listStudentTestDraftMeta } from "@/lib/student-test-draft";

const StudentTestsFilters = dynamic(
  () => import("@/components/student/StudentTestsFilters"),
  {
    ssr: false,
    loading: () => <div className="h-[5.5rem] rounded-xl border border-border/60" />,
  },
);

export type StudentTest = {
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
  subjects?: Array<{ _id: string; name: string }> | null;
  status: string;
  remainingTimeMs?: number | null;
  requiresManualReview?: boolean;
  attempt?: {
    _id?: string;
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

const DISPLAY_STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  available: 1,
  upcoming: 2,
  auto_submitted: 3,
  submitted: 4,
  expired: 5,
};

const ALL_TESTS_VALUE = "all-tests";
const ALL_SUBJECTS_VALUE = "all-subjects";

function getTestSubjects(test: StudentTest) {
  const explicitSubjects = Array.isArray(test.subjects) ? test.subjects : [];
  if (explicitSubjects.length > 0) {
    return explicitSubjects;
  }

  return test.subject ? [test.subject] : [];
}

function formatSubjectList(test: StudentTest) {
  return getTestSubjects(test)
    .map((subject) => String(subject?.name || "").trim())
    .filter(Boolean)
    .join(", ");
}

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

function getActionVariant(
  test: StudentTest,
): "default" | "secondary" | "outline" {
  if (test.status === "submitted" || test.status === "auto_submitted") {
    return "secondary";
  }

  if (test.status === "available" || test.status === "in_progress") {
    return "default";
  }

  return "outline";
}

function getActionLabel(test: StudentTest) {
  if (test.status === "in_progress") return "Continue";
  if (test.status === "available") return "Start";
  if (test.status === "submitted" || test.status === "auto_submitted") {
    return "Open Analysis Report";
  }
  return "Open";
}

function getTimingChip(test: StudentTest) {
  if (test.status === "in_progress") {
    return `Time left ${formatRemainingTime(test.remainingTimeMs)}`;
  }

  if (
    (test.status === "submitted" || test.status === "auto_submitted") &&
    test.attempt?.submittedAt
  ) {
    return `Submitted ${formatDateTime(test.attempt.submittedAt)}`;
  }

  if (test.status === "upcoming") {
    return `Opens ${formatDateTime(test.onlineStartsAt || test.examDate)}`;
  }

  if (test.onlineEndsAt) {
    return `Closes ${formatDateTime(test.onlineEndsAt)}`;
  }

  return `Opens ${formatDateTime(test.onlineStartsAt || test.examDate)}`;
}

function getTestSortTimestamp(test: StudentTest) {
  const candidateValues = [
    test.status === "submitted" || test.status === "auto_submitted"
      ? test.attempt?.submittedAt
      : null,
    test.onlineStartsAt,
    test.examDate,
    test.onlineEndsAt,
  ];

  for (const value of candidateValues) {
    if (!value) continue;
    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function compareStudentTests(left: StudentTest, right: StudentTest) {
  const leftRank = DISPLAY_STATUS_ORDER[left.status] ?? 99;
  const rightRank = DISPLAY_STATUS_ORDER[right.status] ?? 99;
  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  const timestampDiff = getTestSortTimestamp(right) - getTestSortTimestamp(left);
  if (timestampDiff !== 0) {
    return timestampDiff;
  }

  return String(left.title || "").localeCompare(String(right.title || ""));
}

function getTestActionDetails(test: StudentTest) {
  const detailHref = `/student/tests/${test._id}`;
  const reportApiPrefetch = test.attempt?._id
    ? [`/api/analytics/student-tag-report/${test.attempt._id}?groupFields=1`]
    : undefined;
  const reportHref = test.attempt?._id
    ? buildHrefWithReturnTo(`/student/reports/${test.attempt._id}`, "/student/tests")
    : null;
  const opensReport =
    reportHref &&
    (test.status === "submitted" || test.status === "auto_submitted");

  return {
    actionLabel: getActionLabel(test),
    actionVariant: getActionVariant(test),
    actionHref: opensReport ? reportHref : detailHref,
    relatedApiPrefetches: opensReport
      ? reportApiPrefetch
      : [`/api/student/tests/${test._id}`],
  };
}

export default function StudentTestsPageClient({
  initialTests,
  initialError,
  submissionNotice,
}: {
  initialTests: StudentTest[];
  initialError: string | null;
  submissionNotice: string | null;
}) {
  const [tests, setTests] = useState<StudentTest[]>(initialTests);
  const [error, setError] = useState<string | null>(initialError);
  const [clientReady, setClientReady] = useState(false);
  const [testFilter, setTestFilter] = useState(ALL_TESTS_VALUE);
  const [subjectFilter, setSubjectFilter] = useState(ALL_SUBJECTS_VALUE);
  const [draftUpdatedAtByPaperId, setDraftUpdatedAtByPaperId] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    setTests(initialTests);
    setError(initialError);
  }, [initialError, initialTests]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshDraftMeta = () => {
      const map: Record<string, number> = {};
      listStudentTestDraftMeta().forEach((draft) => {
        if (!draft.paperId) return;
        const updatedAt = Number(draft.updatedAt || 0);
        map[draft.paperId] =
          Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
      });
      setDraftUpdatedAtByPaperId(map);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDraftMeta();
      }
    };

    refreshDraftMeta();
    window.addEventListener("focus", refreshDraftMeta);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshDraftMeta);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const subjectOptions = useMemo(() => {
    const subjectMap = new Map<string, string>();

    tests.forEach((test) => {
      getTestSubjects(test).forEach((subject) => {
        const subjectId = String(subject?._id || "").trim();
        const subjectName = String(subject?.name || "").trim();
        if (subjectId && subjectName) {
          subjectMap.set(subjectId, subjectName);
        }
      });
    });

    return Array.from(subjectMap.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [tests]);

  const sortedTests = useMemo(() => {
    return [...tests].sort(compareStudentTests);
  }, [tests]);

  const testOptions = useMemo<SearchableCommandOption[]>(() => {
    return [
      {
        value: ALL_TESTS_VALUE,
        label: "All tests",
      },
      ...sortedTests.map((test) => ({
        value: test._id,
        label: String(test.title || "Untitled test").trim() || "Untitled test",
        description: [formatSubjectList(test), test.class?.name]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" • "),
        keywords: [
          formatSubjectList(test),
          String(test.class?.name || "").trim(),
        ].filter(Boolean),
      })),
    ];
  }, [sortedTests]);

  const filteredTests = useMemo(() => {
    return sortedTests.filter((test) => {
      const matchesTest =
        testFilter === ALL_TESTS_VALUE || test._id === testFilter;
      const matchesSubject =
        subjectFilter === ALL_SUBJECTS_VALUE ||
        getTestSubjects(test).some(
          (subject) => String(subject?._id || "").trim() === subjectFilter,
        );

      return matchesTest && matchesSubject;
    });
  }, [sortedTests, subjectFilter, testFilter]);

  const recentAssignedTest = useMemo(() => {
    return (
      sortedTests.find(
        (test) => test.status === "in_progress" || test.status === "available",
      ) ||
      sortedTests.find((test) => test.status === "upcoming") ||
      null
    );
  }, [sortedTests]);

  const recentAssignedTestMeta = useMemo(() => {
    if (!recentAssignedTest) return "";

    const parts = [
      formatSubjectList(recentAssignedTest),
      String(recentAssignedTest.class?.name || "").trim(),
      getTimingChip(recentAssignedTest),
      recentAssignedTest.status === "in_progress" &&
      draftUpdatedAtByPaperId[recentAssignedTest._id]
        ? `Local draft ${formatDateTime(new Date(draftUpdatedAtByPaperId[recentAssignedTest._id]).toISOString())}`
        : "",
    ].filter(Boolean);

    return parts.join(" • ");
  }, [draftUpdatedAtByPaperId, recentAssignedTest]);

  const recentAssignedTestAction = useMemo(() => {
    return recentAssignedTest ? getTestActionDetails(recentAssignedTest) : null;
  }, [recentAssignedTest]);

  const queueSummary = useMemo(() => {
    return tests.reduce(
      (summary, test) => {
        if (test.status === "in_progress") {
          summary.inProgress += 1;
        }
        if (test.status === "available") {
          summary.readyNow += 1;
        }
        if (test.status === "submitted" || test.status === "auto_submitted") {
          summary.reportsReady += 1;
        }
        return summary;
      },
      {
        inProgress: 0,
        readyNow: 0,
        reportsReady: 0,
      },
    );
  }, [tests]);

  const showFilters = tests.length > 1 || subjectOptions.length > 1;
  const filterActive =
    testFilter !== ALL_TESTS_VALUE || subjectFilter !== ALL_SUBJECTS_VALUE;

  if (error) {
    return (
      <div
        className="app-student-page-shell"
        data-student-tests-client-ready={clientReady ? "true" : "false"}
      >
        <PageHero
          eyebrow="Student Portal"
          title="Tests"
          variant="overview"
          description="View and continue your assigned tests."
          meta={
            <>
              <span className="app-meta-chip">Draft recovery on this device</span>
              <span className="app-meta-chip">Analysis reports</span>
            </>
          }
          stats={[
            {
              label: "Assigned",
              value: String(tests.length),
              meta: "In your queue",
            },
            {
              label: "Ready Now",
              value: String(queueSummary.readyNow),
              meta: "Start now",
            },
            {
              label: "In Progress",
              value: String(queueSummary.inProgress),
              meta: "Continue",
            },
            {
              label: "Reports Ready",
              value: String(queueSummary.reportsReady),
              meta: "Review",
            },
          ]}
        >
          <div className="sm:hidden">
            <StudentPortalNav />
          </div>
        </PageHero>
        <FeedbackNotice variant="error">{error}</FeedbackNotice>
      </div>
    );
  }

  return (
    <div
      className="app-student-page-shell"
      data-student-tests-client-ready={clientReady ? "true" : "false"}
    >
      <PageHero
        eyebrow="Student Portal"
        title="Tests"
        variant="overview"
        description="View and continue your assigned tests."
        meta={
          <>
            <span className="app-meta-chip">Draft recovery on this device</span>
            <span className="app-meta-chip">
              {subjectOptions.length} subject{subjectOptions.length === 1 ? "" : "s"} in queue
            </span>
            <span className="app-meta-chip">Analysis reports</span>
          </>
        }
        stats={[
          {
            label: "Assigned",
            value: String(tests.length),
            meta: "In your queue",
          },
          {
            label: "Ready Now",
            value: String(queueSummary.readyNow),
            meta: "Start now",
          },
          {
            label: "In Progress",
            value: String(queueSummary.inProgress),
            meta: "Continue",
          },
          {
            label: "Reports Ready",
            value: String(queueSummary.reportsReady),
            meta: "Review",
          },
        ]}
      >
        <div className="sm:hidden">
          <StudentPortalNav />
        </div>
      </PageHero>

      {submissionNotice ? (
        <FeedbackNotice variant="success">
          {submissionNotice}
        </FeedbackNotice>
      ) : null}

      {recentAssignedTest ? (
        <div className="app-toolbar">
          <div className="app-toolbar-row">
            <div className="app-toolbar-copy">
              <p className="app-kicker">Latest</p>
              <p className="app-title-md">{recentAssignedTest.title}</p>
              {recentAssignedTestMeta ? (
                <p className="app-copy-meta">{recentAssignedTestMeta}</p>
              ) : null}
            </div>
            <div className="app-toolbar-actions">
              <span className="app-meta-chip">
                {STATUS_LABELS[recentAssignedTest.status] || recentAssignedTest.status}
              </span>
              {recentAssignedTestAction ? (
                <Button
                  asChild
                  size="lg"
                  variant={recentAssignedTestAction.actionVariant}
                  className="app-student-action-secondary"
                >
                  <AppPrefetchLink
                    href={recentAssignedTestAction.actionHref}
                    relatedApiPrefetches={recentAssignedTestAction.relatedApiPrefetches}
                  >
                    {recentAssignedTestAction.actionLabel}
                  </AppPrefetchLink>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="app-toolbar space-y-3">
        {showFilters ? (
          <StudentTestsFilters
            testFilter={testFilter}
            testOptions={testOptions}
            onTestFilterChange={setTestFilter}
            subjectFilter={subjectFilter}
            subjectOptions={subjectOptions}
            onSubjectFilterChange={setSubjectFilter}
            allSubjectsValue={ALL_SUBJECTS_VALUE}
          />
        ) : null}

        <div
          className={
            showFilters
              ? "flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3"
              : "flex flex-wrap items-center justify-between gap-3"
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="app-meta-chip">
              {filteredTests.length} exam{filteredTests.length === 1 ? "" : "s"}
            </span>
            {testFilter !== ALL_TESTS_VALUE ? (
              <span className="app-meta-chip">
                {
                  testOptions.find((option) => option.value === testFilter)
                    ?.label
                }
              </span>
            ) : null}
            {subjectFilter !== ALL_SUBJECTS_VALUE ? (
              <span className="app-meta-chip">
                {
                  subjectOptions.find((option) => option.value === subjectFilter)
                    ?.label
                }
              </span>
            ) : null}
          </div>
          {filterActive ? (
            <Button
              variant="outline"
              size="md"
              className="app-student-action-compact"
              onClick={() => {
                setTestFilter(ALL_TESTS_VALUE);
                setSubjectFilter(ALL_SUBJECTS_VALUE);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Assigned Tests</CardTitle>
            <span className="app-meta-chip">
              {filteredTests.length === tests.length
                ? `${tests.length} total`
                : `${filteredTests.length} of ${tests.length}`}
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTests.length === 0 ? (
            <div className="app-empty-state rounded-none border-0 py-10">
              {filterActive
                ? "No exams match the current filters."
                : "No online tests are assigned right now."}
            </div>
          ) : (
            <div className="app-table-wrap rounded-none border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[24rem]">Test</TableHead>
                    <TableHead className="w-[14rem]">Window</TableHead>
                    <TableHead className="w-[14rem]">Attempt</TableHead>
                    <TableHead className="w-[14rem]">Result</TableHead>
                    <TableHead className="text-right min-w-[10rem]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests.map((test) => {
                    const actionDetails = getTestActionDetails(test);
                    const subjectLabels = getTestSubjects(test);
                    const classLabel = String(test.class?.name || "").trim();
                    const hasLocalDraft =
                      test.status === "in_progress" &&
                      Boolean(draftUpdatedAtByPaperId[test._id]);
                    const scoreVisible =
                      (test.status === "submitted" ||
                        test.status === "auto_submitted") &&
                      test.attempt;

                    return (
                      <TableRow key={test._id}>
                        <TableCell>
                          <div className="min-w-[17rem] space-y-2">
                            <div className="app-list-title">{test.title}</div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {classLabel ? (
                                <Badge variant="secondary">{classLabel}</Badge>
                              ) : null}
                              {subjectLabels.length > 0 ? (
                                subjectLabels.map((subject) => (
                                  <Badge key={subject._id} variant="outline">
                                    {subject.name || subject._id}
                                  </Badge>
                                ))
                              ) : (
                                <span className="app-list-meta">No subject</span>
                              )}
                            </div>
                            <div className="app-list-meta">
                              {test.onlineEndsAt
                                ? `Closes ${formatDateTime(test.onlineEndsAt)}`
                                : "Online test"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="app-list-value">
                              Opens {formatDateTime(test.onlineStartsAt || test.examDate)}
                            </div>
                            <div className="app-list-meta">
                              Closes {formatDateTime(test.onlineEndsAt)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[11rem] space-y-1.5">
                            <Badge variant={getStatusVariant(test.status)}>
                              {STATUS_LABELS[test.status] || test.status}
                            </Badge>
                            <div className="app-list-meta">
                              {getTimingChip(test)}
                            </div>
                            {hasLocalDraft ? (
                              <div className="app-list-meta text-amber-700 dark:text-amber-300">
                                Local draft saved on this device
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[12rem] space-y-1">
                            <div className="app-list-value">
                              {test.duration} min • {test.totalMarks} marks
                            </div>
                            <div className="app-list-meta">
                              Pass {test.passingMarks}
                            </div>
                            {scoreVisible ? (
                              <>
                                <div className="app-list-value">
                                  Score {test.attempt?.totalMarksAwarded ?? 0} / {test.totalMarks}
                                </div>
                                <div className="app-list-meta">
                                  {test.requiresManualReview
                                    ? "Auto-graded only"
                                    : "Final score"}
                                </div>
                                {test.requiresManualReview ? (
                                  <div className="app-list-meta">
                                    Manual review pending
                                  </div>
                                ) : null}
                              </>
                            ) : (
                              <div className="app-list-meta">Not submitted yet</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            size="md"
                            variant={actionDetails.actionVariant}
                            className="app-student-action-compact"
                          >
                            <AppPrefetchLink
                              href={actionDetails.actionHref}
                              relatedApiPrefetches={actionDetails.relatedApiPrefetches}
                            >
                              {actionDetails.actionLabel}
                            </AppPrefetchLink>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end">
        <a
          href="https://wa.me/919550250860?text=Hello%2C%20I%20need%20help%20with%20my%20online%20test."
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--home-border)/0.7)] bg-[hsl(var(--home-surface)/0.52)] px-4 py-2 text-xs font-medium text-[hsl(var(--home-text))] transition-colors hover:bg-[hsl(var(--home-surface)/0.68)]"
        >
          <MessageCircle className="h-4 w-4" />
          Need help?
        </a>
      </div>
    </div>
  );
}
