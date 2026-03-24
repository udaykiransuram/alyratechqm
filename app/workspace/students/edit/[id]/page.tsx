"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import PageLoadingState from "@/components/ui/page-loading-state";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import PageState from "@/components/ui/page-state";
import { fetchApiJson, peekCachedApiJson } from "@/lib/client/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface ClassItem {
  _id: string;
  name: string;
}

interface AcademicSectionItem {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
}

function getSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

const EDIT_PAGE_CACHE_TTL_MS = 60_000;

function buildStudentForm(user: any) {
  return {
    name: user.name || "",
    email: user.email || "",
    mobileNumber: user.mobileNumber || "",
    class: user.class ? String(user.class) : "",
    academicSection: user.academicSection ? String(user.academicSection) : "",
    rollNumber: user.rollNumber || "",
    enrolledAt: user.enrolledAt
      ? new Date(user.enrolledAt).toISOString().split("T")[0]
      : "",
  };
}

export default function EditStudentPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { navigateBack } = useBackNavigation(`/workspace/students/${id}`);
  const cachedUserResponse = id
    ? peekCachedApiJson<{ user?: any }>(`/api/users/${id}`, {
        clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
      })
    : null;
  const cachedClassesResponse = peekCachedApiJson<{ classes?: ClassItem[] }>("/api/classes", {
    clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
  });
  const cachedSectionsResponse = peekCachedApiJson<{ sections?: AcademicSectionItem[] }>(
    "/api/sections",
    {
      clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
    },
  );
  const hasCachedUser = Boolean(cachedUserResponse?.user);
  const [hasUserRecord, setHasUserRecord] = useState(hasCachedUser);

  const [classes, setClasses] = useState<ClassItem[]>(
    () => cachedClassesResponse?.classes || [],
  );
  const [sections, setSections] = useState<AcademicSectionItem[]>(
    () => cachedSectionsResponse?.sections || [],
  );
  const [loading, setLoading] = useState(() => !hasCachedUser);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [form, setForm] = useState(() => buildStudentForm(cachedUserResponse?.user || {}));

  const retryLoad = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(!hasCachedUser);
        setLoadError(null);
        setSubmitError(null);
        const [uJson, cJson, sJson] = await Promise.all([
          fetchApiJson<{ user?: any }>(`/api/users/${id}`, {
            cache: "no-store",
            fallbackMessage: "Failed to load user.",
            clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
            preferClientCache: true,
          }),
          fetchApiJson<{ classes?: ClassItem[] }>("/api/classes", {
            cache: "no-store",
            fallbackMessage: "Failed to load classes.",
            clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
            preferClientCache: true,
          }),
          fetchApiJson<{ sections?: AcademicSectionItem[] }>("/api/sections", {
            cache: "no-store",
            fallbackMessage: "Failed to load sections.",
            clientCacheTtlMs: EDIT_PAGE_CACHE_TTL_MS,
            preferClientCache: true,
          }),
        ]);
        if (!mounted) return;
        const nextUser = uJson.user || null;
        setHasUserRecord(Boolean(nextUser));
        setForm(buildStudentForm(nextUser || {}));
        setClasses(cJson.classes || []);
        setSections(sJson.sections || []);
      } catch (e: any) {
        setLoadError(e.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      mounted = false;
    };
  }, [hasCachedUser, id, reloadToken]);

  const filteredSections = useMemo(
    () => sections.filter((section) => getSectionClassId(section) === form.class),
    [sections, form.class],
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "class" ? { academicSection: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setSubmitError(null);
    try {
      await fetchApiJson("/api/users/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: "student",
          email: form.email.trim(),
          mobileNumber: form.mobileNumber.trim(),
          class: form.class,
          academicSection: form.academicSection,
          rollNumber: form.rollNumber.trim(),
          enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
        }),
        fallbackMessage: "Failed to update student.",
      });
      setMessage("Student updated successfully.");
      navigateBack();
    } catch (e: any) {
      setSubmitError(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        title="Loading student details"
        description="Preparing the student edit form and section assignment options."
        width="wide"
      />
    );
  }

  return (
    <PageShell width="wide">
      <PageHero
        eyebrow="People"
        title="Edit Student"
        description="Update student identity, placement, and credentials from the same standardized school setup used across people management."
        actions={
          <Button type="button" variant="outline" className="gap-2" onClick={navigateBack}>
            <ArrowLeft className="h-4 w-4" />
            Back to Details
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Student account</span>
            <span className="app-meta-chip">
              {form.rollNumber ? `Username: ${form.rollNumber}` : "Username pending"}
            </span>
            {loadError && hasUserRecord ? <span className="app-meta-chip">Refresh issue</span> : null}
          </>
        }
        stats={[
          {
            label: "Classes loaded",
            value: String(classes.length),
            meta: "Available class placements for this student.",
          },
          {
            label: "Visible sections",
            value: String(filteredSections.length),
            meta: "Sections available for the currently selected class.",
          },
          {
            label: "Form state",
            value: loadError && hasUserRecord
              ? "Review data"
              : submitError
                ? "Needs attention"
                : saving
                  ? "Saving"
                  : "Ready",
            meta: loadError && hasUserRecord
              ? "Cached data is available, but the latest school placement data could not be refreshed."
              : "Changes are applied to the current school only.",
          },
          {
            label: "Password control",
            value: "Student only",
            meta: "Admins can update roll numbers, and the default password syncs only when the student still uses that roll-number password.",
          },
        ]}
      />

      {message ? <FeedbackNotice variant="success">{message}</FeedbackNotice> : null}
      {loadError && hasUserRecord ? (
        <FeedbackNotice variant="info">{loadError}</FeedbackNotice>
      ) : null}
      {submitError ? <FeedbackNotice variant="error">{submitError}</FeedbackNotice> : null}

      {loadError && !hasUserRecord ? (
        <PageState
          variant="error"
          title="Could not load student details"
          description={loadError}
          action={
            <>
              <Button type="button" variant="outline" onClick={navigateBack}>
                Back to Details
              </Button>
              <Button type="button" onClick={retryLoad}>
                Try Again
              </Button>
            </>
          }
        />
      ) : !hasUserRecord ? (
        <PageState
          title="Student not found"
          description="We could not find a student record for this request."
          action={
            <Button type="button" variant="outline" onClick={navigateBack}>
              Back to Details
            </Button>
          }
        />
      ) : (
        <div className="app-editor-grid">
          <div className="app-editor-main">
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Student Profile</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="app-section">
                    <div className="app-form-section-heading">
                      <p className="app-form-section-title">Identity and contact</p>
                    </div>
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="name">Name</label>
                      <input
                        id="name"
                        name="name"
                        placeholder="Enter student name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        disabled={saving}
                        className="app-form-input"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="app-field-group">
                        <label className="app-field-label" htmlFor="email">Email (Optional)</label>
                        <input
                          id="email"
                          name="email"
                          placeholder="Enter email"
                          value={form.email}
                          onChange={handleChange}
                          type="email"
                          disabled={saving}
                          className="app-form-input"
                        />
                      </div>
                      <div className="app-field-group">
                        <label className="app-field-label" htmlFor="mobileNumber">Parent Mobile Number</label>
                        <input
                          id="mobileNumber"
                          name="mobileNumber"
                          placeholder="Enter WhatsApp number"
                          value={form.mobileNumber}
                          onChange={handleChange}
                          disabled={saving}
                          className="app-form-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="app-section">
                    <div className="app-form-section-heading">
                      <p className="app-form-section-title">Credentials</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Students manage their own passwords from the student account page.
                      If the student still uses the default roll-number password, changing the
                      roll number here will keep that default in sync automatically.
                    </p>
                  </div>

                  <div className="app-section">
                    <div className="app-form-section-heading">
                      <p className="app-form-section-title">School placement</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="app-field-group">
                        <label className="app-field-label" htmlFor="class">Class</label>
                        <select
                          id="class"
                          name="class"
                          value={form.class}
                          onChange={handleChange}
                          required
                          disabled={saving}
                          className="app-form-input"
                        >
                          <option value="">Select Class</option>
                          {classes.map((classItem) => (
                            <option key={classItem._id} value={classItem._id}>
                              {classItem.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="app-field-group">
                        <label className="app-field-label" htmlFor="academicSection">Section</label>
                        <select
                          id="academicSection"
                          name="academicSection"
                          value={form.academicSection}
                          onChange={handleChange}
                          required
                          disabled={saving || !form.class}
                          className="app-form-input"
                        >
                          <option value="">Select Section</option>
                          {filteredSections.map((section) => (
                            <option key={section._id} value={section._id}>
                              {section.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="app-field-group">
                        <label className="app-field-label" htmlFor="rollNumber">Roll Number / Username</label>
                        <input
                          id="rollNumber"
                          name="rollNumber"
                          placeholder="Enter roll number"
                          value={form.rollNumber}
                          onChange={handleChange}
                          required
                          disabled={saving}
                          className="app-form-input"
                        />
                      </div>
                    </div>
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="enrolledAt">Enrollment Date</label>
                      <input
                        id="enrolledAt"
                        name="enrolledAt"
                        value={form.enrolledAt}
                        onChange={handleChange}
                        type="date"
                        disabled={saving}
                        className="app-form-input"
                      />
                    </div>
                  </div>

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
