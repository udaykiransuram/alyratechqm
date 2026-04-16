"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPagination from "@/components/ui/list-pagination";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson } from "@/lib/client/api";
import { getSchoolKeyFromCookie } from "@/lib/client/school";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import type { WorkspacePaperResponsesSummaryData } from "@/lib/server/workspace-paper-responses";

const PAPER_RESPONSES_PAGE_SIZE = 40;
const PAPER_RESPONSES_CACHE_TTL_MS = 30_000;

type ResponsePageCacheEntry = {
  responses: WorkspacePaperResponsesSummaryData["responses"];
  academicSections: WorkspacePaperResponsesSummaryData["academicSections"];
  totalResponses: number;
  pages: number;
  page: number;
  fetchedAt: number;
};

type QuestionPaperResponsesPageClientProps = {
  paperId: string;
  schoolKey: string;
  initialData: WorkspacePaperResponsesSummaryData;
  initialAcademicSection: string;
  initialError?: string | null;
};

function buildResponsesQueryStringForCache(
  paperId: string,
  targetPage: number,
  targetAcademicSection: string,
) {
  const queryParams = new URLSearchParams({
    paper: paperId,
    summary: "1",
    page: String(targetPage),
    limit: String(PAPER_RESPONSES_PAGE_SIZE),
  });
  if (targetAcademicSection !== "all") {
    queryParams.set("academicSectionId", targetAcademicSection);
  }
  return queryParams.toString();
}

function buildResponsesCacheKey(
  schoolKey: string,
  paperId: string,
  targetPage: number,
  targetAcademicSection: string,
) {
  return `${schoolKey}::${paperId}::${buildResponsesQueryStringForCache(
    paperId,
    targetPage,
    targetAcademicSection,
  )}`;
}

function createResponseCacheEntry(
  data: WorkspacePaperResponsesSummaryData | any,
  fallbackPage: number,
): ResponsePageCacheEntry {
  const resolvedPage = Math.max(1, Number(data?.page) || fallbackPage);
  return {
    responses: Array.isArray(data?.responses) ? data.responses : [],
    academicSections: Array.isArray(data?.academicSections)
      ? data.academicSections
      : [],
    totalResponses: Math.max(0, Number(data?.total) || 0),
    pages: Math.max(1, Number(data?.pages) || 1),
    page: resolvedPage,
    fetchedAt: Date.now(),
  };
}

