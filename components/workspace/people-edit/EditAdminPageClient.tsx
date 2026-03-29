"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import MultiSelectChecklist from "@/components/multi-select-checklist";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson } from "@/lib/client/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import PageState from "@/components/ui/page-state";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

type UserRecord = {
  _id: string;
  name?: string;
  email?: string;
  mobileNumber?: string;
  hasAllClasses?: boolean;
  hasAllSections?: boolean;
  hasAllSubjects?: boolean;
  classIds?: string[];
  academicSectionIds?: string[];
  subjectIds?: string[];
  updatedAt?: string;
};

export type EditAdminPageClientProps = {
  userId: string;
  schoolKey: string;
  initialUser: UserRecord | null;
  initialClasses: ClassItem[];
  initialSections: AcademicSectionItem[];
  initialSubjects: SubjectItem[];
  initialLoadError?: string | null;
};

function getSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

function buildAdminForm(user: UserRecord | null) {
  return {
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    mobileNumber: user?.mobileNumber || "",
    hasAllClasses: Boolean(user?.hasAllClasses),
    hasAllSections: typeof user?.hasAllSections === "boolean" ? user.hasAllSections : true,
    hasAllSubjects: Boolean(user?.hasAllSubjects),
    classIds: (user?.classIds || []).map(String),
    academicSectionIds: (user?.academicSectionIds || []).map(String),
    subjectIds: (user?.subjectIds || []).map(String),
  };
}

