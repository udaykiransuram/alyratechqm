'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import PageHero from '@/components/layout/PageHero';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ListPagination from '@/components/ui/list-pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { fetchApiJson, peekCachedApiJson } from '@/lib/client/api';
import { getSchoolKeyFromCookie } from '@/lib/client/school';
import { buildHrefWithReturnTo } from '@/lib/navigation/returnTo';

interface ResponseItem {
  _id: string;
  submittedAt?: string;
  totalMarksAwarded?: number;
  student?: {
    name?: string;
    rollNumber?: string;
    academicSection?: {
      _id?: string;
      name?: string;
    } | null;
  } | null;
}

const PAPER_RESPONSES_PAGE_SIZE = 40;
const PAPER_RESPONSES_CACHE_TTL_MS = 30_000;

type ResponsePageCacheEntry = {
  responses: ResponseItem[];
  academicSections: Array<{ id: string; name: string }>;
  totalResponses: number;
  pages: number;
  page: number;
  fetchedAt: number;
};

function getInitialPage() {
  if (typeof window === 'undefined') return 1;
  try {
    const rawPage = Number(new URL(window.location.href).searchParams.get('page') || '1');
    return Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  } catch {
    return 1;
  }
}

function getInitialAcademicSection() {
  if (typeof window === 'undefined') return 'all';
  try {
    return new URL(window.location.href).searchParams.get('academicSectionId')?.trim() || 'all';
  } catch {
    return 'all';
  }
}