export default function QuestionPaperResponsesPageClient({
  paperId,
  schoolKey,
  initialData,
  initialAcademicSection,
  initialError = null,
}: QuestionPaperResponsesPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/question-papers");
  const initialCacheEntry = useMemo(
    () => createResponseCacheEntry(initialData, initialData.page || 1),
    [initialData],
  );

  const [responses, setResponses] = useState(initialCacheEntry.responses);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [academicSections, setAcademicSections] = useState(
    initialCacheEntry.academicSections,
  );
  const [selectedAcademicSection, setSelectedAcademicSection] = useState(
    initialAcademicSection || "all",
  );
  const [page, setPage] = useState(initialCacheEntry.page);
  const [pages, setPages] = useState(initialCacheEntry.pages);
  const [totalResponses, setTotalResponses] = useState(
    initialCacheEntry.totalResponses,
  );
  const skipInitialFetchRef = useRef(true);
  const responsesCacheRef = useRef<Map<string, ResponsePageCacheEntry>>(
    new Map(
      schoolKey
        ? [
            [
              buildResponsesCacheKey(
                schoolKey,
                paperId,
                initialCacheEntry.page,
                initialAcademicSection || "all",
              ),
              initialCacheEntry,
            ],
          ]
        : [],
    ),
  );

  const buildResponsesQueryString = useCallback(
    (targetPage = page, targetAcademicSection = selectedAcademicSection) => {
      return buildResponsesQueryStringForCache(
        paperId,
        targetPage,
        targetAcademicSection,
      );
    },
    [page, paperId, selectedAcademicSection],
  );

  const getResponsesCacheKey = useCallback(
    (
      resolvedSchoolKey: string,
      targetPage = page,
      targetAcademicSection = selectedAcademicSection,
    ) =>
      buildResponsesCacheKey(
        resolvedSchoolKey,
        paperId,
        targetPage,
        targetAcademicSection,
      ),
    [page, paperId, selectedAcademicSection],
  );

  const applyResponseCacheEntry = useCallback((entry: ResponsePageCacheEntry) => {
    setResponses(entry.responses);
    setAcademicSections(entry.academicSections);
    setTotalResponses(entry.totalResponses);
    setPages(entry.pages);
    setPage(entry.page);
  }, []);

  useEffect(() => {
    let active = true;

    const prefetchResponsesPage = async (
      resolvedSchoolKey: string,
      targetPage: number,
      totalPageCount: number,
      targetAcademicSection = selectedAcademicSection,
    ) => {
      if (targetPage < 1 || targetPage > totalPageCount) {
        return;
      }

      const cacheKey = getResponsesCacheKey(
        resolvedSchoolKey,
        targetPage,
        targetAcademicSection,
      );
      const cachedEntry = responsesCacheRef.current.get(cacheKey);
      if (
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt < PAPER_RESPONSES_CACHE_TTL_MS
      ) {
        return;
      }

      try {
        const data = await fetchApiJson<any>(
          `/api/question-paper-response?${buildResponsesQueryString(
            targetPage,
            targetAcademicSection,
          )}`,
          {
            schoolKey: resolvedSchoolKey,
            fallbackMessage: "Failed to fetch responses.",
          },
        );
        responsesCacheRef.current.set(
          getResponsesCacheKey(
            resolvedSchoolKey,
            Math.max(1, Number(data.page) || targetPage),
            targetAcademicSection,
          ),
          createResponseCacheEntry(data, targetPage),
        );
      } catch {
      }
    };

    const resolvedSchoolKey = String(
      getSchoolKeyFromCookie() || schoolKey || "",
    ).trim();

    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      if (!initialError && resolvedSchoolKey) {
        void prefetchResponsesPage(
          resolvedSchoolKey,
          page + 1,
          pages,
          selectedAcademicSection,
        );
      }
      return () => {
        active = false;
      };
    }

    const loadResponses = async () => {
      if (!resolvedSchoolKey) {
        setError("Please select a school in the navbar to view responses.");
        setLoading(false);
        return;
      }

      const cacheKey = getResponsesCacheKey(resolvedSchoolKey);
      const cachedEntry = responsesCacheRef.current.get(cacheKey);
      const hasFreshCache =
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt < PAPER_RESPONSES_CACHE_TTL_MS;

      if (cachedEntry) {
        applyResponseCacheEntry(cachedEntry);
        setError(null);
        if (hasFreshCache) {
          setLoading(false);
          void prefetchResponsesPage(
            resolvedSchoolKey,
            page + 1,
            cachedEntry.pages,
            selectedAcademicSection,
          );
          return;
        }
      }

      setLoading(true);
      if (!cachedEntry) {
        setError(null);
      }

      try {
        const data = await fetchApiJson<any>(
          `/api/question-paper-response?${buildResponsesQueryString()}`,
          {
            schoolKey: resolvedSchoolKey,
            fallbackMessage: "Failed to fetch responses.",
          },
        );

        if (!active) {
          return;
        }
        const nextEntry = createResponseCacheEntry(data, page);
        responsesCacheRef.current.set(
          getResponsesCacheKey(resolvedSchoolKey, nextEntry.page),
          nextEntry,
        );
        applyResponseCacheEntry(nextEntry);
        void prefetchResponsesPage(
          resolvedSchoolKey,
          nextEntry.page + 1,
          nextEntry.pages,
          selectedAcademicSection,
        );
      } catch (fetchError: any) {
        if (!cachedEntry) {
          setError(fetchError?.message || "An unexpected network error occurred.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadResponses();

    return () => {
      active = false;
    };
  }, [
    applyResponseCacheEntry,
    buildResponsesQueryString,
    getResponsesCacheKey,
    initialError,
    page,
    pages,
    schoolKey,
    selectedAcademicSection,
  ]);

  useEffect(() => {
    if (
      selectedAcademicSection !== "all" &&
      !academicSections.some((section) => section.id === selectedAcademicSection)
    ) {
      setSelectedAcademicSection("all");
    }
  }, [academicSections, selectedAcademicSection]);

  const selectedAcademicSectionLabel = useMemo(() => {
    if (selectedAcademicSection === "all") {
      return "All sections";
    }
    return (
      academicSections.find((section) => section.id === selectedAcademicSection)
        ?.name || "Selected section"
    );
  }, [academicSections, selectedAcademicSection]);

  const responsesReturnTo = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (selectedAcademicSection !== "all") {
      searchParams.set("academicSectionId", selectedAcademicSection);
    }
    if (page > 1) {
      searchParams.set("page", String(page));
    }
    const query = searchParams.toString();
    return `/workspace/question-papers/${paperId}/responses${
      query ? `?${query}` : ""
    }`;
  }, [page, paperId, selectedAcademicSection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath === responsesReturnTo) return;
    window.history.replaceState(null, "", responsesReturnTo);
  }, [responsesReturnTo]);

  const backAction = (
    <Button
      variant="outline"
      onClick={navigateBack}
      className="app-button-back w-full justify-center sm:w-auto"
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );

  if (loading && responses.length === 0 && !error) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          variant="operations"
          eyebrow="Assessments"
          title="Student Responses"
          description="Loading submitted responses for this paper."
          actions={backAction}
        />
        <Card className="app-surface overflow-hidden">
          <CardContent className="app-section-body space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          variant="operations"
          eyebrow="Assessments"
          title="Student Responses"
          description="The response list could not be loaded."
          actions={backAction}
        />
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="operations"
        eyebrow="Assessments"
        title="Student Responses"
        description="Review submitted responses for this paper and open student analytics from the same assessment workspace."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <div className="w-full sm:w-auto">{backAction}</div>
            <Select
              value={selectedAcademicSection}
              onValueChange={(value) => {
                setPage(1);
                setSelectedAcademicSection(value);
              }}
            >
              <SelectTrigger className="w-full min-w-0 sm:w-64">
                <SelectValue placeholder="Class section" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {academicSections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">{selectedAcademicSectionLabel}</span>
            {loading ? <span className="app-meta-chip">Refreshing...</span> : null}
          </>
        }
        stats={[
          {
            label: "Filtered responses",
            value: String(totalResponses),
            meta: "Matching responses across all pages for the current section filter.",
          },
          {
            label: "On this page",
            value: String(responses.length),
            meta: "Rows currently shown on this page.",
          },
          {
            label: "Section filters",
            value: String(academicSections.length),
            meta: "Available academic sections for this paper.",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Response List</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body space-y-4">
          <ListPagination
            page={page}
            totalPages={pages}
            totalItems={totalResponses}
            pageSize={PAPER_RESPONSES_PAGE_SIZE}
            itemLabel="responses"
            onPageChange={(nextPage) => setPage(nextPage)}
            disabled={loading}
          />
          {responses.length === 0 ? (
            <div className="app-empty-state py-10">
              <p>
                {totalResponses === 0 && selectedAcademicSection === "all"
                  ? "No responses found for this paper yet."
                  : "No responses found for the selected academic section."}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {responses.map((response) => (
                  <div
                    key={`mobile-${response._id}`}
                    className="rounded-2xl border border-border/60 bg-background/70 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {response.student?.name || "Anonymous Student"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {response.student?.academicSection?.name || "—"}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {response.totalMarksAwarded ?? "—"}
                      </Badge>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p>Roll Number: {response.student?.rollNumber || "N/A"}</p>
                      <p>
                        Submitted:{" "}
                        {response.submittedAt
                          ? new Date(response.submittedAt).toLocaleString()
                          : "Not submitted"}
                      </p>
                    </div>

                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="app-button-compact mt-3 w-full justify-center"
                    >
                      <AppPrefetchLink
                        href={buildHrefWithReturnTo(
                          `/workspace/analytics/student-tag-report/${response._id}`,
                          responsesReturnTo,
                        )}
                        relatedApiPrefetches={[
                          `/api/analytics/student-tag-report/${response._id}?groupFields=1`,
                        ]}
                        prefetchOnViewport={false}
                      >
                        View Tag Analytics
                      </AppPrefetchLink>
                    </Button>
                  </div>
                ))}
              </div>

              <div className="app-table-wrap hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Class Section</TableHead>
                      <TableHead>Roll Number</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Total Marks</TableHead>
                      <TableHead>Tag Analytics</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((response) => (
                      <TableRow key={response._id}>
                        <TableCell>{response.student?.name || "Anonymous Student"}</TableCell>
                        <TableCell>{response.student?.academicSection?.name || "—"}</TableCell>
                        <TableCell>{response.student?.rollNumber || "N/A"}</TableCell>
                        <TableCell>
                          {response.submittedAt
                            ? new Date(response.submittedAt).toLocaleString()
                            : "Not submitted"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {response.totalMarksAwarded ?? "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="app-button-compact"
                          >
                            <AppPrefetchLink
                              href={buildHrefWithReturnTo(
                                `/workspace/analytics/student-tag-report/${response._id}`,
                                responsesReturnTo,
                              )}
                              relatedApiPrefetches={[
                                `/api/analytics/student-tag-report/${response._id}?groupFields=1`,
                              ]}
                              prefetchOnViewport={false}
                            >
                              View Tag Analytics
                            </AppPrefetchLink>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
