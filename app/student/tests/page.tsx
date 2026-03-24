"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageLoadingState from "@/components/ui/page-loading-state";
import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from "@/components/ui/searchable-command-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { fetchApiJson } from "@/lib/client/api";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import { listStudentTestDraftMeta } from "@/lib/student-test-draft";

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
  const reportHref = test.attempt?._id
    ? buildHrefWithReturnTo(`/student/reports/${test.attempt._id}`, "/student/tests")
    : null;
  const opensReport =
    reportHref &&
    (test.status === "submitted" || test.status === "auto_submitted");

  return {
    actionLabel: getActionLabel(test),
    actionHref: opensReport ? reportHref : detailHref,
    relatedApiPrefetches: opensReport ? undefined : [`/api/student/tests/${test._id}`],
  };
}

function StudentTestsPageContent() {
  const searchParams = useSearchParams();
  const [tests, setTests] = useState<StudentTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testFilter, setTestFilter] = useState(ALL_TESTS_VALUE);
  const [subjectFilter, setSubjectFilter] = useState(ALL_SUBJECTS_VALUE);
  const [draftUpdatedAtByPaperId, setDraftUpdatedAtByPaperId] = useState<
    Record<string, number>
  >({});

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

  const submissionNotice = useMemo(() => {
    return searchParams.get("submitted") === "1"
      ? "Test submitted."
      : null;
  }, [searchParams]);

  const subjectOptions = useMemo(() => {
    const subjectMap = new Map<string, string>();

    tests.forEach((test) => {
      const subjectId = String(test.subject?._id || "").trim();
      const subjectName = String(test.subject?.name || "").trim();
      if (subjectId && subjectName) {
        subjectMap.set(subjectId, subjectName);
      }
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
        description: [test.subject?.name, test.class?.name]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" • "),
        keywords: [
          String(test.subject?.name || "").trim(),
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
        String(test.subject?._id || "") === subjectFilter;

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
      String(recentAssignedTest.subject?.name || "").trim(),
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

  const showFilters = tests.length > 1 || subjectOptions.length > 1;
  const filterActive =
    testFilter !== ALL_TESTS_VALUE || subjectFilter !== ALL_SUBJECTS_VALUE;

  if (loading) {
    return (
      <PageLoadingState
        title="Loading tests"
        description="Preparing your exams."
      />
    );
  }

  if (error) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero eyebrow="Student Portal" title="Tests">
          <StudentPortalNav />
        </PageHero>
        <FeedbackNotice variant="error">{error}</FeedbackNotice>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero eyebrow="Student Portal" title="Tests">
        <StudentPortalNav />
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
              <p className="app-toolbar-title">Latest Assigned Test</p>
              <p className="app-toolbar-note">
                {recentAssignedTest.title}
                {recentAssignedTestMeta ? ` • ${recentAssignedTestMeta}` : ""}
              </p>
            </div>
            <div className="app-toolbar-actions">
              <span className="app-meta-chip">
                {STATUS_LABELS[recentAssignedTest.status] || recentAssignedTest.status}
              </span>
              {recentAssignedTestAction ? (
                <Button asChild size="sm" className="app-button-compact">
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

      <div className="app-toolbar space-y-4">
        {showFilters ? (
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="space-y-2">
              <label className="app-field-label">
                Test
              </label>
              <SearchableCommandSelect
                value={testFilter}
                options={testOptions}
                onValueChange={setTestFilter}
                placeholder="All tests"
                searchPlaceholder="Search tests..."
                emptyText="No tests found."
                triggerClassName="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="student-test-subject"
                className="app-field-label"
              >
                Subject
              </label>
              <Select
                value={subjectFilter}
                onValueChange={setSubjectFilter}
              >
                <SelectTrigger
                  id="student-test-subject"
                  className="h-10"
                >
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SUBJECTS_VALUE}>
                    All subjects
                  </SelectItem>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={subject.value} value={subject.value}>
                      {subject.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        <div
          className={
            showFilters
              ? "flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3.5"
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
              onClick={() => {
                setTestFilter(ALL_TESTS_VALUE);
                setSubjectFilter(ALL_SUBJECTS_VALUE);
              }}
            >
              Clear Filters
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
            <div className="app-empty-state rounded-none border-0 py-12">
              {filterActive
                ? "No exams match the current filters."
                : "No online tests are assigned right now."}
            </div>
          ) : (
            <div className="app-table-wrap rounded-none border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[18rem]">Test</TableHead>
                    <TableHead className="w-[11rem]">Subject</TableHead>
                    <TableHead className="w-[11rem]">Class</TableHead>
                    <TableHead className="w-[8rem]">Duration</TableHead>
                    <TableHead className="w-[9rem]">Marks</TableHead>
                    <TableHead className="w-[14rem]">Status</TableHead>
                    <TableHead className="w-[12rem]">Score</TableHead>
                    <TableHead className="text-right min-w-[10rem]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTests.map((test) => {
                    const actionDetails = getTestActionDetails(test);
                    const subjectLabel = String(test.subject?.name || "").trim();
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
                          <div className="min-w-[15rem] space-y-2">
                            <div className="font-medium leading-5">{test.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {test.onlineEndsAt
                                ? `Closes ${formatDateTime(test.onlineEndsAt)}`
                                : "Online test"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{subjectLabel || "-"}</TableCell>
                        <TableCell>{classLabel || "-"}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{test.duration} min</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateTime(test.onlineStartsAt || test.examDate)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{test.totalMarks} total</div>
                            <div className="text-xs text-muted-foreground">
                              Pass {test.passingMarks}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[12rem] space-y-2">
                            <Badge variant={getStatusVariant(test.status)}>
                              {STATUS_LABELS[test.status] || test.status}
                            </Badge>
                            <div className="text-xs leading-5 text-muted-foreground">
                              {getTimingChip(test)}
                            </div>
                            {hasLocalDraft ? (
                              <div className="text-xs leading-5 text-amber-700 dark:text-amber-300">
                                Local draft saved on this device
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {scoreVisible ? (
                            <div className="min-w-[10rem] space-y-1">
                              <div className="font-medium">
                                {test.attempt?.totalMarksAwarded ?? 0} / {test.totalMarks}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {test.requiresManualReview
                                  ? "Auto-graded only"
                                  : "Final score"}
                              </div>
                              {test.requiresManualReview ? (
                                <div className="text-xs text-muted-foreground">
                                  Manual review pending
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" className="app-button-compact min-w-[9rem]">
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
    </div>
  );
}

export default function StudentTestsPage() {
  return (
    <Suspense
      fallback={
        <PageLoadingState
          title="Loading tests"
          description="Preparing your exams."
        />
      }
    >
      <StudentTestsPageContent />
    </Suspense>
  );
}
