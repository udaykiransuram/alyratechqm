"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import StudentPasswordAdminPanel from "@/components/workspace/students/StudentPasswordAdminPanel";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import PageState from "@/components/ui/page-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { StudentPasswordAdminInfo } from "@/lib/user-credentials";
import { USER_GENDER_OPTIONS } from "@/lib/user-gender";

type ClassItem = {
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
  gender?: string;
  fatherName?: string;
  email?: string;
  mobileNumber?: string;
  class?: string;
  academicSection?: string;
  rollNumber?: string;
  enrolledAt?: string;
  updatedAt?: string;
  studentPasswordInfo?: StudentPasswordAdminInfo;
};

export type EditStudentPageClientProps = {
  userId: string;
  schoolKey: string;
  initialUser: UserRecord | null;
  initialClasses: ClassItem[];
  initialSections: AcademicSectionItem[];
  initialLoadError?: string | null;
};

function getSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

function buildStudentForm(user: UserRecord | null) {
  return {
    name: user?.name || "",
    gender: user?.gender || "",
    fatherName: user?.fatherName || "",
    email: user?.email || "",
    mobileNumber: user?.mobileNumber || "",
    class: user?.class ? String(user.class) : "",
    academicSection: user?.academicSection ? String(user.academicSection) : "",
    rollNumber: user?.rollNumber || "",
    enrolledAt: user?.enrolledAt ? new Date(user.enrolledAt).toISOString().split("T")[0] : "",
  };
}

export default function EditStudentPageClient({
  userId,
  schoolKey,
  initialUser,
  initialClasses,
  initialSections,
  initialLoadError = null,
}: EditStudentPageClientProps) {
  const router = useRouter();
  const { navigateBack } = useBackNavigation(`/workspace/students/${userId}`);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(initialLoadError);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState(() => buildStudentForm(initialUser));

  const hasUserRecord = Boolean(initialUser);
  const classes = initialClasses;
  const sections = initialSections;

  useEffect(() => {
    setForm(buildStudentForm(initialUser));
    setLoadError(initialLoadError);
    setSubmitError(null);
    setMessage(null);
  }, [initialLoadError, initialUser]);

  const retryLoad = useCallback(() => {
    router.refresh();
  }, [router]);

  const filteredSections = useMemo(
    () => sections.filter((section) => getSectionClassId(section) === form.class),
    [sections, form.class],
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "class" ? { academicSection: "" } : {}),
    }));
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
          gender: form.gender || undefined,
          fatherName: form.fatherName.trim(),
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
        title="Edit Student"
        description="Update student identity, placement, and credentials from the same standardized school setup used across people management."
        actions={
          <Button type="button" variant="outline" className="app-button-back" onClick={navigateBack}>
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
            value: loadError && hasUserRecord ? "Review data" : submitError ? "Needs attention" : saving ? "Saving" : "Ready",
            meta: loadError && hasUserRecord
              ? "Cached data is available, but the latest school placement data could not be refreshed."
              : "Changes are applied to the current school only.",
          },
          {
            label: "Password control",
            value: "Admin support",
            meta: "Admins can view the current password only when it still matches saved phone-number digits, then reset to phone digits or generate a temporary password from the credentials panel below.",
          },
        ]}
      />

      {message ? <FeedbackNotice variant="success">{message}</FeedbackNotice> : null}
      {loadError && hasUserRecord ? <FeedbackNotice variant="info">{loadError}</FeedbackNotice> : null}
      {submitError ? <FeedbackNotice variant="error">{submitError}</FeedbackNotice> : null}

      {loadError && !hasUserRecord ? (
        <PageState
          variant="error"
          title="Could not load student details"
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
          title="Student not found"
          description="We could not find a student record for this request."
          action={
            <Button type="button" variant="outline" className="app-button-back" onClick={navigateBack}>
              Back to Details
            </Button>
          }
        />
      ) : (
        <div className="app-editor-grid">
          <div className="app-editor-main">
            <StudentPasswordAdminPanel
              studentId={userId}
              schoolKey={schoolKey}
              initialInfo={initialUser?.studentPasswordInfo}
            />

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
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="app-field-group">
                        <label className="app-field-label" htmlFor="fatherName">Father Name (Optional)</label>
                        <input
                          id="fatherName"
                          name="fatherName"
                          placeholder="Enter father name"
                          value={form.fatherName}
                          onChange={handleChange}
                          disabled={saving}
                          className="app-form-input"
                        />
                      </div>
                      <div className="app-field-group">
                        <label className="app-field-label" htmlFor="gender">Gender</label>
                        <select
                          id="gender"
                          name="gender"
                          value={form.gender}
                          onChange={handleChange}
                          disabled={saving}
                          className="app-form-input"
                        >
                          <option value="">Select gender</option>
                          {USER_GENDER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
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
