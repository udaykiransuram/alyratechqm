'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import PageHero from '@/components/layout/PageHero';
import PageShell from '@/components/layout/PageShell';
import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import FeedbackNotice from '@/components/ui/feedback-notice';
import { buildHrefWithReturnTo } from '@/lib/navigation/returnTo';
import { useBackNavigation, useCurrentPathWithSearch } from '@/hooks/useReturnNavigation';
import PageLoadingState from '@/components/ui/page-loading-state';
import PageState from '@/components/ui/page-state';
import {
  fetchApiJson,
  peekCachedApiJson,
  resolveClientSchoolKey,
} from '@/lib/client/api';

interface UserItem {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: string;
  classIds?: string[];
  academicSectionIds?: string[];
  subjectIds?: string[];
  hasAllClasses?: boolean;
  hasAllSections?: boolean;
  hasAllSubjects?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ClassItem {
  _id: string;
  name: string;
}

interface SubjectItem {
  _id: string;
  name: string;
}

interface AcademicSectionItem {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
}

function getSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === 'string' ? section.class : section.class?._id || '';
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-detail-item">
      <div className="app-detail-label">{label}</div>
      <div className="app-detail-value">{value || '-'}</div>
    </div>
  );
}

const DETAIL_PAGE_CACHE_TTL_MS = 30_000;

