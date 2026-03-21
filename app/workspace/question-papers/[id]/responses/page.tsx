'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import PageHero from '@/components/layout/PageHero';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { buildHrefWithReturnTo } from '@/lib/navigation/returnTo';
import { fetchApiJson } from '@/lib/client/api';
import { getSchoolKeyFromCookie } from '@/lib/client/school';

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

export default function QuestionPaperResponsesPage({ params }: { params: { id: string } }) {
  const { navigateBack } = useBackNavigation('/workspace/question-papers');
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAcademicSection, setSelectedAcademicSection] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    try {
      return new URL(window.location.href).searchParams.get('academicSectionId')?.trim() || 'all';
    } catch {
      return 'all';
    }
  });

  useEffect(() => {
    const loadResponses = async () => {
      const schoolKey = getSchoolKeyFromCookie();
      if (!schoolKey) {
        setError('Please select a school in the navbar to view responses.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await fetchApiJson<any>(`/api/question-paper-response?paper=${encodeURIComponent(params.id)}`, {
          schoolKey,
          fallbackMessage: 'Failed to fetch responses.',
        });
        setResponses(Array.isArray(data.responses) ? data.responses : []);
      } catch (fetchError: any) {
        setError(fetchError?.message || 'An unexpected network error occurred.');
      } finally {
        setLoading(false);
      }
    };

    void loadResponses();
  }, [params.id]);

  const academicSections = useMemo(() => {
    const seen = new Map<string, string>();
    responses.forEach((response) => {
      const id = response.student?.academicSection?._id;
      const name = response.student?.academicSection?.name;
      if (id && name) {
        seen.set(id, name);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [responses]);

  useEffect(() => {
    if (
      selectedAcademicSection !== 'all' &&
      !academicSections.some((section) => section.id === selectedAcademicSection)
    ) {
      setSelectedAcademicSection('all');
    }
  }, [academicSections, selectedAcademicSection]);

  const filteredResponses = useMemo(() => {
    if (selectedAcademicSection === 'all') {
      return responses;
    }
    return responses.filter(
      (response) => response.student?.academicSection?._id === selectedAcademicSection,
    );
  }, [responses, selectedAcademicSection]);

  const responsesReturnTo = useMemo(() => {
    const searchParams = new URLSearchParams();
    if (selectedAcademicSection !== 'all') {
      searchParams.set('academicSectionId', selectedAcademicSection);
    }
    const query = searchParams.toString();
    return `/workspace/question-papers/${params.id}/responses${query ? `?${query}` : ''}`;
  }, [params.id, selectedAcademicSection]);

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

  if (loading) {
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
            <Select value={selectedAcademicSection} onValueChange={setSelectedAcademicSection}>
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
            <span className="app-meta-chip">
              {selectedAcademicSection === 'all'
                ? 'All sections'
                : academicSections.find((section) => section.id === selectedAcademicSection)?.name || 'Selected section'}
            </span>
          </>
        }
        stats={[
          {
            label: 'All responses',
            value: String(responses.length),
            meta: 'Responses returned for this paper before section filtering.',
          },
          {
            label: 'Visible responses',
            value: String(filteredResponses.length),
            meta: 'Rows currently shown after the section filter is applied.',
          },
          {
            label: 'Section filters',
            value: String(academicSections.length),
            meta: 'Available academic sections inferred from the response list.',
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Response List</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          {filteredResponses.length === 0 ? (
            <div className="app-empty-state py-10">
              <p>
                {responses.length === 0
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
                  {filteredResponses.map((response) => (
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
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={buildHrefWithReturnTo(
                              `/workspace/analytics/student-tag-report/${response._id}`,
                              responsesReturnTo,
                            )}
                          >
                            View Tag Analytics
                          </Link>
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
