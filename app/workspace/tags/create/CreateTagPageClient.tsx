"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, PlusCircle } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import { CreateTagTypeModal } from "@/components/CreateTagTypeModal";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableMultiSelectPopover } from "@/components/ui/searchable-multi-select-popover";
import { type SearchableCommandOption } from "@/components/ui/searchable-command-select";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import type {
  WorkspaceSubjectItem,
  WorkspaceTagItem,
  WorkspaceTagTypeItem,
} from "@/lib/workspace/support-types";

type CreateTagPageClientProps = {
  initialTagTypes: WorkspaceTagTypeItem[];
  initialSubjects: WorkspaceSubjectItem[];
  initialMessage?: string | null;
};

export default function CreateTagPageClient({
  initialTagTypes,
  initialSubjects,
  initialMessage = null,
}: CreateTagPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/tags");
  const [newTagName, setNewTagName] = useState("");
  const [selectedTagTypeId, setSelectedTagTypeId] = useState("");
  const [tagTypes, setTagTypes] = useState<WorkspaceTagTypeItem[]>(initialTagTypes);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allSubjects] = useState<WorkspaceSubjectItem[]>(initialSubjects);
  const [selectedSubjects, setSelectedSubjects] = useState<WorkspaceSubjectItem[]>([]);
  const [message, setMessage] = useState<string | null>(initialMessage);

  const { toast } = useToast();

  const handleCreateNewTag = useCallback(
    async (
      tagName: string,
      typeId: string,
      subjectIds: string[],
    ): Promise<WorkspaceTagItem | null> => {
      try {
        const schoolKey = resolveClientSchoolKey();
        if (!schoolKey) {
          throw new Error("Please select a school in the navbar first.");
        }

        const payload = { name: tagName, type: typeId, subjectIds };
        const data = await fetchApiJson<any>("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          schoolKey,
          fallbackMessage: "Failed to create tag.",
        });
        toast({
          title: "Tag Created",
          description: `"${data.tag.name}" (Type: ${data.tag.type.name}) has been added.`,
        });
        return data.tag;
      } catch (err: any) {
        toast({
          title: "Network Error",
          description: err?.message || "Failed to create tag.",
          variant: "destructive",
        });
        return null;
      }
    },
    [toast],
  );

  const handleSelectedSubjectIdsChange = useCallback(
    (nextSubjectIds: string[]) => {
      const subjectMap = new Map(allSubjects.map((subject) => [subject._id, subject]));
      setSelectedSubjects(
        nextSubjectIds
          .map((subjectId) => subjectMap.get(subjectId))
          .filter((subject): subject is WorkspaceSubjectItem => Boolean(subject)),
      );
    },
    [allSubjects],
  );

  const handleCreateAndAssignTag = async () => {
    if (!newTagName.trim() || !selectedTagTypeId) {
      toast({
        title: "Validation Error",
        description: "Tag Name and Type are required.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingTag(true);
    setMessage(null);
    try {
      const createdTag = await handleCreateNewTag(
        newTagName,
        selectedTagTypeId,
        selectedSubjects.map((subject) => subject._id),
      );

      if (!createdTag) {
        return;
      }

      if (selectedSubjects.length > 0) {
        let successCount = 0;
        let failCount = 0;

        const schoolKey = resolveClientSchoolKey();
        if (!schoolKey) {
          throw new Error("Please select a school in the navbar first.");
        }

        const currentSubjectsData = await fetchApiJson<any>("/api/subjects", {
          cache: "no-store",
          schoolKey,
          fallbackMessage:
            "Could not fetch current subject data to assign tag. Please try again.",
        });
        const currentSubjects = Array.isArray(currentSubjectsData.subjects)
          ? (currentSubjectsData.subjects as WorkspaceSubjectItem[])
          : [];

        for (const selectedSubject of selectedSubjects) {
          const currentSubject = currentSubjects.find((subject) => subject._id === selectedSubject._id);
          if (!currentSubject) {
            failCount++;
            continue;
          }

          const currentTagIds = (currentSubject.tags || []).map((tag) => tag._id);
          const updatedTagIds = currentTagIds.includes(createdTag._id)
            ? currentTagIds
            : [...currentTagIds, createdTag._id];

          try {
            await fetchApiJson(`/api/subjects/${currentSubject._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tags: updatedTagIds }),
              schoolKey,
              fallbackMessage: "Failed to assign tag to subject.",
            });
            successCount++;
          } catch {
            failCount++;
          }
        }

        if (successCount > 0) {
          setMessage(
            `${successCount} subject(s) were successfully updated with "${createdTag.name}". ${failCount > 0 ? `${failCount} failed.` : ""}`,
          );
          toast({
            title: "Tag Assignment Complete",
            description: `${successCount} subject(s) were successfully updated with "${createdTag.name}". ${failCount > 0 ? `${failCount} failed.` : ""}`,
          });
        } else if (failCount > 0) {
          setMessage(`Tag "${createdTag.name}" could not be assigned to any selected subjects.`);
          toast({
            title: "Assignment Failed",
            description: `Tag "${createdTag.name}" could not be assigned to any selected subjects.`,
            variant: "destructive",
          });
        }
      } else {
        setMessage(`Tag "${createdTag.name}" created successfully.`);
        toast({
          title: "Tag Created",
          description: `Tag "${createdTag.name}" created successfully (no subjects were assigned).`,
        });
      }
    } catch (error: any) {
      setMessage(error?.message || "An unexpected error occurred.");
      toast({
        title: "Operation Failed",
        description: error?.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingTag(false);
      setNewTagName("");
      setSelectedTagTypeId("");
      setSelectedSubjects([]);
    }
  };

  const subjectOptions: SearchableCommandOption[] = useMemo(
    () =>
      allSubjects.map((subject) => ({
        value: subject._id,
        label: subject.name,
      })),
    [allSubjects],
  );

  const messageClassName =
    message?.toLowerCase().includes("error") || message?.toLowerCase().includes("failed")
      ? "app-feedback app-feedback-error"
      : "app-feedback app-feedback-success";

  return (
    <>
      <CreateTagTypeModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTagTypeCreated={(newTagType) => {
          setTagTypes((currentTagTypes) =>
            [...currentTagTypes, newTagType].sort((a, b) => a.name.localeCompare(b.name)),
          );
          setSelectedTagTypeId(newTagType._id);
        }}
      />

      <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Curriculum"
          title="Create Tag"
          description="Define a reusable tag, choose its type, and optionally connect it to existing subjects right away."
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={navigateBack}
              disabled={isCreatingTag}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Tags
            </Button>
          }
          meta={
            <>
              <span className="app-meta-chip">Reusable label</span>
              <span className="app-meta-chip">Subject-linked setup</span>
            </>
          }
          stats={[
            {
              label: "Tag types",
              value: String(tagTypes.length),
              meta: "Tag types are already loaded when the page opens.",
            },
            {
              label: "Selected subjects",
              value: String(selectedSubjects.length),
              meta: "Associations here keep subject metadata and tag usage aligned.",
            },
          ]}
        />

        {message ? <div className={messageClassName}>{message}</div> : null}

        <div className="app-editor-grid">
          <div className="app-editor-main">
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Tag Details</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-5">
                <div className="space-y-4">
                  <div className="app-field-group">
                    <Label htmlFor="tagName" className="app-field-label">
                      Tag Name
                    </Label>
                    <Input
                      id="tagName"
                      placeholder="e.g., Algebra, Beginner, Art History"
                      value={newTagName}
                      onChange={(event) => setNewTagName(event.target.value)}
                      aria-label="Tag Name"
                      required
                      disabled={isCreatingTag}
                    />
                  </div>

                  <div className="app-field-group">
                    <Label htmlFor="tagTypeSelect" className="app-field-label">
                      Tag Type
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        onValueChange={setSelectedTagTypeId}
                        value={selectedTagTypeId}
                        disabled={isCreatingTag}
                      >
                        <SelectTrigger id="tagTypeSelect" className="h-10 w-full">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                        <SelectContent>
                          {tagTypes.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No tag types available yet.
                            </div>
                          ) : null}
                          {tagTypes.map((type) => (
                            <SelectItem key={type._id} value={type._id} className="capitalize">
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setIsModalOpen(true)}
                        disabled={isCreatingTag}
                        className="h-10 w-10 flex-shrink-0"
                      >
                        <PlusCircle className="h-4 w-4" />
                        <span className="sr-only">Create new tag type</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">Assign To Subjects</h3>
                    <p className="text-sm text-muted-foreground">
                      Select subjects this new tag should be associated with. Existing tags will be preserved.
                    </p>
                  </div>

                  <SearchableMultiSelectPopover
                    selectedValues={selectedSubjects.map((subject) => subject._id)}
                    options={subjectOptions}
                    onSelectedValuesChange={handleSelectedSubjectIdsChange}
                    placeholder="Select subjects..."
                    searchPlaceholder="Search subjects..."
                    emptyText="No results found."
                    loading={false}
                    loadingText="Loading subjects..."
                    noOptionsText="No subjects available in this school yet."
                    disabled={isCreatingTag}
                    closeOnSelect
                  />
                </div>

                <Separator />

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    onClick={navigateBack}
                    variant="outline"
                    disabled={isCreatingTag}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAndAssignTag}
                    disabled={isCreatingTag || !newTagName.trim() || !selectedTagTypeId}
                  >
                    {isCreatingTag ? <div className="mr-2"><Spinner /></div> : null}
                    Create Tag
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
