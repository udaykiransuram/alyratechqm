"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import {
  WorkspaceCreateModeToggle,
  type WorkspaceCreateMode,
} from "@/components/workspace/WorkspaceCreateGuideCard";
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
  buildWorkspaceBulkStructureSummary,
  buildWorkspaceUserBulkRows,
  WORKSPACE_USER_BULK_TEMPLATES,
} from "@/lib/client/workspace-user-bulk";
import { USER_GENDER_OPTIONS } from "@/lib/user-gender";
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
  const router = useRouter();
  const { navigateBack } = useBackNavigation("/workspace/students");
  const [currentSchoolKey, setCurrentSchoolKey] = useState("");
  const [form, setForm] = useState({
    name: "",
    fatherName: "",
    gender: "",
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
  const [createMode, setCreateMode] = useState<WorkspaceCreateMode>("single");

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
      fatherName: "",
      gender: "",
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
          fatherName: form.fatherName,
          gender: form.gender || undefined,
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
      const structureSummary = buildWorkspaceBulkStructureSummary(data);
      const failed = results.filter((result: any) => !result.success);
      const created = results.filter((result: any) => result.success && !result.existed);
      const existing = results.filter((result: any) => result.existed);

      setBulkFeedback({
        message: [
          "Bulk upload complete.",
          ...structureSummary,
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
      router.refresh();
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
      description="Create one student or switch to bulk upload."
      backLabel="Back to Students"
      onBack={navigateBack}
      mainClassName="space-y-4"
      badges={
        <>
          <span className="app-meta-chip">
            {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
          </span>
          <span className="app-meta-chip">Roll number login</span>
          <span className="app-meta-chip">Section required</span>
          <span className="app-meta-chip">{`${initialSections.length} sections`}</span>
        </>
      }
    >
      <WorkspaceCreateModeToggle
        value={createMode}
        onChange={setCreateMode}
        singleLabel="Single student"
        bulkLabel="Bulk students"
      />

      {feedback ? (
        <FeedbackNotice variant={feedback.variant}>{feedback.message}</FeedbackNotice>
      ) : null}

      {createMode === "single" ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header space-y-2.5">
            <CardTitle>Create Student Account</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="app-section space-y-4">
                <p className="app-form-section-title">Identity and contact</p>

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
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="app-field-group">
                    <Label htmlFor="student-father-name">Father name</Label>
                    <Input
                      id="student-father-name"
                      name="fatherName"
                      placeholder="Optional father name"
                      value={form.fatherName}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="app-field-group">
                    <Label htmlFor="student-gender">Gender</Label>
                    <Select
                      value={form.gender || "unspecified"}
                      onValueChange={(value) =>
                        setForm((currentForm) => ({
                          ...currentForm,
                          gender: value === "unspecified" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id="student-gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified">Select gender</SelectItem>
                        {USER_GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                  </div>
                </div>
              </div>

              <div className="app-section space-y-4">
                <p className="app-form-section-title">School placement</p>

                <div className="app-form-callout">
                  <p className="font-semibold text-foreground">Student sign-in</p>
                  <p className="mt-1.5">
                    Username is roll number. First password uses saved phone digits.
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
                  </div>
                </div>
              </div>

              <Button type="submit" size="xl" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Student Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <BulkUploadPanel
          id="student-bulk-upload"
          title="Bulk upload students"
          inputId="bulk-upload-students"
          onFileChange={handleBulkUpload}
          onDownloadTemplate={downloadTemplate}
          templateLabel="Download Student Template"
          loading={bulkLoading}
          loadingLabel="Uploading students..."
          compact
          feedback={bulkFeedback}
          tips={WORKSPACE_USER_BULK_TEMPLATES.student.tips}
        />
      )}
    </WorkspaceCreateShell>
  );
}
