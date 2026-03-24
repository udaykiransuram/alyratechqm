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

type CreateAdminPageClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSections: WorkspaceAcademicSectionItem[];
  initialSubjects: WorkspaceSubjectItem[];
  initialMessage?: string | null;
};

export default function CreateAdminPageClient({
  initialClasses,
  initialSections,
  initialSubjects,
  initialMessage = null,
}: CreateAdminPageClientProps) {
  const router = useRouter();
  const { navigateBack } = useBackNavigation("/workspace/admins");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    hasAllClasses: true,
    hasAllSections: true,
    hasAllSubjects: true,
    classIds: [] as string[],
    academicSectionIds: [] as string[],
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
    if (form.hasAllClasses) {
      return initialSections;
    }
    const selectedClassIds = new Set(form.classIds);
    return initialSections.filter((section) =>
      selectedClassIds.has(getSectionClassId(section)),
    );
  }, [form.classIds, form.hasAllClasses, initialSections]);

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

  const updateToggle = (
    field: "hasAllClasses" | "hasAllSections" | "hasAllSubjects",
    checked: boolean,
  ) => {
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
        if (currentForm.hasAllClasses) return true;
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

    const payload = {
      ...form,
      role: "admin",
      classIds: form.hasAllClasses ? [] : form.classIds,
      academicSectionIds: form.hasAllSections
        ? []
        : form.academicSectionIds.filter((sectionId) => availableSectionIds.has(sectionId)),
      subjectIds: form.hasAllSubjects ? [] : form.subjectIds,
    };

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      await fetchApiJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        schoolKey,
        fallbackMessage: "We couldn't create the admin account.",
      });

      setMessage({
        message: "Admin account created.",
        variant: "success",
      });
      setForm({
        name: "",
        email: "",
        password: "",
        mobileNumber: "",
        hasAllClasses: true,
        hasAllSections: true,
        hasAllSubjects: true,
        classIds: [],
        academicSectionIds: [],
        subjectIds: [],
      });
      announceNavigationStart("/workspace/manage/users");
      router.push("/workspace/manage/users");
    } catch (error: any) {
      setMessage({
        message: error?.message || "We couldn't create the admin account.",
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
        role: "admin",
        rows,
        classes: initialClasses,
        sections: initialSections,
        subjects: initialSubjects,
      });

      if (users.length === 0) {
        throw new Error(skippedRows[0] || "No valid admin rows were found in the uploaded file.");
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
    const template = WORKSPACE_USER_BULK_TEMPLATES.admin;
    downloadCsvTemplate(template.filename, template.headers, template.sampleRows);
  };

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Create Admin"
        description="Create a school-admin account and decide whether it should keep full-school access or operate within a restricted scope."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admins
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">School admin access</span>
            <span className="app-meta-chip">Full or restricted scope</span>
          </>
        }
        stats={[
          {
            label: "Class scope",
            value: form.hasAllClasses ? "All" : String(form.classIds.length),
            meta: form.hasAllClasses
              ? "Admin will see every class."
              : "Admin is limited to the selected classes.",
          },
          {
            label: "Section scope",
            value: form.hasAllSections ? "All" : String(form.academicSectionIds.length),
            meta: form.hasAllSections
              ? "Section access is broad inside the allowed class scope."
              : "Only selected sections are enabled.",
          },
          {
            label: "Subject scope",
            value: form.hasAllSubjects ? "All" : String(form.subjectIds.length),
            meta: form.hasAllSubjects
              ? "Admin will see every subject."
              : "Only selected subjects are enabled.",
          },
          {
            label: "Form state",
            value: loading ? "Saving" : "Ready",
            meta: "This page now opens with server-loaded scope data.",
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
              <CardTitle>Admin Profile</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleSubmit} className="space-y-5">
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

                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={form.hasAllClasses}
                      onCheckedChange={(checked) =>
                        updateToggle("hasAllClasses", checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>All Classes</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={form.hasAllSections}
                      onCheckedChange={(checked) =>
                        updateToggle("hasAllSections", checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>All Sections</span>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
                    <Checkbox
                      checked={form.hasAllSubjects}
                      onCheckedChange={(checked) =>
                        updateToggle("hasAllSubjects", checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>All Subjects</span>
                  </label>
                </div>

                {!form.hasAllClasses ? (
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
                ) : null}

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
                      emptyContent={
                        form.hasAllClasses
                          ? "No sections have been created yet."
                          : "Select one or more classes to choose sections."
                      }
                    />
                  </div>
                ) : null}

                {!form.hasAllSubjects ? (
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
                ) : null}

                <button type="submit" disabled={loading} className="app-button-primary w-full">
                  {loading ? "Saving..." : "Create Admin"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="app-editor-aside">
          <BulkUploadPanel
            title="Bulk Upload Admins"
            description="Upload a CSV or Excel sheet using the admin template to create multiple admin accounts with full or restricted scope."
            inputId="bulk-upload-admins"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            loading={bulkLoading}
            loadingLabel="Uploading admins..."
            feedback={bulkFeedback}
            tips={WORKSPACE_USER_BULK_TEMPLATES.admin.tips}
          />
        </div>
      </div>
    </div>
  );
}
