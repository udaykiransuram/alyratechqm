'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { buildHrefWithReturnTo } from '@/lib/navigation/returnTo';
import { useBackNavigation, useCurrentPathWithSearch } from '@/hooks/useReturnNavigation';
import PageLoadingState from '@/components/ui/page-loading-state';

interface UserItem {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: string;
  classIds?: string[];
  academicSectionIds?: string[];
  hasAllSections?: boolean;
  subjectIds?: string[];
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

export default function TeacherDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const { navigateBack } = useBackNavigation('/teachers');
  const currentPath = useCurrentPathWithSearch('/teachers');
  const editHref = buildHrefWithReturnTo(`/teachers/edit/${id}`, currentPath);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserItem | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const [userRes, classesRes, sectionsRes, subjectsRes] = await Promise.all([
          fetch('/api/users/' + id),
          fetch('/api/classes'),
          fetch('/api/sections'),
          fetch('/api/subjects'),
        ]);
        const userJson = await userRes.json();
        const classesJson = await classesRes.json();
        const sectionsJson = await sectionsRes.json();
        const subjectsJson = await subjectsRes.json();

        if (!mounted) return;
        if (!userJson.success) {
          throw new Error(userJson.message || 'Failed to load teacher');
        }

        setUser(userJson.user);
        setClasses(classesJson.classes || []);
        setSections(sectionsJson.sections || []);
        setSubjects(subjectsJson.subjects || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (id) load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const classNames = useMemo(
    () =>
      (user?.classIds || []).map(
        (classId) => classes.find((classItem) => classItem._id === classId)?.name || classId,
      ),
    [classes, user?.classIds],
  );

  const subjectNames = useMemo(
    () =>
      (user?.subjectIds || []).map(
        (subjectId) => subjects.find((subject) => subject._id === subjectId)?.name || subjectId,
      ),
    [subjects, user?.subjectIds],
  );

  const academicSectionNames = useMemo(() => {
    if (user?.hasAllSections) {
      return ['All sections in assigned classes'];
    }

    return (user?.academicSectionIds || []).map((sectionId) => {
      const section = sections.find((item) => item._id === sectionId);
      if (!section) return sectionId;
      const className = classes.find((classItem) => classItem._id === getSectionClassId(section))?.name;
      return className ? `${section.name} (${className})` : section.name;
    });
  }, [classes, sections, user?.academicSectionIds, user?.hasAllSections]);

  return (
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <div className="app-page-header-row">
        <div className="app-page-header">
          <h1 className="app-page-title">Teacher Details</h1>
          <p className="app-page-subtitle">
            View teacher profile and assigned class, section, and subject access.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={navigateBack}>Back</Button>
          <Link href={editHref}>
            <Button>Edit</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <PageLoadingState
          title="Loading teacher details"
          description="Preparing teacher profile and academic access assignments."
          className="px-0 py-0"
          contentClassName="max-w-none"
          dense
        />
      ) : error ? (
        <div className="app-feedback app-feedback-error">{error}</div>
      ) : !user ? (
        <div className="app-empty-state">User not found.</div>
      ) : (
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle className="text-xl font-semibold tracking-tight">{user.name}</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <div className="app-detail-grid">
              <DetailItem label="Email" value={user.email || '-'} />
              <DetailItem label="Phone" value={user.mobileNumber || '-'} />
              <DetailItem label="Classes" value={classNames.join(', ') || '-'} />
              <DetailItem label="Sections" value={academicSectionNames.join(', ') || '-'} />
              <DetailItem label="Subjects" value={subjectNames.join(', ') || '-'} />
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
    </div>
  );
}
