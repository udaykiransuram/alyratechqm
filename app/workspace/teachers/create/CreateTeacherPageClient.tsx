"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import MultiSelectChecklist from "@/components/multi-select-checklist";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import WorkspaceCreateGuideCard from "@/components/workspace/WorkspaceCreateGuideCard";
import WorkspaceCreateShell from "@/components/workspace/WorkspaceCreateShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { announceNavigationStart } from "@/lib/client/navigation-feedback";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import { downloadCsvTemplate, parseUploadFile } from "@/lib/client/bulk-upload";
import {
  buildWorkspaceUserBulkRows,
  WORKSPACE_USER_BULK_TEMPLATES,
} from "@/lib/client/workspace-user-bulk";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

function getSectionClassId(section: WorkspaceAcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

type CreateTeacherPageClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSections: WorkspaceAcademicSectionItem[];
  initialSubjects: WorkspaceSubjectItem[];
  initialMessage?: string | null;
};

export default function CreateTeacherPageClient({
  initialClasses,
  initialSections,
  initialSubjects,
  initialMessage = null,
}: CreateTeacherPageClientProps) {
  const router = useRouter();
  const { navigateBack } = useBackNavigation("/workspace/teachers");
  const [currentSchoolKey, setCurrentSchoolKey] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    classIds: [] as string[],
    academicSectionIds: [] as string[],
    hasAllSections: true,
    subjectIds: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
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
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{
    message: string;
    variant: FeedbackNoticeVariant;
  } | null>(null);

  const availableSections = useMemo(() => {
    const selectedClassIds = new Set(form.classIds);
    return initialSections.filter((section) =>
      selectedClassIds.has(getSectionClassId(section)),
    );
  }, [form.classIds, initialSections]);

  const availableSectionIds = useMemo(
    () => new Set(availableSections.map((section) => section._id)),
    [availableSections],
  );

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const updateToggle = (field: "hasAllSections", checked: boolean) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: checked,
      ...(field === "hasAllSections" && checked ? { academicSectionIds: [] } : {}),
    }));
  };

  const updateSelection = (
    field: "classIds" | "subjectIds" | "academicSectionIds",
    nextValues: string[],
  ) => {
    setForm((currentForm) => {
      if (field !== "classIds") {
        return { ...currentForm, [field]: nextValues };
      }

      const nextClassIds = nextValues;
      const nextClassIdSet = new Set(nextClassIds);
      const nextAcademicSectionIds = currentForm.academicSectionIds.filter((sectionId) => {
        const section = initialSections.find((item) => item._id === sectionId);
        return section ? nextClassIdSet.has(getSectionClassId(section)) : false;
      });

      return {
        ...currentForm,
        classIds: nextClassIds,
        academicSectionIds: nextAcademicSectionIds,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      await fetchApiJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: "teacher",
          academicSectionIds: form.hasAllSections
            ? []
            : form.academicSectionIds.filter((sectionId) => availableSectionIds.has(sectionId)),
        }),
        schoolKey,
        fallbackMessage: "We couldn't create the teacher account.",
      });

      setMessage({
        message: "Teacher account created.",
        variant: "success",
      });
      setForm({
        name: "",
        email: "",
        password: "",
        mobileNumber: "",
        classIds: [],
        academicSectionIds: [],
        hasAllSections: true,
        subjectIds: [],
      });
      announceNavigationStart("/workspace/manage/users");
      router.push("/workspace/manage/users");
    } catch (error: any) {
      setMessage({
        message: error?.message || "We couldn't create the teacher account.",
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
        role: "teacher",
        rows,
        classes: initialClasses,
        sections: initialSections,
        subjects: initialSubjects,
      });

      if (users.length === 0) {
        throw new Error(skippedRows[0] || "No valid teacher rows were found in the uploaded file.");
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
    const template = WORKSPACE_USER_BULK_TEMPLATES.teacher;
    downloadCsvTemplate(template.filename, template.headers, template.sampleRows);
  };

  useEffect(() => {
    setCurrentSchoolKey(resolveClientSchoolKey());
  }, []);

  return (
    <WorkspaceCreateShell
      eyebrow="People"
      title="Create Teacher"
      description="Set up one teacher with the right classes, sections, subjects, and first-login details before the account goes live."
      backLabel="Back to Teachers"
      onBack={navigateBack}
      badges={
        <>
          <span className="app-meta-chip">
            {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
          </span>
          <span className="app-meta-chip">Scoped access</span>
          <span className="app-meta-chip">Class + subject required</span>
          <span className="app-meta-chip">All sections optional</span>
        </>
      }
      aside={
        <>
          <WorkspaceCreateGuideCard
            title="Quick rules"
            description="Set the teacher up so their first sign-in and classroom scope are both obvious and safe."
            items={[
              {
                title: "Classes and subjects matter most",
                note: "A teacher account is only useful once at least one class and one subject are assigned.",
              },
              {
                title: "Use all sections only when true",
                note: "Keep section access wide only when the teacher actually handles every section in the selected classes.",
              },
              {
                title: "Bulk upload for larger teams",
                note: "The upload template supports multi-class and multi-subject assignments with the `|` separator.",
              },
            ]}
          />

          <BulkUploadPanel
            title="Bulk upload teachers"
            description="Import multiple teacher accounts with their class, section, and subject scope already assigned."
            inputId="bulk-upload-teachers"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            templateLabel="Download Teacher Template"
            loading={bulkLoading}
            loadingLabel="Uploading teachers..."
            feedback={bulkFeedback}
            disabled={initialClasses.length === 0 || initialSubjects.length === 0}
            tips={WORKSPACE_USER_BULK_TEMPLATES.teacher.tips}
          />
        </>
      }
    >
      {message ? (
        <FeedbackNotice variant={message.variant}>{message.message}</FeedbackNotice>
      ) : null}

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header space-y-2.5">
          <CardTitle>Create Teacher Account</CardTitle>
          <p className="app-form-section-copy">
            Start with identity and first-login details, then define the exact academic scope the teacher should see.
          </p>
        </CardHeader>
        <CardContent className="app-section-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="app-section space-y-4">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">Identity and contact</p>
                <p className="app-form-section-copy">
                  These are the main contact details that appear in the school directory.
                </p>
              </div>

              <div className="app-field-group">
                <Label htmlFor="teacher-name">Teacher name</Label>
                <Input
                  id="teacher-name"
                  name="name"
                  placeholder="Enter teacher name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
                <p className="app-field-note">
                  Use the teacher&apos;s full working name so the directory, reports, and class views stay recognizable.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group">
                  <Label htmlFor="teacher-email">Email</Label>
                  <Input
                    id="teacher-email"
                    name="email"
                    type="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={handleChange}
                  />
                  <p className="app-field-note">
                    Helpful for communication and record quality, even if login does not depend on email.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="teacher-mobile">Phone number</Label>
                  <Input
                    id="teacher-mobile"
                    name="mobileNumber"
                    placeholder="Phone number"
                    value={form.mobileNumber}
                    onChange={handleChange}
                    required
                  />
                  <p className="app-field-note">
                    Keep this current so urgent school contact and parent-facing workflows reach the right person.
                  </p>
                </div>
              </div>
            </div>

            <div className="app-section space-y-4">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">Login setup</p>
                <p className="app-form-section-copy">
                  Set the first password carefully. This is the credential the teacher receives when the account is handed over.
                </p>
              </div>

              <div className="app-field-group">
                <Label htmlFor="teacher-password">Password</Label>
                <Input
                  id="teacher-password"
                  name="password"
                  type="password"
                  placeholder="Set the first password"
                  value={form.password}
                  onChange={handleChange}
                />
                <p className="app-field-note">
                  Use a strong starting password and share it securely with the teacher.
                </p>
              </div>

              <div className="app-form-callout">
                <p className="font-semibold text-foreground">Teacher access rule</p>
                <p className="mt-1.5">
                  Teachers should only get the classes and subjects they actively teach. Their scope affects papers, analytics, and student views.
                </p>
              </div>
            </div>

            <div className="app-section space-y-4">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">Academic access</p>
                <p className="app-form-section-copy">
                  Select the exact classes, sections, and subjects this teacher should work in.
                </p>
              </div>

              <div className="app-field-group">
                <Label>Classes</Label>
                <MultiSelectChecklist
                  items={initialClasses.map((classItem) => ({
                    id: classItem._id,
                    label: classItem.name,
                  }))}
                  selectedIds={form.classIds}
                  onChange={(ids) => updateSelection("classIds", ids)}
                  helperText="Critical selection. Pick at least one class before sections and subject-linked work can make sense."
                />
              </div>

              <label
                className={`app-toggle-card ${form.hasAllSections ? "app-toggle-card-active" : ""}`}
              >
                <Checkbox
                  checked={form.hasAllSections}
                  onCheckedChange={(checked) =>
                    updateToggle("hasAllSections", checked === true)
                  }
                  className="mt-0.5"
                />
                <span className="app-toggle-card-copy">
                  <span className="app-toggle-card-title">
                    All sections in selected classes
                  </span>
                  <span className="app-toggle-card-note">
                    Leave this on when the teacher works across every section for the chosen classes.
                  </span>
                </span>
              </label>

              {!form.hasAllSections ? (
                <div className="app-field-group">
                  <Label>Sections</Label>
                  <MultiSelectChecklist
                    items={availableSections.map((section) => ({
                      id: section._id,
                      label: (
                        <span>
                          {section.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            (
                            {initialClasses.find(
                              (classItem) => classItem._id === getSectionClassId(section),
                            )?.name || "Class"}
                            )
                          </span>
                        </span>
                      ),
                    }))}
                    selectedIds={form.academicSectionIds}
                    onChange={(ids) => updateSelection("academicSectionIds", ids)}
                    emptyContent="Select one or more classes to choose sections."
                    helperText="Only sections from the selected classes appear here, so the final scope stays accurate."
                  />
                </div>
              ) : null}

              <div className="app-field-group">
                <Label>Subjects</Label>
                <MultiSelectChecklist
                  items={initialSubjects.map((subject) => ({
                    id: subject._id,
                    label: subject.name,
                  }))}
                  selectedIds={form.subjectIds}
                  onChange={(ids) => updateSelection("subjectIds", ids)}
                  helperText="Critical selection. Subjects control where this teacher can work inside question papers, reports, and analytics."
                />
              </div>
            </div>

            <Button type="submit" size="xl" className="w-full" disabled={loading}>
              {loading ? "Creating..." : "Create Teacher Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </WorkspaceCreateShell>
  );
}
