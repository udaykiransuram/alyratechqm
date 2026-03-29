"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { Trash2 } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";
import SectionState from "@/components/ui/section-state";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SearchableCommandSelect = dynamic(
  () =>
    import("@/components/ui/searchable-command-select").then(
      (module) => module.SearchableCommandSelect,
    ),
  {
    ssr: false,
    loading: () => <div className="h-11 rounded-xl border border-border/60 bg-muted/30" />,
  },
);

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
  const [sectionFilterClassId, setSectionFilterClassId] = useState("all");
  const [archivingSectionId, setArchivingSectionId] = useState<string | null>(null);
  const [error] = useState<string | null>(initialError);

  const filteredSections = useMemo(() => {
    if (!sectionFilterClassId || sectionFilterClassId === "all") {
      return sections;
    }

    return sections.filter(
      (section) => getSectionClass(section)?._id === sectionFilterClassId,
    );
  }, [sections, sectionFilterClassId]);
  const sectionClassOptions = useMemo<SearchableCommandOption[]>(
    () => [
      {
        value: "all",
        label: "All classes",
        description: "Review sections across every class in the school.",
      },
      ...classes.map((classItem) => ({
        value: classItem._id,
        label: classItem.name,
      })),
    ],
    [classes],
  );

  const handleArchiveSection = async (sectionId: string) => {
    setArchivingSectionId(sectionId);
    try {
      await fetchApiJson(`/api/sections/${sectionId}`, {
        method: "DELETE",
        fallbackMessage: "We couldn't archive this section.",
      });

      setSections((currentSections) =>
        currentSections.filter((section) => section._id !== sectionId),
      );
      toast({
        title: "Section archived",
        description: "The section has been archived.",
      });
    } catch (error: any) {
      toast({
        title: "Couldn't archive section",
        description: error?.message || "We couldn't archive this section.",
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
        variant="directory"
        eyebrow="Academic Setup"
        title="Manage Sections"
        description="Review and archive sections from the directory page, while moving section creation and bulk import into a dedicated setup route."
        actions={
          <Button asChild className="app-button-page">
            <AppPrefetchLink href="/workspace/manage/sections/create" prefetchOnMount>
              Create Sections
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Dedicated create page</span>
            <span className="app-meta-chip">Bulk upload available</span>
          </>
        }
        stats={[
          {
            label: "Classes available",
            value: String(classes.length),
            meta: "Classes that can receive sections in this school.",
          },
          {
            label: "Sections tracked",
            value: String(sections.length),
            meta: "Current active sections loaded into this directory.",
          },
          {
            label: "Filter scope",
            value:
              sectionFilterClassId === "all"
                ? "All classes"
                : classes.find((classItem) => classItem._id === sectionFilterClassId)?.name ||
                  "Filtered",
            meta: "Current scope for the section directory table.",
          },
          {
            label: "Directory mode",
            value: archivingSectionId ? "Archiving" : "List + Archive",
            meta: "Creation now lives in the dedicated create route.",
          },
        ]}
      />

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
                    <SearchableCommandSelect
                      value={sectionFilterClassId}
                      options={sectionClassOptions}
                      onValueChange={setSectionFilterClassId}
                      placeholder="Filter by class"
                      searchPlaceholder="Search classes..."
                      emptyText="No classes found."
                      onClear={() => setSectionFilterClassId("all")}
                      showCloseAction
                      disabled={Boolean(archivingSectionId)}
                    />
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
                      ? "Open the dedicated create page to add your first section or import sections in bulk."
                      : "Switch the filter or create the first section for the selected class."
                  }
                  action={
                    <Button asChild className="app-button-page">
                      <AppPrefetchLink href="/workspace/manage/sections/create">
                        Go to Create Sections
                      </AppPrefetchLink>
                    </Button>
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
                                  disabled={Boolean(archivingSectionId)}
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
                                    onClick={() => void handleArchiveSection(section._id)}
                                    disabled={Boolean(archivingSectionId)}
                                  >
                                    {archivingSectionId === section._id ? <Spinner /> : "Archive"}
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
    </PageShell>
  );
}
