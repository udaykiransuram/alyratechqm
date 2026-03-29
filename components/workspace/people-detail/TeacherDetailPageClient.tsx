"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import {
  useBackNavigation,
  useCurrentPathWithSearch,
} from "@/hooks/useReturnNavigation";
import PageLoadingState from "@/components/ui/page-loading-state";
import PageState from "@/components/ui/page-state";
import SectionState from "@/components/ui/section-state";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import { getUserGenderLabel } from "@/lib/user-gender";

type UserItem = {
  _id: string;
  name: string;
  gender?: string;
  email?: string;
  mobileNumber?: string;
  role: string;
  classIds?: string[];
  academicSectionIds?: string[];
  hasAllSections?: boolean;
  subjectIds?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type ClassItem = {
  _id: string;
  name: string;
};

type SubjectItem = {
  _id: string;
  name: string;
};

type AcademicSectionItem = {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
};

type TeacherDetailPageClientProps = {
  teacherId: string;
  initialUser: UserItem | null;
  initialClasses: ClassItem[];
  initialSections: AcademicSectionItem[];
  initialSubjects: SubjectItem[];
  initialLoadError?: string | null;
};

function getSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-detail-item">
      <div className="app-detail-label">{label}</div>
      <div className="app-detail-value">{value || "-"}</div>
    </div>
  );
}

function AccessList({
  title,
  items,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  items: string[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="app-section">
      <div className="space-y-1">
        <p className="app-detail-label">{title}</p>
        <p className="text-sm text-muted-foreground">
          {items.length > 0
            ? `${items.length} assigned item${items.length === 1 ? "" : "s"}`
            : emptyDescription}
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
        <SectionState title={emptyTitle} description={emptyDescription} />
      )}
    </div>
  );
}

