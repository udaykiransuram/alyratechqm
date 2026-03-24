"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { fetchApiJson } from "@/lib/client/api";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
} from "@/lib/workspace/support-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SectionState from "@/components/ui/section-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ManageSectionsClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSections: WorkspaceAcademicSectionItem[];
  initialError?: string | null;
};

function getSectionClass(section: WorkspaceAcademicSectionItem) {
  return typeof section.class === "string"
    ? { _id: section.class, name: section.class }
    : section.class;
}

function sortSectionsByName(items: WorkspaceAcademicSectionItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export default function ManageSectionsClient({
  initialClasses,
  initialSections,
  initialError = null,
}: ManageSectionsClientProps) {
  const { toast } = useToast();
  const [classes] = useState<WorkspaceClassItem[]>(initialClasses);
  const [sections, setSections] = useState<WorkspaceAcademicSectionItem[]>(
    sortSectionsByName(initialSections),
  );
  const [newSectionName, setNewSectionName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sectionFilterClassId, setSectionFilterClassId] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingSectionId, setArchivingSectionId] = useState<string | null>(null);
  const [error] = useState<string | null>(initialError);

  const selectedClass = useMemo(
    () => classes.find((classItem) => classItem._id === selectedClassId),
    [classes, selectedClassId],
  );

  const selectedClassSections = useMemo(() => {
    if (!selectedClassId) return [] as WorkspaceAcademicSectionItem[];
    return sections.filter(
      (section) => getSectionClass(section)?._id === selectedClassId,
    );
  }, [sections, selectedClassId]);

  const filteredSections = useMemo(() => {
    if (!sectionFilterClassId || sectionFilterClassId === "all") {
      return sections;
    }
    return sections.filter(
      (section) => getSectionClass(section)?._id === sectionFilterClassId,
    );
  }, [sections, sectionFilterClassId]);

  const handleCreateSection = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedClassId) {
      toast({
        title: "Validation Error",
        description: "Select a class first.",
        variant: "destructive",
      });
      return;
    }
    if (!newSectionName.trim()) {
      toast({
        title: "Validation Error",
        description: "Section name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await fetchApiJson<any>("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSectionName, classId: selectedClassId }),
        fallbackMessage: "Failed to create section.",
      });

      const nextSection: WorkspaceAcademicSectionItem = {
        _id: String(data.section?._id || ""),
        name: String(data.section?.name || newSectionName).trim(),
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
                name:
                  String(data.section.class?.name || selectedClass?.name || "").trim() ||
                  "Class",
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
      setNewSectionName("");
      toast({
        title: "Success",
        description: `Section "${nextSection.name}" created.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to create section.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveSection = async (sectionId: string) => {
    setArchivingSectionId(sectionId);
    try {
      await fetchApiJson(`/api/sections/${sectionId}`, {
        method: "DELETE",
        fallbackMessage: "Failed to archive section.",
      });

      setSections((currentSections) =>
        currentSections.filter((section) => section._id !== sectionId),
      );
      toast({
        title: "Success",
        description: "Section archived successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to archive section.",
        variant: "destructive",
      });
    } finally {
      setArchivingSectionId((currentId) =>
        currentId === sectionId ? null : currentId,
      );
    }
  };

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        eyebrow="Academic Setup"
        title="Manage Sections"
        description="Create and review sections under each class so student placement, paper targeting, and reports stay aligned."
        meta={
          <>
            <span className="app-meta-chip">Class-linked sections</span>
            <span className="app-meta-chip">Filtering built in</span>
          </>
        }
        stats={[
          {
            label: "Classes available",
            value: String(classes.length),
            meta: "Classes that can receive sections in this school workspace.",
          },
          {
            label: "Sections tracked",
            value: String(sections.length),
            meta: "Active and inactive sections currently loaded.",
          },
          {
            label: "Filter scope",
            value:
              sectionFilterClassId === "all"
                ? "All classes"
                : classes.find((classItem) => classItem._id === sectionFilterClassId)
                    ?.name || "Filtered",
            meta: "Current list scope for reviewing section records.",
          },
          {
            label: "Create status",
            value: error
              ? "Needs review"
              : isSubmitting
                ? "Saving"
                : archivingSectionId
                  ? "Archiving"
                  : "Ready",
            meta: error
              ? "Review the initial section load before making more changes."
              : "Add and archive sections directly from this page.",
          },
        ]}
      />

      <div className="space-y-6">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Create New Section</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            {classes.length === 0 ? (
              <SectionState
                variant="info"
                title="Create a class first"
                description="Sections belong to classes. Add at least one class before creating section records."
              />
            ) : (
              <>
                <form
                  onSubmit={handleCreateSection}
                  className="grid gap-3 md:grid-cols-[220px_1fr_auto]"
                >
                  <Select
                    value={selectedClassId}
                    onValueChange={(value) => {
                      setSelectedClassId(value);
                      setSectionFilterClassId(value || "all");
                    }}
                    disabled={isSubmitting || Boolean(archivingSectionId)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((classItem) => (
                        <SelectItem key={classItem._id} value={classItem._id}>
                          {classItem.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="e.g., A"
                    value={newSectionName}
                    onChange={(event) => setNewSectionName(event.target.value)}
                    disabled={isSubmitting || Boolean(archivingSectionId)}
                  />
                  <Button
                    type="submit"
                    disabled={isSubmitting || Boolean(archivingSectionId)}
                    className="w-[160px]"
                  >
                    {isSubmitting ? <Spinner /> : "Create Section"}
                  </Button>
                </form>

                {selectedClassId ? (
                  <div className="mt-4 rounded-xl border border-border/60 bg-muted/10 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Existing sections in {selectedClass?.name || "selected class"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Review current sections here before creating a new one.
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {selectedClassSections.length} section
                        {selectedClassSections.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {selectedClassSections.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedClassSections.map((section) => (
                          <Badge key={section._id} variant="secondary">
                            {section.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        No sections exist for this class yet.
                      </p>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Existing Sections</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            {error ? (
              <SectionState
                variant="error"
                title="Section data needs attention"
                description={error}
              />
            ) : (
              <>
                <div className="app-filter-summary mb-4">
                  <div className="app-filter-summary-copy">
                    <p className="app-filter-summary-title">Current scope</p>
                    <p className="app-filter-summary-note">
                      {sectionFilterClassId !== "all"
                        ? "Showing sections only for the selected class."
                        : "Showing sections across all classes."}
                    </p>
                  </div>
                  <div className="app-filter-summary-actions">
                    <div className="w-full sm:w-[260px]">
                      <Select
                        value={sectionFilterClassId}
                        onValueChange={setSectionFilterClassId}
                        disabled={isSubmitting || Boolean(archivingSectionId)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Filter by class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Classes</SelectItem>
                          {classes.map((classItem) => (
                            <SelectItem key={classItem._id} value={classItem._id}>
                              {classItem.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {filteredSections.length === 0 ? (
                  <SectionState
                    title={
                      sectionFilterClassId === "all"
                        ? "No sections yet"
                        : "No sections for this class"
                    }
                    description={
                      sectionFilterClassId === "all"
                        ? "Create your first section above to organize students, targeting, and reports."
                        : "Switch the filter or create the first section for the selected class."
                    }
                    action={
                      sectionFilterClassId !== "all" ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSectionFilterClassId("all")}
                          disabled={isSubmitting || Boolean(archivingSectionId)}
                        >
                          Show All Classes
                        </Button>
                      ) : null
                    }
                  />
                ) : (
                  <div className="app-table-wrap">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Section</TableHead>
                          <TableHead>Class</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSections.map((section) => (
                          <TableRow key={section._id}>
                            <TableCell className="font-medium">{section.name}</TableCell>
                            <TableCell>{getSectionClass(section)?.name || "-"}</TableCell>
                            <TableCell>
                              {section.isActive === false ? "Inactive" : "Active"}
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={isSubmitting || Boolean(archivingSectionId)}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Archive section?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will archive the section
                                      <strong className="mx-1">
                                        &ldquo;{section.name}&rdquo;
                                      </strong>
                                      .
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={Boolean(archivingSectionId)}>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleArchiveSection(section._id)}
                                      disabled={Boolean(archivingSectionId)}
                                    >
                                      {archivingSectionId === section._id ? (
                                        <Spinner />
                                      ) : (
                                        "Archive"
                                      )}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
