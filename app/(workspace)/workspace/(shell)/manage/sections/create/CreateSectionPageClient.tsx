"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { ArrowLeft } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import {
  WorkspaceCreateModeToggle,
  type WorkspaceCreateMode,
} from "@/components/workspace/WorkspaceCreateGuideCard";
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
  getUploadCell,
  parseUploadFile,
} from "@/lib/client/bulk-upload";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
} from "@/lib/workspace/support-types";

type CreateSectionPageClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSections: WorkspaceAcademicSectionItem[];
  initialSchoolKey?: string;
  initialMessage?: string | null;
};

function getSectionClass(section: WorkspaceAcademicSectionItem) {
  return typeof section.class === "string"
    ? { _id: section.class, name: section.class }
    : section.class;
}

function sortSectionsByName(items: WorkspaceAcademicSectionItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export default function CreateSectionPageClient({
  initialClasses,
  initialSections,
  initialSchoolKey,
  initialMessage = null,
}: CreateSectionPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/manage/sections");

  const [sections, setSections] = useState<WorkspaceAcademicSectionItem[]>(
    sortSectionsByName(initialSections),
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
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

  const selectedClass = useMemo(
    () => initialClasses.find((classItem) => classItem._id === selectedClassId),
    [initialClasses, selectedClassId],
  );

  const selectedClassSections = useMemo(() => {
    if (!selectedClassId) return [] as WorkspaceAcademicSectionItem[];
    return sections.filter((section) => getSectionClass(section)?._id === selectedClassId);
  }, [sections, selectedClassId]);

  const handleCreateSection = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (!selectedClassId) {
        throw new Error("Select a class first.");
      }

      if (!name.trim()) {
        throw new Error("Section name is required.");
      }

      const schoolKey = resolveClientSchoolKey(initialSchoolKey);
      const data = await fetchApiJson<any>("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          classId: selectedClassId,
          description: description.trim() || undefined,
        }),
        schoolKey,
        fallbackMessage: "We couldn't create this section.",
      });

      const nextSection: WorkspaceAcademicSectionItem = {
        _id: String(data.section?._id || ""),
        name: String(data.section?.name || name).trim(),
        description: data.section?.description
          ? String(data.section.description).trim()
          : undefined,
        isActive:
          typeof data.section?.isActive === "boolean"
            ? data.section.isActive
            : true,
        class:
          data.section?.class && typeof data.section.class === "object"
            ? {
                _id: String(data.section.class?._id || selectedClassId),
                name: String(data.section.class?.name || selectedClass?.name || "").trim() || "Class",
              }
            : {
                _id: selectedClassId,
                name: selectedClass?.name || "Class",
              },
      };

      setSections((currentSections) =>
        sortSectionsByName([
          ...currentSections.filter((section) => section._id !== nextSection._id),
          nextSection,
        ]),
      );
      setName("");
      setDescription("");
      setFeedback({
        message: `Section "${nextSection.name}" created successfully.`,
        variant: "success",
      });
    } catch (error: any) {
      setFeedback({
        message: error?.message || "We couldn't create this section.",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsBulkUploading(true);
    setBulkFeedback(null);

    try {
      const rows = await parseUploadFile(file);
      const payload = rows
        .map((row) => ({
          name: String(getUploadCell(row, "name") || "").trim(),
          class: String(
            getUploadCell(row, "class", "classname", "classid") || "",
          ).trim(),
          description: String(getUploadCell(row, "description") || "").trim() || undefined,
          isActive: String(getUploadCell(row, "isactive") || "").trim() || undefined,
        }))
        .filter((row) => row.name && row.class);

      if (payload.length === 0) {
        throw new Error("No valid section rows were found in the uploaded file.");
      }

      const schoolKey = resolveClientSchoolKey(initialSchoolKey);
      const data = await fetchApiJson<any>("/api/sections/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: payload }),
        schoolKey,
        fallbackMessage: "We couldn't complete the bulk section upload.",
      });

      const results = Array.isArray(data.results) ? data.results : [];
      const created = results.filter((result: any) => result.success && !result.existed && !result.restored);
      const restored = results.filter((result: any) => result.restored);
      const existing = results.filter((result: any) => result.existed);
      const failed = results.filter((result: any) => !result.success);

      const nextSections: WorkspaceAcademicSectionItem[] = results
        .filter((result: any) => result.success && result.section)
        .map((result: any) => ({
          _id: String(result.section?._id || ""),
          name: String(result.section?.name || "").trim(),
          description: result.section?.description
            ? String(result.section.description).trim()
            : undefined,
          isActive:
            typeof result.section?.isActive === "boolean"
              ? result.section.isActive
              : undefined,
          class:
            result.section?.class && typeof result.section.class === "object"
              ? {
                  _id: String(result.section.class?._id || ""),
                  name: String(result.section.class?.name || "").trim(),
                }
              : undefined,
        }))
        .filter((sectionItem: WorkspaceAcademicSectionItem) => sectionItem._id && sectionItem.name);

      if (nextSections.length > 0) {
        setSections((currentSections) =>
          sortSectionsByName([
            ...currentSections.filter(
              (section) => !nextSections.some((nextSection) => nextSection._id === section._id),
            ),
            ...nextSections,
          ]),
        );
      }

      setBulkFeedback({
        message: [
          "Bulk upload complete.",
          `Created: ${created.length}.`,
          `Restored: ${restored.length}.`,
          `Existing: ${existing.length}.`,
          `Failed: ${failed.length}.`,
        ].join(" "),
        variant:
          failed.length > 0
            ? created.length > 0 || restored.length > 0
              ? "warning"
              : "error"
            : "success",
      });
    } catch (error: any) {
      setBulkFeedback({
        message: error?.message || "We couldn't complete the bulk section upload.",
        variant: "error",
      });
    } finally {
      event.target.value = "";
      setIsBulkUploading(false);
    }
  };

  const downloadTemplate = () => {
    downloadCsvTemplate(
      "sections-bulk-template.csv",
      ["name", "class", "description", "isActive"],
      [["A", "Grade 10", "Main section for Grade 10", "true"]],
    );
  };

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        variant="editor"
        eyebrow="Academic Setup"
        title="Create Sections"
        description="Create one section or switch to bulk upload."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack} className="app-button-back">
            <ArrowLeft className="h-4 w-4" />
            Back to Sections
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Dedicated create route</span>
            <span className="app-meta-chip">{sections.length} sections</span>
          </>
        }
        stats={[
          {
            label: "Classes available",
            value: String(initialClasses.length),
            meta: "Available for mapping.",
          },
          {
            label: "Sections tracked",
            value: String(sections.length),
            meta: "Current active sections.",
          },
          {
            label: "Mode",
            value: createMode === "single" ? "Single" : "Bulk",
            meta: createMode === "single" ? "Manual form" : "CSV/Excel upload",
          },
        ]}
      />

      {feedback ? (
        <FeedbackNotice variant={feedback.variant}>{feedback.message}</FeedbackNotice>
      ) : null}

      <WorkspaceCreateModeToggle
        value={createMode}
        onChange={setCreateMode}
        singleLabel="Single section"
        bulkLabel="Bulk sections"
      />

      {createMode === "single" ? (
        <div className="space-y-4">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Create Section</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {initialClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Create a class first.
                </p>
              ) : (
                <form onSubmit={handleCreateSection} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="app-field-label">Class</Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger className="h-12 bg-[hsl(var(--app-surface-1))]">
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
                    <Label htmlFor="section-name" className="app-field-label">
                      Section Name
                    </Label>
                    <Input
                      id="section-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="e.g., A"
                      className="h-12"
                      required
                    />
                  </div>

                  <div className="app-field-group">
                    <Label htmlFor="section-description" className="app-field-label">
                      Description
                    </Label>
                    <Input
                      id="section-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Optional description"
                      className="h-12"
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Create Section"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>
                {selectedClass
                  ? `Existing Sections in ${selectedClass.name}`
                  : "Existing Sections"}
              </CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {!selectedClassId ? (
                <p className="text-sm text-muted-foreground">
                  Select a class to view sections.
                </p>
              ) : selectedClassSections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sections exist for this class yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedClassSections.map((section) => (
                    <span key={section._id} className="app-meta-chip">
                      {section.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <BulkUploadPanel
            title="Bulk Upload Sections"
            inputId="bulk-upload-sections"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            loading={isBulkUploading}
            loadingLabel="Uploading sections..."
            feedback={bulkFeedback}
            tips={[
              "Each row needs a section name and a class reference.",
              "The class column can use the class name or the class id.",
              "Archived matching sections are restored automatically.",
            ]}
          />
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Existing Sections</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {!selectedClassId ? (
                <p className="text-sm text-muted-foreground">Select a class to view sections.</p>
              ) : selectedClassSections.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sections exist for this class yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedClassSections.map((section) => (
                    <span key={section._id} className="app-meta-chip">
                      {section.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
