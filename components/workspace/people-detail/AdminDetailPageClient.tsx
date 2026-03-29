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
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

type UserItem = {
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

type AdminDetailPageClientProps = {
  adminId: string;
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

export default function AdminDetailPageClient({
  adminId,
  initialUser,
  initialClasses,
  initialSections,
  initialSubjects,
  initialLoadError = null,
}: AdminDetailPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/admins");
  const currentPath = useCurrentPathWithSearch("/workspace/admins");
  const editHref = buildHrefWithReturnTo(`/workspace/admins/edit/${adminId}`, currentPath);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [user, setUser] = useState<UserItem | null>(initialUser);
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [sections, setSections] = useState<AcademicSectionItem[]>(initialSections);
  const [subjects, setSubjects] = useState<SubjectItem[]>(initialSubjects);
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
        setError("Please select a school in the navbar to view admin details.");
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
          fetchApiJson<any>(`/api/users/${adminId}`, {
            cache: "no-store",
            schoolKey,
            fallbackMessage: "Failed to load admin.",
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
  }, [adminId, reloadToken, user]);

  const classNames = useMemo(() => {
    if (user?.hasAllClasses) return ["All Classes"];
    return (user?.classIds || []).map(
      (classId) =>
        classes.find((classItem) => classItem._id === classId)?.name || classId,
    );
  }, [classes, user?.classIds, user?.hasAllClasses]);

  const academicSectionNames = useMemo(() => {
    if (user?.hasAllSections) {
      return [user?.hasAllClasses ? "All sections" : "All sections in selected classes"];
    }

    return (user?.academicSectionIds || []).map((sectionId) => {
      const section = sections.find((item) => item._id === sectionId);
      if (!section) return sectionId;
      const className = classes.find(
        (classItem) => classItem._id === getSectionClassId(section),
      )?.name;
      return className ? `${section.name} (${className})` : section.name;
    });
  }, [classes, sections, user?.academicSectionIds, user?.hasAllClasses, user?.hasAllSections]);

  const subjectNames = useMemo(() => {
    if (user?.hasAllSubjects) return ["All Subjects"];
    return (user?.subjectIds || []).map(
      (subjectId) =>
        subjects.find((subject) => subject._id === subjectId)?.name || subjectId,
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
        variant="editor"
        eyebrow="People"
        title={user?.name || "Admin Details"}
        description="Inspect school-admin profile information and the exact access envelope configured across classes, sections, and subjects."
        actions={
          user ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                className="app-button-back"
                onClick={navigateBack}
              >
                Back to Admins
              </Button>
              <AppPrefetchLink
                href={editHref}
                relatedApiPrefetches={[
                  `/api/users/${adminId}`,
                  "/api/classes",
                  "/api/sections",
                  "/api/subjects",
                ]}
              >
                <Button className="app-button-page">Edit Admin</Button>
              </AppPrefetchLink>
            </div>
          ) : (
            <Button
              variant="outline"
              className="app-button-back"
              onClick={navigateBack}
            >
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
            meta: user?.hasAllClasses
              ? "All classes are enabled."
              : "Specific class assignments only.",
          },
          {
            label: "Section access",
            value: loading ? "—" : String(academicSectionNames.length),
            meta: user?.hasAllSections
              ? "Section access is broad within scope."
              : "Only selected sections are enabled.",
          },
          {
            label: "Subject access",
            value: loading ? "—" : String(subjectNames.length),
            meta: user?.hasAllSubjects
              ? "All subjects are available."
              : "Only selected subjects are enabled.",
          },
          {
            label: "Profile state",
            value: loading ? "Loading" : error ? "Needs review" : "Ready",
            meta: error
              ? "Admin details could not be loaded cleanly."
              : "Admin profile loaded successfully.",
          },
        ]}
      />

      {error && user ? <FeedbackNotice variant="info">{error}</FeedbackNotice> : null}

      {error && !user ? (
        <PageState
          variant="error"
          title="Could not load admin details"
          description={error}
          action={
            <>
              <Button
                type="button"
                variant="outline"
                className="app-button-back"
                onClick={navigateBack}
              >
                Back to Admins
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
          title="Admin not found"
          description="We could not find an admin record for this request."
          action={
            <Button
              type="button"
              variant="outline"
              className="app-button-back"
              onClick={navigateBack}
            >
              Back to Admins
            </Button>
          }
        />
      ) : (
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle className="text-xl font-semibold tracking-tight">
              {user.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <div className="app-detail-grid">
              <DetailItem label="Email" value={user.email || "-"} />
              <DetailItem label="Phone" value={user.mobileNumber || "-"} />
              <DetailItem
                label="Classes Access"
                value={classNames.join(", ") || "-"}
              />
              <DetailItem
                label="Sections Access"
                value={academicSectionNames.join(", ") || "-"}
              />
              <DetailItem
                label="Subjects Access"
                value={subjectNames.join(", ") || "-"}
              />
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
      )}
    </PageShell>
  );
}