export default function TeacherDetailPageClient({
  teacherId,
  initialUser,
  initialClasses,
  initialSections,
  initialSubjects,
  initialLoadError = null,
}: TeacherDetailPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/teachers");
  const currentPath = useCurrentPathWithSearch("/workspace/teachers");
  const editHref = buildHrefWithReturnTo(
    `/workspace/teachers/edit/${teacherId}`,
    currentPath,
  );

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [user, setUser] = useState<UserItem | null>(initialUser);
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [subjects, setSubjects] = useState<SubjectItem[]>(initialSubjects);
  const [sections, setSections] = useState<AcademicSectionItem[]>(initialSections);
  const [reloadToken, setReloadToken] = useState(0);

  const retryLoad = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    if (reloadToken === 0) {
      return;
    }

    let mounted = true;

    async function load() {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setError("Please select a school in the navbar to view teacher details.");
        setLoading(false);
        return;
      }

      try {
        if (user) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);
        const [userJson, classesJson, sectionsJson, subjectsJson] = await Promise.all([
          fetchApiJson<any>(`/api/users/${teacherId}`, {
            cache: "no-store",
            schoolKey,
            fallbackMessage: "Failed to load teacher.",
          }),
          fetchApiJson<any>("/api/classes", {
            cache: "no-store",
            schoolKey,
            fallbackMessage: "Failed to load classes.",
          }),
          fetchApiJson<any>("/api/sections", {
            cache: "no-store",
            schoolKey,
            fallbackMessage: "Failed to load sections.",
          }),
          fetchApiJson<any>("/api/subjects", {
            cache: "no-store",
            schoolKey,
            fallbackMessage: "Failed to load subjects.",
          }),
        ]);

        if (!mounted) return;

        setUser(userJson.user);
        setClasses(Array.isArray(classesJson.classes) ? classesJson.classes : []);
        setSections(Array.isArray(sectionsJson.sections) ? sectionsJson.sections : []);
        setSubjects(
          Array.isArray(subjectsJson.subjects) ? subjectsJson.subjects : [],
        );
      } catch (loadError: any) {
        setError(loadError.message || "Failed to load");
      } finally {
        if (mounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [reloadToken, teacherId, user]);

  const classNames = useMemo(
    () =>
      (user?.classIds || []).map(
        (classId) =>
          classes.find((classItem) => classItem._id === classId)?.name || classId,
      ),
    [classes, user?.classIds],
  );

  const subjectNames = useMemo(
    () =>
      (user?.subjectIds || []).map(
        (subjectId) =>
          subjects.find((subject) => subject._id === subjectId)?.name || subjectId,
      ),
    [subjects, user?.subjectIds],
  );

  const academicSectionNames = useMemo(() => {
    if (user?.hasAllSections) {
      return ["All sections in assigned classes"];
    }

    return (user?.academicSectionIds || []).map((sectionId) => {
      const section = sections.find((item) => item._id === sectionId);
      if (!section) return sectionId;
      const className = classes.find(
        (classItem) => classItem._id === getSectionClassId(section),
      )?.name;
      return className ? `${section.name} (${className})` : section.name;
    });
  }, [classes, sections, user?.academicSectionIds, user?.hasAllSections]);

  if (loading && !user) {
    return (
      <PageLoadingState
        title="Loading teacher details"
        description="Preparing teacher profile and academic access assignments."
        width="narrow"
        dense
      />
    );
  }

  return (
    <PageShell width="narrow">
      <PageHero
        variant="editor"
        eyebrow="People"
        title={user?.name || "Teacher Details"}
        description="Review teacher profile information and the exact class, section, and subject scope granted inside this school."
        actions={
          user ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="app-button-back"
                onClick={navigateBack}
              >
                Back to Teachers
              </Button>
              <AppPrefetchLink
                href={editHref}
                relatedApiPrefetches={[
                  `/api/users/${teacherId}`,
                  "/api/classes",
                  "/api/sections",
                  "/api/subjects",
                ]}
              >
                <Button className="app-button-page">Edit Teacher</Button>
              </AppPrefetchLink>
            </div>
          ) : (
            <Button
              variant="outline"
              className="app-button-back"
              onClick={navigateBack}
            >
              Back to Teachers
            </Button>
          )
        }
        meta={
          <>
            <span className="app-meta-chip">Teacher account</span>
            <span className="app-meta-chip">
              {user?.hasAllSections
                ? "All sections in scope"
                : "Section-limited access"}
            </span>
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
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
            meta: error
              ? "Teacher details could not be loaded cleanly."
              : "Teacher profile loaded successfully.",
          },
        ]}
      />

      {error && user ? <FeedbackNotice variant="info">{error}</FeedbackNotice> : null}

      {error && !user ? (
        <PageState
          variant="error"
          title="Could not load teacher details"
          description={error}
          action={
            <>
              <Button
                type="button"
                variant="outline"
                className="app-button-back"
                onClick={navigateBack}
              >
                Back to Teachers
              </Button>
              <Button
                type="button"
                className="app-button-filter"
                onClick={retryLoad}
              >
                Try Again
              </Button>
            </>
          }
        />
      ) : !user ? (
        <PageState
          title="Teacher not found"
          description="We could not find a teacher record for this request."
          action={
            <Button
              type="button"
              variant="outline"
              className="app-button-back"
              onClick={navigateBack}
            >
              Back to Teachers
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-detail-grid">
                <DetailItem label="Gender" value={getUserGenderLabel(user.gender) || "-"} />
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
                emptyTitle="No classes assigned"
                emptyDescription="Assign one or more classes to define this teacher's working scope."
              />
              <AccessList
                title="Sections"
                items={academicSectionNames}
                emptyTitle="No sections assigned"
                emptyDescription={
                  user?.hasAllSections
                    ? "Section access will open once classes are assigned."
                    : "Assign sections or enable all sections in the selected classes."
                }
              />
              <AccessList
                title="Subjects"
                items={subjectNames}
                emptyTitle="No subjects assigned"
                emptyDescription="Assign at least one subject to give this teacher paper and reporting scope."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
