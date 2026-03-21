'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageHero from '@/components/layout/PageHero';
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

function AccessList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="app-section">
      <div className="space-y-1">
        <p className="app-detail-label">{title}</p>
        <p className="text-sm text-muted-foreground">
          {items.length > 0
            ? `${items.length} assigned item${items.length === 1 ? "" : "s"}`
            : emptyLabel}
        </p>
      </div>
      {items.length > 0 ? (
        <div className="app-chip-cloud">
          {items.map((item) => (
            <span key={item} className="app-meta-chip">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="app-empty-state py-6">{emptyLabel}</div>
      )}
    </div>
  );
}

export default function TeacherDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const { navigateBack } = useBackNavigation('/workspace/teachers');
  const currentPath = useCurrentPathWithSearch('/workspace/teachers');
  const editHref = buildHrefWithReturnTo(`/workspace/teachers/edit/${id}`, currentPath);

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
      <PageHero
        eyebrow="People"
        title={user?.name || "Teacher Details"}
        description="Review teacher profile information and the exact class, section, and subject scope granted inside this school workspace."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={navigateBack}>Back to Teachers</Button>
            <Link href={editHref}>
              <Button>Edit Teacher</Button>
            </Link>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">Teacher account</span>
            <span className="app-meta-chip">
              {user?.hasAllSections ? "All sections in scope" : "Section-limited access"}
            </span>
          </>
        }
        stats={[
          {
            label: "Classes assigned",
            value: loading ? "—" : String(classNames.length),
            meta: "Classes this teacher can work with.",
          },
          {
            label: "Sections assigned",
            value: loading ? "—" : String(academicSectionNames.length),
            meta: "Either explicit sections or all sections in assigned classes.",
          },
          {
            label: "Subjects assigned",
            value: loading ? "—" : String(subjectNames.length),
            meta: "Subjects available to this teacher in the workspace.",
          },
          {
            label: "Profile state",
            value: loading ? "Loading" : error ? "Needs review" : "Ready",
            meta: error ? "Teacher details could not be loaded cleanly." : "Teacher profile loaded successfully.",
          },
        ]}
      />

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
        <div className="space-y-5">
                    <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-detail-grid">
                <DetailItem label="Email" value={user.email || "-"} />
                <DetailItem label="Phone" value={user.mobileNumber || "-"} />
                <DetailItem
                  label="Created"
                  value={user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
                />
                <DetailItem
                  label="Updated"
                  value={user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "-"}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Academic Access</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <AccessList
                title="Classes"
                items={classNames}
                emptyLabel="No classes are assigned to this teacher yet."
              />
              <AccessList
                title="Sections"
                items={academicSectionNames}
                emptyLabel="No sections are assigned to this teacher yet."
              />
              <AccessList
                title="Subjects"
                items={subjectNames}
                emptyLabel="No subjects are assigned to this teacher yet."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