export default function AdminDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const { navigateBack } = useBackNavigation('/workspace/admins');
  const currentPath = useCurrentPathWithSearch('/workspace/admins');
  const editHref = buildHrefWithReturnTo(`/workspace/admins/edit/${id}`, currentPath);
  const schoolKey = resolveClientSchoolKey();
  const cachedUserResponse = id
    ? peekCachedApiJson<{ user?: UserItem }>(`/api/users/${id}`, {
        schoolKey,
        clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
      })
    : null;
  const cachedClassesResponse = peekCachedApiJson<{ classes?: ClassItem[] }>('/api/classes', {
    schoolKey,
    clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
  });
  const cachedSectionsResponse = peekCachedApiJson<{ sections?: AcademicSectionItem[] }>('/api/sections', {
    schoolKey,
    clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
  });
  const cachedSubjectsResponse = peekCachedApiJson<{ subjects?: SubjectItem[] }>('/api/subjects', {
    schoolKey,
    clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
  });

  const [loading, setLoading] = useState(() => !cachedUserResponse?.user);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserItem | null>(() => cachedUserResponse?.user || null);
  const [classes, setClasses] = useState<ClassItem[]>(() => cachedClassesResponse?.classes || []);
  const [sections, setSections] = useState<AcademicSectionItem[]>(
    () => cachedSectionsResponse?.sections || [],
  );
  const [subjects, setSubjects] = useState<SubjectItem[]>(
    () => cachedSubjectsResponse?.subjects || [],
  );
  const [reloadToken, setReloadToken] = useState(0);

  const retryLoad = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!schoolKey) {
        setError('Please select a school in the navbar to view admin details.');
        setLoading(false);
        return;
      }

      try {
        if (cachedUserResponse?.user) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);
        const [userJson, classesJson, sectionsJson, subjectsJson] = await Promise.all([
          fetchApiJson<any>(`/api/users/${id}`, {
            cache: 'no-store',
            schoolKey,
            fallbackMessage: 'Failed to load admin.',
            clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
          }),
          fetchApiJson<any>('/api/classes', {
            cache: 'no-store',
            schoolKey,
            fallbackMessage: 'Failed to load classes.',
            clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
          }),
          fetchApiJson<any>('/api/sections', {
            cache: 'no-store',
            schoolKey,
            fallbackMessage: 'Failed to load sections.',
            clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
          }),
          fetchApiJson<any>('/api/subjects', {
            cache: 'no-store',
            schoolKey,
            fallbackMessage: 'Failed to load subjects.',
            clientCacheTtlMs: DETAIL_PAGE_CACHE_TTL_MS,
          }),
        ]);
        if (!mounted) return;
        setUser(userJson.user);
        setClasses(classesJson.classes || []);
        setSections(sectionsJson.sections || []);
        setSubjects(subjectsJson.subjects || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load');
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    if (id) load();
    return () => {
      mounted = false;
    };
  }, [cachedUserResponse?.user, id, reloadToken, schoolKey]);

  const classNames = useMemo(() => {
    if (user?.hasAllClasses) return ['All Classes'];
    return (user?.classIds || []).map(
      (classId) => classes.find((classItem) => classItem._id === classId)?.name || classId,
    );
  }, [classes, user?.classIds, user?.hasAllClasses]);

  const academicSectionNames = useMemo(() => {
    if (user?.hasAllSections) {
      return [user?.hasAllClasses ? 'All sections' : 'All sections in selected classes'];
    }

    return (user?.academicSectionIds || []).map((sectionId) => {
      const section = sections.find((item) => item._id === sectionId);
      if (!section) return sectionId;
      const className = classes.find((classItem) => classItem._id === getSectionClassId(section))?.name;
      return className ? `${section.name} (${className})` : section.name;
    });
  }, [classes, sections, user?.academicSectionIds, user?.hasAllClasses, user?.hasAllSections]);

  const subjectNames = useMemo(() => {
    if (user?.hasAllSubjects) return ['All Subjects'];
    return (user?.subjectIds || []).map(
      (subjectId) => subjects.find((subject) => subject._id === subjectId)?.name || subjectId,
    );
  }, [subjects, user?.hasAllSubjects, user?.subjectIds]);

  if (loading && !user) {
    return (
      <PageLoadingState
        title="Loading admin details"
        description="Preparing admin profile and access assignments."
        width="narrow"
        dense
      />
    );
  }

  return (
    <PageShell width="narrow">
      <PageHero
        eyebrow="People"
        title={user?.name || "Admin Details"}
        description="Inspect school-admin profile information and the exact access envelope configured across classes, sections, and subjects."
        actions={
          user ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={navigateBack}>
                Back to Admins
              </Button>
              <AppPrefetchLink
                href={editHref}
                relatedApiPrefetches={[
                  `/api/users/${id}`,
                  '/api/classes',
                  '/api/sections',
                  '/api/subjects',
                ]}
              >
                <Button>Edit Admin</Button>
              </AppPrefetchLink>
            </div>
          ) : (
            <Button variant="outline" onClick={navigateBack}>
              Back to Admins
            </Button>
          )
        }
        meta={
          <>
            <span className="app-meta-chip">Admin account</span>
            <span className="app-meta-chip">
              {user?.hasAllClasses && user?.hasAllSections && user?.hasAllSubjects
                ? "Full school access"
                : "Restricted scope"}
            </span>
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
          </>
        }
        stats={[
          {
            label: "Class access",
            value: loading ? "—" : String(classNames.length),
            meta: user?.hasAllClasses ? "All classes are enabled." : "Specific class assignments only.",
          },
          {
            label: "Section access",
            value: loading ? "—" : String(academicSectionNames.length),
            meta: user?.hasAllSections ? "Section access is broad within scope." : "Only selected sections are enabled.",
          },
          {
            label: "Subject access",
            value: loading ? "—" : String(subjectNames.length),
            meta: user?.hasAllSubjects ? "All subjects are available." : "Only selected subjects are enabled.",
          },
          {
            label: "Profile state",
            value: loading ? "Loading" : error ? "Needs review" : "Ready",
            meta: error ? "Admin details could not be loaded cleanly." : "Admin profile loaded successfully.",
          },
        ]}
      />

      {error && user ? (
        <FeedbackNotice variant="info">{error}</FeedbackNotice>
      ) : null}

      {error && !user ? (
        <PageState
          variant="error"
          title="Could not load admin details"
          description={error}
          action={
            <>
              <Button type="button" variant="outline" onClick={navigateBack}>
                Back to Admins
              </Button>
              <Button type="button" onClick={retryLoad}>
                Try Again
              </Button>
            </>
          }
        />
      ) : !user ? (
        <PageState
          title="Admin not found"
          description="We could not find an admin record for this request."
          action={
            <Button type="button" variant="outline" onClick={navigateBack}>
              Back to Admins
            </Button>
          }
        />
      ) : (
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle className="text-xl font-semibold tracking-tight">{user.name}</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <div className="app-detail-grid">
              <DetailItem label="Email" value={user.email || '-'} />
              <DetailItem label="Phone" value={user.mobileNumber || '-'} />
              <DetailItem label="Classes Access" value={classNames.join(', ') || '-'} />
              <DetailItem label="Sections Access" value={academicSectionNames.join(', ') || '-'} />
              <DetailItem label="Subjects Access" value={subjectNames.join(', ') || '-'} />
              <DetailItem
                label="Created"
                value={user.createdAt ? new Date(user.createdAt).toLocaleString() : '-'}
              />
              <DetailItem
                label="Updated"
                value={user.updatedAt ? new Date(user.updatedAt).toLocaleString() : '-'}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
