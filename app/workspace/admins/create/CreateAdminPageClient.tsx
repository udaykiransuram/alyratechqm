"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import MultiSelectChecklist from "@/components/multi-select-checklist";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import {
  WorkspaceCreateModeToggle,
  type WorkspaceCreateMode,
} from "@/components/workspace/WorkspaceCreateGuideCard";
import WorkspaceCreateShell from "@/components/workspace/WorkspaceCreateShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { announceNavigationStart } from "@/lib/client/navigation-feedback";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import { downloadCsvTemplate, parseUploadFile } from "@/lib/client/bulk-upload";
import {
  buildWorkspaceBulkStructureSummary,
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
  const [createMode, setCreateMode] = useState<WorkspaceCreateMode>("single");

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
    <WorkspaceCreateShell
      eyebrow="People"
      title="Create Admin"
      description="Create one admin or switch to bulk upload."
      backLabel="Back to Admins"
      onBack={navigateBack}
      mainClassName="space-y-4"
      badges={
        <>
          <span className="app-meta-chip">School admin access</span>
          <span className="app-meta-chip">
            Class scope: {form.hasAllClasses ? "All" : form.classIds.length}
          </span>
          <span className="app-meta-chip">
            Subject scope: {form.hasAllSubjects ? "All" : form.subjectIds.length}
          </span>
        </>
      }
    >
      <WorkspaceCreateModeToggle
        value={createMode}
        onChange={setCreateMode}
        singleLabel="Single admin"
        bulkLabel="Bulk admins"
      />

      {message ? (
        <FeedbackNotice variant={message.variant}>{message.message}</FeedbackNotice>
      ) : null}

      {createMode === "single" ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header space-y-2.5">
            <CardTitle>Create Admin Account</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="app-section space-y-4">
                <p className="app-form-section-title">Identity and login</p>

                <div className="app-field-group">
                  <Label htmlFor="name">Admin name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Enter admin name"
                    value={form.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="app-field-group">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      placeholder="Enter email"
                      value={form.email}
                      onChange={handleChange}
                      type="email"
                    />
                  </div>

                  <div className="app-field-group">
                    <Label htmlFor="mobileNumber">Phone number</Label>
                    <Input
                      id="mobileNumber"
                      name="mobileNumber"
                      placeholder="Enter phone number"
                      value={form.mobileNumber}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    placeholder="Create password"
                    value={form.password}
                    onChange={handleChange}
                    type="password"
                  />
                </div>
              </div>

              <div className="app-section space-y-4">
                <p className="app-form-section-title">Academic access</p>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className={`app-toggle-card ${form.hasAllClasses ? "app-toggle-card-active" : ""}`}>
                    <Checkbox
                      checked={form.hasAllClasses}
                      onCheckedChange={(checked) =>
                        updateToggle("hasAllClasses", checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="app-toggle-card-copy">
                      <span className="app-toggle-card-title">All Classes</span>
                    </span>
                  </label>

                  <label className={`app-toggle-card ${form.hasAllSections ? "app-toggle-card-active" : ""}`}>
                    <Checkbox
                      checked={form.hasAllSections}
                      onCheckedChange={(checked) =>
                        updateToggle("hasAllSections", checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="app-toggle-card-copy">
                      <span className="app-toggle-card-title">All Sections</span>
                    </span>
                  </label>

                  <label className={`app-toggle-card ${form.hasAllSubjects ? "app-toggle-card-active" : ""}`}>
                    <Checkbox
                      checked={form.hasAllSubjects}
                      onCheckedChange={(checked) =>
                        updateToggle("hasAllSubjects", checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span className="app-toggle-card-copy">
                      <span className="app-toggle-card-title">All Subjects</span>
                    </span>
                  </label>
                </div>

                {!form.hasAllClasses ? (
                  <div className="app-field-group">
                    <Label>Classes</Label>
                    <MultiSelectChecklist
                      items={initialClasses.map((classItem) => ({
                        id: classItem._id,
                        label: classItem.name,
                      }))}
                      selectedIds={form.classIds}
                      onChange={(ids) => updateSelection("classIds", ids)}
                      className="p-2.5"
                      listClassName="max-h-44 p-2"
                      itemClassName="px-2.5 py-2"
                    />
                  </div>
                ) : null}

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
                      className="p-2.5"
                      listClassName="max-h-44 p-2"
                      itemClassName="px-2.5 py-2"
                      emptyContent={
                        form.hasAllClasses
                          ? "No sections created yet."
                          : "Select classes first."
                      }
                    />
                  </div>
                ) : null}

                {!form.hasAllSubjects ? (
                  <div className="app-field-group">
                    <Label>Subjects</Label>
                    <MultiSelectChecklist
                      items={initialSubjects.map((subject) => ({
                        id: subject._id,
                        label: subject.name,
                      }))}
                      selectedIds={form.subjectIds}
                      onChange={(ids) => updateSelection("subjectIds", ids)}
                      className="p-2.5"
                      listClassName="max-h-44 p-2"
                      itemClassName="px-2.5 py-2"
                    />
                  </div>
                ) : null}
              </div>

              <Button type="submit" size="xl" className="w-full" disabled={loading}>
                {loading ? "Saving..." : "Create Admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <BulkUploadPanel
          title="Bulk Upload Admins"
          inputId="bulk-upload-admins"
          onFileChange={handleBulkUpload}
          onDownloadTemplate={downloadTemplate}
          loading={bulkLoading}
          loadingLabel="Uploading admins..."
          compact
          feedback={bulkFeedback}
          tips={WORKSPACE_USER_BULK_TEMPLATES.admin.tips}
        />
      )}
    </WorkspaceCreateShell>
  );
}
