"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import MultiSelectChecklist from "@/components/multi-select-checklist";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PageHero from "@/components/layout/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { announceNavigationStart } from "@/lib/client/navigation-feedback";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import { downloadCsvTemplate, parseUploadFile } from "@/lib/client/bulk-upload";
import {
  buildWorkspaceUserBulkRows,
  WORKSPACE_USER_BULK_TEMPLATES,
} from "@/lib/client/workspace-user-bulk";
import FeedbackNotice, { type FeedbackNoticeVariant } from "@/components/ui/feedback-notice";
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

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Create Teacher"
        description="Create a teacher account and configure the exact class, section, and subject scope the teacher should see in the workspace."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teachers
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Scoped teacher access</span>
            <span className="app-meta-chip">Class + subject required</span>
          </>
        }
        stats={[
          {
            label: "Classes selected",
            value: String(form.classIds.length),
            meta: "Teachers must have at least one class assignment.",
          },
          {
            label: "Sections in scope",
            value: form.hasAllSections ? "All" : String(form.academicSectionIds.length),
            meta: form.hasAllSections
              ? "Teacher can work in all sections of selected classes."
              : "Only explicitly selected sections are enabled.",
          },
          {
            label: "Subjects selected",
            value: String(form.subjectIds.length),
            meta: "Teachers must have at least one subject assignment.",
          },
          {
            label: "Form state",
            value: loading ? "Saving" : "Ready",
            meta: "This page now opens with server-loaded assignment data.",
          },
        ]}
      />

      {message ? (
        <FeedbackNotice variant={message.variant}>{message.message}</FeedbackNotice>
      ) : null}

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Teacher Profile</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Identity and contact</p>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="name">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      placeholder="Enter name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="app-form-input"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="email">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        placeholder="Enter email"
                        value={form.email}
                        onChange={handleChange}
                        type="email"
                        className="app-form-input"
                      />
                    </div>
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="mobileNumber">
                        Phone Number
                      </label>
                      <input
                        id="mobileNumber"
                        name="mobileNumber"
                        placeholder="Enter phone number"
                        value={form.mobileNumber}
                        onChange={handleChange}
                        required
                        className="app-form-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Credentials</p>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      placeholder="Create password"
                      value={form.password}
                      onChange={handleChange}
                      type="password"
                      className="app-form-input"
                    />
                  </div>
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Academic access</p>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label">Classes</label>
                    <MultiSelectChecklist
                      items={initialClasses.map((classItem) => ({
                        id: classItem._id,
                        label: classItem.name,
                      }))}
                      selectedIds={form.classIds}
                      onChange={(ids) => updateSelection("classIds", ids)}
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
                        Access to all sections in selected classes
                      </span>
                    </span>
                  </label>

                  {!form.hasAllSections ? (
                    <div className="app-field-group">
                      <label className="app-field-label">Sections</label>
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
                      />
                    </div>
                  ) : null}

                  <div className="app-field-group">
                    <label className="app-field-label">Subjects</label>
                    <MultiSelectChecklist
                      items={initialSubjects.map((subject) => ({
                        id: subject._id,
                        label: subject.name,
                      }))}
                      selectedIds={form.subjectIds}
                      onChange={(ids) => updateSelection("subjectIds", ids)}
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="app-button-primary w-full">
                  {loading ? "Creating..." : "Create Teacher"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="app-editor-aside">
          <BulkUploadPanel
            title="Bulk Upload Teachers"
            description="Upload a CSV or Excel sheet using the teacher template to create multiple scoped teacher accounts at once."
            inputId="bulk-upload-teachers"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            loading={bulkLoading}
            loadingLabel="Uploading teachers..."
            feedback={bulkFeedback}
            tips={WORKSPACE_USER_BULK_TEMPLATES.teacher.tips}
          />
        </div>
      </div>
    </div>
  );
}
