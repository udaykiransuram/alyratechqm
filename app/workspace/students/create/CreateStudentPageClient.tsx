"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import WorkspaceCreateGuideCard from "@/components/workspace/WorkspaceCreateGuideCard";
import WorkspaceCreateShell from "@/components/workspace/WorkspaceCreateShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import {
  downloadCsvTemplate,
  parseUploadFile,
} from "@/lib/client/bulk-upload";
import {
  buildWorkspaceUserBulkRows,
  WORKSPACE_USER_BULK_TEMPLATES,
} from "@/lib/client/workspace-user-bulk";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
} from "@/lib/workspace/support-types";

function getSectionClassId(section: WorkspaceAcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

type CreateStudentPageClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSections: WorkspaceAcademicSectionItem[];
  initialMessage?: string | null;
};

export default function CreateStudentPageClient({
  initialClasses,
  initialSections,
  initialMessage = null,
}: CreateStudentPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/students");
  const [currentSchoolKey, setCurrentSchoolKey] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    class: "",
    academicSection: "",
    rollNumber: "",
    enrolledAt: "",
  });
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    variant: FeedbackNoticeVariant;
  } | null>(
    initialMessage
      ? {
          message: initialMessage,
          variant: "error",
        }
      : null,
  );
  const [bulkFeedback, setBulkFeedback] = useState<{
    message: string;
    variant: FeedbackNoticeVariant;
  } | null>(null);

  const filteredSections = useMemo(
    () => initialSections.filter((section) => getSectionClassId(section) === form.class),
    [form.class, initialSections],
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleClassChange = (value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      class: value,
      academicSection: "",
    }));
  };

  const resetForm = () => {
    setForm({
      name: "",
      email: "",
      mobileNumber: "",
      class: "",
      academicSection: "",
      rollNumber: "",
      enrolledAt: "",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      if (!form.class || !form.academicSection || !form.rollNumber.trim()) {
        throw new Error("Class, section, and roll number are required.");
      }

      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      const data = await fetchApiJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          mobileNumber: form.mobileNumber,
          class: form.class,
          academicSection: form.academicSection,
          rollNumber: form.rollNumber,
          role: "student",
          enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
        }),
        schoolKey,
        fallbackMessage: "We couldn't create the student account.",
      });

      setFeedback({
        message: data.existed ? "Student already exists." : "Student created.",
        variant: data.existed ? "warning" : "success",
      });
      resetForm();
    } catch (error: any) {
      setFeedback({
        message: error?.message || "We couldn't create the student account.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBulkLoading(true);
    setBulkFeedback(null);

    try {
      const rows = await parseUploadFile(file);
      const { users, skippedRows } = buildWorkspaceUserBulkRows({
        role: "student",
        rows,
        classes: initialClasses,
        sections: initialSections,
        subjects: [],
      });

      if (users.length === 0) {
        throw new Error(skippedRows[0] || "No valid student rows were found in the uploaded file.");
      }

      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      const data = await fetchApiJson<any>("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
        schoolKey,
        fallbackMessage: "We couldn't complete the bulk upload.",
      });

      const results = Array.isArray(data.results) ? data.results : [];
      const failed = results.filter((result: any) => !result.success);
      const created = results.filter((result: any) => result.success && !result.existed);
      const existing = results.filter((result: any) => result.existed);

      setBulkFeedback({
        message: [
          "Bulk upload complete.",
          `Created: ${created.length}.`,
          `Existing: ${existing.length}.`,
          `Failed after upload: ${failed.length}.`,
          skippedRows.length ? `Skipped before upload: ${skippedRows.length}.` : null,
        ]
          .filter(Boolean)
          .join(" "),
        variant:
          failed.length > 0 || skippedRows.length > 0
            ? created.length > 0 || existing.length > 0
              ? "warning"
              : "error"
            : "success",
      });
    } catch (error: any) {
      setBulkFeedback({
        message: error?.message || "We couldn't complete the bulk upload.",
        variant: "error",
      });
    } finally {
      event.target.value = "";
      setBulkLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = WORKSPACE_USER_BULK_TEMPLATES.student;
    downloadCsvTemplate(template.filename, template.headers, template.sampleRows);
  };

  useEffect(() => {
    setCurrentSchoolKey(resolveClientSchoolKey());
  }, []);

  return (
    <WorkspaceCreateShell
      eyebrow="People"
      title="Create Student"
      description="Add one student with clear sign-in and placement details, or import a full class list once the academic structure is ready."
      backLabel="Back to Students"
      onBack={navigateBack}
      badges={
        <>
          <span className="app-meta-chip">
            {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
          </span>
          <span className="app-meta-chip">Roll number login</span>
          <span className="app-meta-chip">Section required</span>
          <span className="app-meta-chip">{`${initialSections.length} sections loaded`}</span>
        </>
      }
      aside={
        <>
          <WorkspaceCreateGuideCard
            title="Quick rules"
            description="Set up the student so sign-in works immediately and the school placement is unmistakable."
            items={[
              {
                title: "Roll number becomes login",
                note: "The roll number is the username, and the first password is the saved phone-number digits exactly as stored.",
              },
              {
                title: "Pick class before section",
                note: "Sections are filtered by the selected class so placement stays accurate.",
              },
              {
                title: "Use bulk upload for full lists",
                note: "CSV and Excel imports work best once classes and sections already exist.",
              },
            ]}
          />

          <BulkUploadPanel
            id="student-bulk-upload"
            title="Bulk upload students"
            description="Import a student list with class, section, roll number, and contact details for the active school."
            inputId="bulk-upload-students"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            templateLabel="Download Student Template"
            loading={bulkLoading}
            loadingLabel="Uploading students..."
            disabled={initialClasses.length === 0}
            feedback={bulkFeedback}
            tips={WORKSPACE_USER_BULK_TEMPLATES.student.tips}
          />
        </>
      }
    >
      {feedback ? (
        <FeedbackNotice variant={feedback.variant}>{feedback.message}</FeedbackNotice>
      ) : null}

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header space-y-4">
          <div className="space-y-2.5">
            <CardTitle>Create Student Account</CardTitle>
            <p className="app-form-section-copy">
              Start with identity and family contact details, then lock the student into the right class, section, and roll number.
            </p>
          </div>
        </CardHeader>
        <CardContent className="app-section-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="app-section space-y-4">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">Identity and contact</p>
                <p className="app-form-section-copy">
                  Keep contact details clean so reports and parent communication stay reliable.
                </p>
              </div>

              <div className="app-field-group">
                <Label htmlFor="student-name">Student name</Label>
                <Input
                  id="student-name"
                  name="name"
                  placeholder="Enter student name"
                  value={form.name}
                  onChange={handleInputChange}
                  required
                />
                <p className="app-field-note">
                  Use the student&apos;s full school name so attendance, reports, and analytics stay consistent.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group">
                  <Label htmlFor="student-email">Email</Label>
                  <Input
                    id="student-email"
                    name="email"
                    type="email"
                    placeholder="Optional email address"
                    value={form.email}
                    onChange={handleInputChange}
                  />
                  <p className="app-field-note">
                    Optional for most students, but useful when the account needs a cleaner long-term contact record.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="student-mobile">Parent phone</Label>
                  <Input
                    id="student-mobile"
                    name="mobileNumber"
                    placeholder="Parent or guardian phone"
                    value={form.mobileNumber}
                    onChange={handleInputChange}
                  />
                  <p className="app-field-note">
                    Best number for report delivery, parent contact, and follow-up around tests.
                  </p>
                </div>
              </div>
            </div>

            <div className="app-section space-y-4">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">Login setup</p>
                <p className="app-form-section-copy">
                  The roll number is the one field students and staff will notice most during sign-in support.
                </p>
              </div>

              <div className="app-form-callout">
                <p className="font-semibold text-foreground">Student sign-in</p>
                <p className="mt-1.5">
                  Students use the school key plus their roll number to sign in. The first password is the saved phone-number digits exactly as stored, including country code digits if they were saved.
                </p>
              </div>
            </div>

            <div className="app-section space-y-4">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">School placement</p>
                <p className="app-form-section-copy">
                  These fields control class grouping, section assignment, and student-test eligibility.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group">
                  <Label htmlFor="student-class">Class</Label>
                  <Select value={form.class} onValueChange={handleClassChange}>
                    <SelectTrigger id="student-class">
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {initialClasses.map((classItem) => (
                        <SelectItem key={classItem._id} value={classItem._id}>
                          {classItem.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="app-field-note">
                    Choose class first. It controls section options and where the student appears everywhere else.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="student-roll-number">Roll number</Label>
                  <Input
                    id="student-roll-number"
                    name="rollNumber"
                    placeholder="Enter roll number"
                    value={form.rollNumber}
                    onChange={handleInputChange}
                    required
                  />
                  <p className="app-field-note">
                    Most important placement field. This becomes the student&apos;s username. If sign-in support is needed later, admins can reset the password from the student detail page.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="student-section">Section</Label>
                  <Select
                    value={form.academicSection}
                    onValueChange={(value) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        academicSection: value,
                      }))
                    }
                    disabled={!form.class}
                  >
                    <SelectTrigger id="student-section">
                      <SelectValue
                        placeholder={form.class ? "Select section" : "Choose class first"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSections.map((section) => (
                        <SelectItem key={section._id} value={section._id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="app-field-note">
                    Required for this flow. Sections are filtered by the chosen class so placement stays accurate.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="student-enrolled-at">Enrollment date</Label>
                  <Input
                    id="student-enrolled-at"
                    name="enrolledAt"
                    type="date"
                    value={form.enrolledAt}
                    onChange={handleInputChange}
                  />
                  <p className="app-field-note">
                    Useful for backfilling legacy data or recording mid-year admissions.
                  </p>
                </div>
              </div>
            </div>

            <Button type="submit" size="xl" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Student Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </WorkspaceCreateShell>
  );
}