function buildResponsesQueryStringForCache(
  paperId: string,
  targetPage: number,
  targetAcademicSection: string,
) {
  const queryParams = new URLSearchParams({
    paper: paperId,
    summary: '1',
    page: String(targetPage),
    limit: String(PAPER_RESPONSES_PAGE_SIZE),
  });
  if (targetAcademicSection !== 'all') {
    queryParams.set('academicSectionId', targetAcademicSection);
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
  data: any,
  fallbackPage: number,
): ResponsePageCacheEntry {
  const resolvedPage = Math.max(1, Number(data?.page) || fallbackPage);
  return {
    responses: Array.isArray(data?.responses) ? data.responses : [],
    academicSections: Array.isArray(data?.academicSections) ? data.academicSections : [],
    totalResponses: Math.max(0, Number(data?.total) || 0),
    pages: Math.max(1, Number(data?.pages) || 1),
    page: resolvedPage,
    fetchedAt: Date.now(),
  };
}

export default function QuestionPaperResponsesPage({ params }: { params: { id: string } }) {
  const { navigateBack } = useBackNavigation('/workspace/question-papers');
  const initialPage = getInitialPage();
  const initialAcademicSection = getInitialAcademicSection();
  const initialSchoolKey =
    typeof window === 'undefined' ? '' : String(getSchoolKeyFromCookie() || '').trim();
  const initialCachedResponse = initialSchoolKey
    ? peekCachedApiJson<any>(
        `/api/question-paper-response?${buildResponsesQueryStringForCache(
          params.id,
          initialPage,
          initialAcademicSection,
        )}`,
        {
          schoolKey: initialSchoolKey,
          clientCacheTtlMs: PAPER_RESPONSES_CACHE_TTL_MS,
        },
      )
    : null;
  const initialCacheEntry = initialCachedResponse
    ? createResponseCacheEntry(initialCachedResponse, initialPage)
    : null;

  const [responses, setResponses] = useState<ResponseItem[]>(
    () => initialCacheEntry?.responses || [],
  );
  const [loading, setLoading] = useState(() => !initialCacheEntry);
  const [error, setError] = useState<string | null>(null);
  const [academicSections, setAcademicSections] = useState<Array<{ id: string; name: string }>>(
    () => initialCacheEntry?.academicSections || [],
  );
  const [selectedAcademicSection, setSelectedAcademicSection] =
    useState<string>(initialAcademicSection);
  const [page, setPage] = useState<number>(initialCacheEntry?.page || initialPage);
  const [pages, setPages] = useState(initialCacheEntry?.pages || 1);
  const [totalResponses, setTotalResponses] = useState(initialCacheEntry?.totalResponses || 0);
  const responsesCacheRef = useRef<Map<string, ResponsePageCacheEntry>>(
    new Map(
      initialCacheEntry && initialSchoolKey
        ? [
            [
              buildResponsesCacheKey(
                initialSchoolKey,
                params.id,
                initialCacheEntry.page,
                initialAcademicSection,
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
        params.id,
        targetPage,
        targetAcademicSection,
      );
    },
    [page, params.id, selectedAcademicSection],
  );

  const getResponsesCacheKey = useCallback(
    (
      schoolKey: string,
      targetPage = page,
      targetAcademicSection = selectedAcademicSection,
    ) =>
      buildResponsesCacheKey(
        schoolKey,
        params.id,
        targetPage,
        targetAcademicSection,
      ),
    [page, params.id, selectedAcademicSection],
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
      schoolKey: string,
      targetPage: number,
      totalPageCount: number,
      targetAcademicSection = selectedAcademicSection,
    ) => {
      if (targetPage < 1 || targetPage > totalPageCount) {
        return;
      }

      const cacheKey = getResponsesCacheKey(
        schoolKey,
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
            schoolKey,
            fallbackMessage: 'Failed to fetch responses.',
          },
        );
        responsesCacheRef.current.set(
          getResponsesCacheKey(
            schoolKey,
            Math.max(1, Number(data.page) || targetPage),
            targetAcademicSection,
          ),
          createResponseCacheEntry(data, targetPage),
        );
      } catch {
      }
    };

    const loadResponses = async () => {
      const schoolKey = getSchoolKeyFromCookie();
      if (!schoolKey) {
        setError('Please select a school in the navbar to view responses.');
        setLoading(false);
        return;
      }

      const cacheKey = getResponsesCacheKey(schoolKey);
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
            schoolKey,
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
            schoolKey,
            fallbackMessage: 'Failed to fetch responses.',
          },
        );

        if (!active) {
          return;
        }
        const nextEntry = createResponseCacheEntry(data, page);
        responsesCacheRef.current.set(
          getResponsesCacheKey(schoolKey, nextEntry.page),
          nextEntry,
        );
        applyResponseCacheEntry(nextEntry);
        void prefetchResponsesPage(
          schoolKey,
          nextEntry.page + 1,
          nextEntry.pages,
          selectedAcademicSection,
        );
      } catch (fetchError: any) {
        if (!cachedEntry) {
          setError(fetchError?.message || 'An unexpected network error occurred.');
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
    page,
    params.id,
    selectedAcademicSection,
  ]);

  useEffect(() => {
    if (
      selectedAcademicSection !== 'all' &&
      !academicSections.some((section) => section.id === selectedAcademicSection)
    ) {
      setSelectedAcademicSection('all');
    }
  }, [academicSections, selectedAcademicSection]);

  const selectedAcademicSectionLabel = useMemo(() => {
    if (selectedAcademicSection === 'all') {
      return 'All sections';
    }
    return (
      academicSections.find((section) => section.id === selectedAcademicSection)?.name ||
      'Selected section'
    );
  }, [academicSections, selectedAcademicSection]);

  const responsesReturnTo = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (selectedAcademicSection !== 'all') {
      searchParams.set('academicSectionId', selectedAcademicSection);
    }
    if (page > 1) {
      searchParams.set('page', String(page));
    }
    const query = searchParams.toString();
    return `/workspace/question-papers/${params.id}/responses${query ? `?${query}` : ''}`;
  }, [page, params.id, selectedAcademicSection]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath === responsesReturnTo) return;
    window.history.replaceState(null, '', responsesReturnTo);
  }, [responsesReturnTo]);

  const backAction = (
    <Button variant="outline" onClick={navigateBack} className="gap-2">
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );

  if (loading && responses.length === 0 && !error) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Assessments"
          title="Student Responses"
          description="The response list could not be loaded."
          actions={backAction}
        />
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Assessments"
        title="Student Responses"
        description="Review submitted responses for this paper and open student analytics from the same assessment workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {backAction}
            <Select
              value={selectedAcademicSection}
              onValueChange={(value) => {
                setPage(1);
                setSelectedAcademicSection(value);
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
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
            label: 'Filtered responses',
            value: String(totalResponses),
            meta: 'Matching responses across all pages for the current section filter.',
          },
          {
            label: 'On this page',
            value: String(responses.length),
            meta: 'Rows currently shown on this page.',
          },
          {
            label: 'Section filters',
            value: String(academicSections.length),
            meta: 'Available academic sections for this paper.',
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Response List</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          <ListPagination
            page={page}
            totalPages={pages}
            totalItems={totalResponses}
            pageSize={PAPER_RESPONSES_PAGE_SIZE}
            itemLabel="responses"
            onPageChange={setPage}
            disabled={loading}
          />
          {responses.length === 0 ? (
            <div className="app-empty-state py-10">
              <p>
                {totalResponses === 0 && selectedAcademicSection === 'all'
                  ? 'No responses found for this paper yet.'
                  : 'No responses found for the selected academic section.'}
              </p>
            </div>
          ) : (
            <div className="app-table-wrap">
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
                      <TableCell>{response.student?.name || 'Anonymous Student'}</TableCell>
                      <TableCell>{response.student?.academicSection?.name || '—'}</TableCell>
                      <TableCell>{response.student?.rollNumber || 'N/A'}</TableCell>
                      <TableCell>
                        {response.submittedAt
                          ? new Date(response.submittedAt).toLocaleString()
                          : 'Not submitted'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{response.totalMarksAwarded ?? '—'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline" className="app-button-compact">
                          <AppPrefetchLink
                            href={buildHrefWithReturnTo(
                              `/workspace/analytics/student-tag-report/${response._id}`,
                              responsesReturnTo,
                            )}
                            relatedApiPrefetches={[
                              `/api/analytics/student-tag-report/${response._id}?groupFields=1`,
                            ]}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
