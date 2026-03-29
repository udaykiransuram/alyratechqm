"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

import MultiSelectChecklist from "@/components/multi-select-checklist";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import {
  WorkspaceCreateModeToggle,
  type WorkspaceCreateMode,
} from "@/components/workspace/WorkspaceCreateGuideCard";
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
  buildWorkspaceBulkStructureSummary,
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
  const [createMode, setCreateMode] = useState<WorkspaceCreateMode>("single");

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
      description="Create one teacher or switch to bulk upload."
      backLabel="Back to Teachers"
      onBack={navigateBack}
      mainClassName="space-y-4"
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
    >
      <WorkspaceCreateModeToggle
        value={createMode}
        onChange={setCreateMode}
        singleLabel="Single teacher"
        bulkLabel="Bulk teachers"
      />

      {message ? (
        <FeedbackNotice variant={message.variant}>{message.message}</FeedbackNotice>
      ) : null}

      {createMode === "single" ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header space-y-2.5">
            <CardTitle>Create Teacher Account</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="app-section space-y-4">
                <p className="app-form-section-title">Identity and contact</p>

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
                  </div>
                </div>
              </div>

              <div className="app-section space-y-4">
                <p className="app-form-section-title">Login setup</p>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
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
                  </div>

                  <div className="app-form-callout">
                    <p className="font-semibold text-foreground">Teacher access rule</p>
                    <p className="mt-1.5">
                      Assign only the classes and subjects this teacher actually handles.
                    </p>
                  </div>
                </div>
              </div>

              <div className="app-section space-y-4">
                <p className="app-form-section-title">Academic access</p>

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
                      className="p-2.5"
                      listClassName="max-h-44 p-2"
                      itemClassName="px-2.5 py-2"
                      emptyContent="Select classes first."
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
                    className="p-2.5"
                    listClassName="max-h-44 p-2"
                    itemClassName="px-2.5 py-2"
                  />
                </div>
              </div>

              <Button type="submit" size="xl" className="w-full" disabled={loading}>
                {loading ? "Creating..." : "Create Teacher Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <BulkUploadPanel
          title="Bulk upload teachers"
          inputId="bulk-upload-teachers"
          onFileChange={handleBulkUpload}
          onDownloadTemplate={downloadTemplate}
          templateLabel="Download Teacher Template"
          loading={bulkLoading}
          loadingLabel="Uploading teachers..."
          feedback={bulkFeedback}
          disabled={initialClasses.length === 0 || initialSubjects.length === 0}
          compact
          tips={WORKSPACE_USER_BULK_TEMPLATES.teacher.tips}
        />
      )}
    </WorkspaceCreateShell>
  );
}