export default function EditAdminPageClient({
  userId,
  schoolKey,
  initialUser,
  initialClasses,
  initialSections,
  initialSubjects,
  initialLoadError = null,
}: EditAdminPageClientProps) {
  const router = useRouter();
  const { navigateBack } = useBackNavigation(`/workspace/admins/${userId}`);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState(() => buildAdminForm(initialUser));
  const [showPassword, setShowPassword] = useState(false);

  const hasUserRecord = Boolean(initialUser);
  const classes = initialClasses;
  const subjects = initialSubjects;
  const sections = initialSections;

  useEffect(() => {
    setForm(buildAdminForm(initialUser));
    setLoadError(initialLoadError);
    setSubmitError(null);
    setMessage(null);
  }, [initialLoadError, initialUser]);

  const retryLoad = useCallback(() => {
    router.refresh();
  }, [router]);

  const availableSections = useMemo(() => {
    if (form.hasAllClasses) {
      return sections;
    }
    const selectedClassIds = new Set(form.classIds);
    return sections.filter((section) => selectedClassIds.has(getSectionClassId(section)));
  }, [form.classIds, form.hasAllClasses, sections]);

  const availableSectionIds = useMemo(
    () => new Set(availableSections.map((section) => section._id)),
    [availableSections],
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const updateToggle = (
    field: "hasAllClasses" | "hasAllSections" | "hasAllSubjects",
    checked: boolean,
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: checked,
      ...(field === "hasAllSections" && checked ? { academicSectionIds: [] } : {}),
    }));
  };

  const updateSelection = (
    field: "classIds" | "subjectIds" | "academicSectionIds",
    nextValues: string[],
  ) => {
    setForm((previous) => {
      if (field !== "classIds") {
        return { ...previous, [field]: nextValues };
      }

      const nextClassIds = nextValues;
      const nextClassIdSet = new Set(nextClassIds);
      const nextAcademicSectionIds = previous.academicSectionIds.filter((sectionId: string) => {
        if (previous.hasAllClasses) return true;
        const section = sections.find((item) => item._id === sectionId);
        return section ? nextClassIdSet.has(getSectionClassId(section)) : false;
      });

      return {
        ...previous,
        classIds: nextClassIds,
        academicSectionIds: nextAcademicSectionIds,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setSubmitError(null);

    try {
      await fetchApiJson("/api/users/" + userId, {
        method: "PUT",
        schoolKey,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: "admin",
          email: form.email.trim(),
          mobileNumber: form.mobileNumber.trim(),
          password: form.password || undefined,
          hasAllClasses: form.hasAllClasses,
          hasAllSections: form.hasAllSections,
          hasAllSubjects: form.hasAllSubjects,
          classIds: form.hasAllClasses ? [] : form.classIds,
          academicSectionIds: form.hasAllSections
            ? []
            : form.academicSectionIds.filter((sectionId: string) => availableSectionIds.has(sectionId)),
          subjectIds: form.hasAllSubjects ? [] : form.subjectIds,
        }),
        fallbackMessage: "Failed to update admin.",
      });
      setMessage("Admin updated successfully.");
      navigateBack();
    } catch (error: any) {
      setSubmitError(error?.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell width="wide">
      <PageHero
        variant="editor"
        eyebrow="People"
        title="Edit Admin"
        description="Update school-admin identity and refine access boundaries using the same layout and language applied across the rest of the workspace."
        actions={
          <Button type="button" variant="outline" className="app-button-back" onClick={navigateBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to Details
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Admin account</span>
            <span className="app-meta-chip">
              {form.hasAllClasses && form.hasAllSections && form.hasAllSubjects ? "Full school access" : "Restricted scope"}
            </span>
            {loadError && hasUserRecord ? <span className="app-meta-chip">Refresh issue</span> : null}
          </>
        }
        stats={[
          {
            label: "Class scope",
            value: form.hasAllClasses ? "All" : String(form.classIds.length),
            meta: form.hasAllClasses ? "Admin can access every class." : "Only selected classes are enabled.",
          },
          {
            label: "Section scope",
            value: form.hasAllSections ? "All" : String(form.academicSectionIds.length),
            meta: form.hasAllSections ? "Section access stays broad within scope." : "Only selected sections are enabled.",
          },
          {
            label: "Subject scope",
            value: form.hasAllSubjects ? "All" : String(form.subjectIds.length),
            meta: form.hasAllSubjects ? "Admin can access every subject." : "Only selected subjects are enabled.",
          },
          {
            label: "Form state",
            value: loadError && hasUserRecord ? "Review data" : submitError ? "Needs attention" : saving ? "Saving" : "Ready",
            meta: loadError && hasUserRecord
              ? "Cached admin data is available, but the latest scope data could not be refreshed."
              : "Updates are applied only inside the current school.",
          },
        ]}
      />

      {message ? <FeedbackNotice variant="success">{message}</FeedbackNotice> : null}
      {loadError && hasUserRecord ? <FeedbackNotice variant="info">{loadError}</FeedbackNotice> : null}
      {submitError ? <FeedbackNotice variant="error">{submitError}</FeedbackNotice> : null}

      {loadError && !hasUserRecord ? (
        <PageState
          variant="error"
          title="Could not load admin details"
          description={loadError}
          action={
            <>
              <Button type="button" variant="outline" className="app-button-back" onClick={navigateBack}>
                Back to Details
              </Button>
              <Button type="button" className="app-button-filter" onClick={retryLoad}>
                Try Again
              </Button>
            </>
          }
        />
      ) : !hasUserRecord ? (
        <PageState
          title="Admin not found"
          description="We could not find an admin record for this request."
          action={
            <Button type="button" variant="outline" className="app-button-back" onClick={navigateBack}>
              Back to Details
            </Button>
          }
        />
      ) : (
        <div className="app-editor-grid">
          <div className="app-editor-main">
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Admin Profile</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="name">Name</label>
                    <input id="name" name="name" value={form.name} onChange={handleChange} required className="app-form-input" placeholder="Name" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="email">Email</label>
                      <input id="email" name="email" value={form.email} onChange={handleChange} type="email" className="app-form-input" placeholder="Email" />
                    </div>
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="mobileNumber">Phone Number</label>
                      <input id="mobileNumber" name="mobileNumber" value={form.mobileNumber} onChange={handleChange} required className="app-form-input" placeholder="Phone Number" />
                    </div>
                  </div>

                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="password">Reset Password</label>
                    <div className="flex gap-2">
                      <input
                        id="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        type={showPassword ? "text" : "password"}
                        className="app-form-input"
                        placeholder="Leave blank to keep the existing password"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0"
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Current passwords are stored as secure hashes, so they cannot be viewed here.
                      Enter a new password only when you want to replace the existing one.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                      <Checkbox
                        checked={form.hasAllClasses}
                        onCheckedChange={(checked) => updateToggle("hasAllClasses", checked === true)}
                        className="mt-0.5"
                      />
                      <span>All Classes</span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                      <Checkbox
                        checked={form.hasAllSections}
                        onCheckedChange={(checked) => updateToggle("hasAllSections", checked === true)}
                        className="mt-0.5"
                      />
                      <span>All Sections</span>
                    </label>
                    <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                      <Checkbox
                        checked={form.hasAllSubjects}
                        onCheckedChange={(checked) => updateToggle("hasAllSubjects", checked === true)}
                        className="mt-0.5"
                      />
                      <span>All Subjects</span>
                    </label>
                  </div>

                  {!form.hasAllClasses && (
                    <div className="app-field-group">
                      <label className="app-field-label">Classes</label>
                      <MultiSelectChecklist
                        items={classes.map((classItem) => ({
                          id: classItem._id,
                          label: classItem.name,
                        }))}
                        selectedIds={form.classIds}
                        onChange={(ids) => updateSelection("classIds", ids)}
                      />
                    </div>
                  )}

                  {!form.hasAllSections && (
                    <div className="app-field-group">
                      <label className="app-field-label">Sections</label>
                      <MultiSelectChecklist
                        items={availableSections.map((section) => ({
                          id: section._id,
                          label: (
                            <span>
                              {section.name}
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({classes.find((classItem) => classItem._id === getSectionClassId(section))?.name || "Class"})
                              </span>
                            </span>
                          ),
                        }))}
                        selectedIds={form.academicSectionIds}
                        onChange={(ids) => updateSelection("academicSectionIds", ids)}
                        emptyContent={form.hasAllClasses ? "No sections have been created yet." : "Select one or more classes to choose sections."}
                      />
                    </div>
                  )}

                  {!form.hasAllSubjects && (
                    <div className="app-field-group">
                      <label className="app-field-label">Subjects</label>
                      <MultiSelectChecklist
                        items={subjects.map((subject) => ({
                          id: subject._id,
                          label: subject.name,
                        }))}
                        selectedIds={form.subjectIds}
                        onChange={(ids) => updateSelection("subjectIds", ids)}
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving} className="sm:min-w-[160px]">
                      {saving ? <Spinner /> : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PageShell>
  );
}
