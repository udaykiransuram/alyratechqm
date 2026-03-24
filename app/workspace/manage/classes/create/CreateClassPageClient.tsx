"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { ArrowLeft } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import {
  downloadCsvTemplate,
  getUploadCell,
  parseUploadFile,
} from "@/lib/client/bulk-upload";
import type { WorkspaceClassItem } from "@/lib/workspace/support-types";

type CreateClassPageClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSchoolKey?: string;
  initialMessage?: string | null;
};

function sortClassesByName(items: WorkspaceClassItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export default function CreateClassPageClient({
  initialClasses,
  initialSchoolKey,
  initialMessage = null,
}: CreateClassPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/manage/classes");

  const [classes, setClasses] = useState<WorkspaceClassItem[]>(
    sortClassesByName(initialClasses),
  );
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

  const recentClasses = useMemo(() => classes.slice(0, 8), [classes]);

  const handleCreateClass = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (!name.trim()) {
        throw new Error("Class name is required.");
      }

      const schoolKey = resolveClientSchoolKey(initialSchoolKey);
      const data = await fetchApiJson<any>("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || undefined,
        }),
        schoolKey,
        fallbackMessage: "We couldn't create this class.",
      });

      const nextClass: WorkspaceClassItem = {
        _id: String(data.class?._id || data.classId || ""),
        name: String(data.class?.name || name).trim(),
        description: data.class?.description
          ? String(data.class.description).trim()
          : undefined,
      };

      setClasses((currentClasses) =>
        sortClassesByName([
          ...currentClasses.filter((item) => item._id !== nextClass._id),
          nextClass,
        ]),
      );
      setName("");
      setDescription("");
      setFeedback({
        message: `Class "${nextClass.name}" created successfully.`,
        variant: "success",
      });
    } catch (error: any) {
      setFeedback({
        message: error?.message || "We couldn't create this class.",
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
          description: String(getUploadCell(row, "description") || "").trim() || undefined,
        }))
        .filter((row) => row.name);

      if (payload.length === 0) {
        throw new Error("No valid class rows were found in the uploaded file.");
      }

      const schoolKey = resolveClientSchoolKey(initialSchoolKey);
      const data = await fetchApiJson<any>("/api/classes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classes: payload }),
        schoolKey,
        fallbackMessage: "We couldn't complete the bulk class upload.",
      });

      const results = Array.isArray(data.results) ? data.results : [];
      const created = results.filter((result: any) => result.success && !result.existed && !result.restored);
      const restored = results.filter((result: any) => result.restored);
      const existing = results.filter((result: any) => result.existed);
      const failed = results.filter((result: any) => !result.success);

      const nextClasses: WorkspaceClassItem[] = results
        .filter((result: any) => result.success && result.class)
        .map((result: any) => ({
          _id: String(result.class?._id || ""),
          name: String(result.class?.name || "").trim(),
          description: result.class?.description
            ? String(result.class.description).trim()
            : undefined,
        }))
        .filter((classItem: WorkspaceClassItem) => classItem._id && classItem.name);

      if (nextClasses.length > 0) {
        setClasses((currentClasses) =>
          sortClassesByName([
            ...currentClasses.filter(
              (classItem) => !nextClasses.some((nextClass) => nextClass._id === classItem._id),
            ),
            ...nextClasses,
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
        message: error?.message || "We couldn't complete the bulk class upload.",
        variant: "error",
      });
    } finally {
      event.target.value = "";
      setIsBulkUploading(false);
    }
  };

  const downloadTemplate = () => {
    downloadCsvTemplate(
      "classes-bulk-template.csv",
      ["name", "description"],
      [["Grade 10", "Main academic class for tenth grade"]],
    );
  };

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        eyebrow="Academic Setup"
        title="Create Classes"
        description="Add one class at a time or import a whole class list from a spreadsheet."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Classes
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Dedicated create route</span>
            <span className="app-meta-chip">Bulk upload available</span>
          </>
        }
        stats={[
          {
            label: "Classes tracked",
            value: String(classes.length),
            meta: "Current active class records already loaded for review.",
          },
          {
            label: "Single create",
            value: isSubmitting ? "Saving" : "Ready",
            meta: "Add one class from the form on this page.",
          },
          {
            label: "Bulk import",
            value: isBulkUploading ? "Uploading" : "Ready",
            meta: "Import multiple classes from CSV or Excel.",
          },
          {
            label: "Flow",
            value: "Create only",
            meta: "Review and archiving stay on the directory page.",
          },
        ]}
      />

      {feedback ? (
        <FeedbackNotice variant={feedback.variant}>{feedback.message}</FeedbackNotice>
      ) : null}

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Create Individual Class</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div className="app-field-group">
                  <Label htmlFor="class-name">Class Name</Label>
                  <Input
                    id="class-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g., Grade 10"
                    required
                  />
                </div>
                <div className="app-field-group">
                  <Label htmlFor="class-description">Description</Label>
                  <Input
                    id="class-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Create Class"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Current Class List</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              {recentClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No classes exist yet. The first one you create will appear here.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {recentClasses.map((classItem) => (
                    <span key={classItem._id} className="app-meta-chip">
                      {classItem.name}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="app-editor-aside">
          <BulkUploadPanel
            title="Bulk Upload Classes"
            description="Use the template to add many classes in one go. Existing archived classes are restored automatically."
            inputId="bulk-upload-classes"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            loading={isBulkUploading}
            loadingLabel="Uploading classes..."
            feedback={bulkFeedback}
            tips={[
              "Use one row per class.",
              "Archived classes with the same name are restored automatically.",
            ]}
          />
        </div>
      </div>
    </PageShell>
  );
}
