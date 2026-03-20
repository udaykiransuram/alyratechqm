"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import PageHero from "@/components/layout/PageHero";

interface ClassItem {
  _id: string;
  name: string;
}

interface AcademicSectionItem {
  _id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  class?: { _id: string; name: string } | string;
}

function getSectionClass(section: AcademicSectionItem) {
  return typeof section.class === "string"
    ? { _id: section.class, name: section.class }
    : section.class;
}

export default function ManageSectionsPage() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [newSectionName, setNewSectionName] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [sectionFilterClassId, setSectionFilterClassId] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [classRes, sectionRes] = await Promise.all([
        fetch("/api/classes"),
        fetch("/api/sections?includeInactive=true"),
      ]);
      const classData = await classRes.json();
      const sectionData = await sectionRes.json();
      if (!classData.success) throw new Error(classData.message || "Failed to load classes");
      if (!sectionData.success) throw new Error(sectionData.message || "Failed to load sections");
      setClasses(classData.classes || []);
      setSections(sectionData.sections || []);
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClass = useMemo(
    () => classes.find((classItem) => classItem._id === selectedClassId),
    [classes, selectedClassId],
  );

  const selectedClassSections = useMemo(() => {
    if (!selectedClassId) return [] as AcademicSectionItem[];
    return sections.filter(
      (section) => getSectionClass(section)?._id === selectedClassId,
    );
  }, [sections, selectedClassId]);

  const filteredSections = useMemo(() => {
    if (!sectionFilterClassId || sectionFilterClassId === "all") return sections;
    return sections.filter(
      (section) => getSectionClass(section)?._id === sectionFilterClassId,
    );
  }, [sections, sectionFilterClassId]);

  const handleCreateSection = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) {
      toast({ title: "Validation Error", description: "Select a class first.", variant: "destructive" });
      return;
    }
    if (!newSectionName.trim()) {
      toast({ title: "Validation Error", description: "Section name cannot be empty.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSectionName, classId: selectedClassId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      toast({ title: "Success", description: `Section \"${data.section.name}\" created.` });
      setNewSectionName("");
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveSection = async (sectionId: string) => {
    try {
      const res = await fetch(`/api/sections/${sectionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      toast({ title: "Success", description: "Section archived successfully." });
      setSections((prev) => prev.filter((section) => section._id !== sectionId));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-6 sm:px-0">
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
                : classes.find((classItem) => classItem._id === sectionFilterClassId)?.name || "Filtered",
            meta: "Current list scope for reviewing section records.",
          },
          {
            label: "Create status",
            value: isSubmitting ? "Saving" : "Ready",
            meta: "Add a new section directly from this page.",
          },
        ]}
      />

      <div className="space-y-6">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Create New Section</CardTitle>
            <CardDescription>Add a section under an existing class.</CardDescription>
          </CardHeader>
          <CardContent className="app-section-body">
            <form onSubmit={handleCreateSection} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSectionFilterClassId(value || "all");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((classItem) => (
                    <SelectItem key={classItem._id} value={classItem._id}>{classItem.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="e.g., A"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                disabled={isSubmitting}
              />
              <Button type="submit" disabled={isSubmitting} className="w-[160px]">
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
                    {selectedClassSections.length} section{selectedClassSections.length === 1 ? "" : "s"}
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
          </CardContent>
        </Card>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header">
            <CardTitle>Existing Sections</CardTitle>
            <CardDescription>Filter the section list by class to review only the relevant records.</CardDescription>
          </CardHeader>
          <CardContent className="app-section-body">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : error ? (
              <div className="app-feedback app-feedback-error">{error}</div>
            ) : (
              <>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {sectionFilterClassId !== "all"
                      ? "Showing sections only for the selected class."
                      : "Showing sections across all classes."}
                  </p>
                  <div className="w-full sm:w-[260px]">
                    <Select value={sectionFilterClassId} onValueChange={setSectionFilterClassId}>
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
                    {filteredSections.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                          {sectionFilterClassId === "all"
                            ? "No sections created yet."
                            : "No sections created for the selected class yet."}
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredSections.map((section) => (
                      <TableRow key={section._id}>
                        <TableCell className="font-medium">{section.name}</TableCell>
                        <TableCell>{getSectionClass(section)?.name || "-"}</TableCell>
                        <TableCell>{section.isActive === false ? "Inactive" : "Active"}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
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
                                  </strong>.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleArchiveSection(section._id)}>
                                  Archive
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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
