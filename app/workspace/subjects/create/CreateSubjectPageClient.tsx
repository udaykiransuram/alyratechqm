"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { MultiSelectTags, type TagItem, type TagType } from "@/components/ui/multi-select-tags";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { fetchApiJson } from "@/lib/client/api";
import { announceNavigationStart } from "@/lib/client/navigation-feedback";

type CreateSubjectPageClientProps = {
  initialAvailableTags: TagItem[];
  initialTagTypes: TagType[];
  initialMessage?: string | null;
  initialMessageVariant?: FeedbackNoticeVariant;
};

export default function CreateSubjectPageClient({
  initialAvailableTags,
  initialTagTypes,
  initialMessage = null,
  initialMessageVariant = "info",
}: CreateSubjectPageClientProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [allAvailableTags, setAllAvailableTags] = useState<TagItem[]>(initialAvailableTags);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [messageVariant, setMessageVariant] =
    useState<FeedbackNoticeVariant>(initialMessageVariant);

  const { toast } = useToast();
  const router = useRouter();

  const handleBackNavigation = useCallback(() => {
    announceNavigationStart("/workspace/subjects");
    router.push("/workspace/subjects");
  }, [router]);

  const handleCreateNewTag = useCallback(
    async (tagName: string, tagType: string): Promise<TagItem | null> => {
      try {
        const data = await fetchApiJson<{ tag: TagItem }>("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tagName, type: tagType }),
          fallbackMessage: `Could not create tag "${tagName}".`,
        });

        toast({
          title: "Tag Created",
          description: `"${data.tag.name}" (${data.tag.type.name}) added.`,
        });
        setAllAvailableTags((currentTags) => {
          if (!currentTags.some((tag) => tag._id === data.tag._id)) {
            return [...currentTags, data.tag];
          }
          return currentTags;
        });
        return data.tag;
      } catch (error: any) {
        toast({
          title: "Creation Failed",
          description: error?.message || `Could not create tag "${tagName}".`,
          variant: "destructive",
        });
        return null;
      }
    },
    [toast],
  );

  const createSubject = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingSubject(true);
    setMessage(null);

    const payload = {
      name: name.trim(),
      code: code.trim() === "" ? null : code.trim(),
      description: description.trim() === "" ? null : description.trim(),
      tags: selectedTags.map((tag) => tag._id),
    };

    try {
      await fetchApiJson("/api/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        fallbackMessage: "Failed to create subject.",
      });

      setName("");
      setCode("");
      setDescription("");
      setSelectedTags([]);
      setMessage("Subject created successfully. Redirecting to the subject library.");
      setMessageVariant("success");
      toast({
        title: "Success",
        description: "Subject created successfully. Redirecting…",
      });
      announceNavigationStart("/workspace/subjects");
      router.push("/workspace/subjects");
    } catch (error: any) {
      setMessage(error?.message || "Failed to create subject.");
      setMessageVariant("error");
      toast({
        title: "Error",
        description: error?.message || "Network error when creating subject.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSubject(false);
    }
  };

  return (
    <PageShell width="narrow">
      <PageHero
        eyebrow="Curriculum"
        title="Create Subject"
        description="Add a new subject with an optional code, short description, and linked tags so question authoring stays consistent."
        actions={
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleBackNavigation}
            disabled={isCreatingSubject}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Subjects
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Tag-ready</span>
            <span className="app-meta-chip">Subject-first setup</span>
            <span className="app-meta-chip">Inline tag creation</span>
          </>
        }
        stats={[
          {
            label: "Available tags",
            value: String(allAvailableTags.length),
            meta: "Existing tags are already loaded when the page opens.",
          },
          {
            label: "Selected tags",
            value: String(selectedTags.length),
            meta: "Linked tags help question filtering and downstream paper assembly.",
          },
          {
            label: "Create status",
            value: isCreatingSubject ? "Saving" : "Ready",
            meta: "Create a subject and connect it to tags without leaving this screen.",
          },
        ]}
      />

      {message ? (
        <FeedbackNotice variant={messageVariant}>{message}</FeedbackNotice>
      ) : null}

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Subject Details</CardTitle>
            </CardHeader>

            <CardContent className="app-section-body space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="app-field-group">
                  <Label htmlFor="subjectName" className="app-field-label">
                    Subject Name
                  </Label>
                  <Input
                    id="subjectName"
                    placeholder="e.g., Mathematics"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    aria-label="Subject Name"
                    required
                    disabled={isCreatingSubject}
                  />
                </div>

                <div className="app-field-group">
                  <Label htmlFor="subjectCode" className="app-field-label">
                    Subject Code
                  </Label>
                  <Input
                    id="subjectCode"
                    placeholder="e.g., MATH101"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    aria-label="Subject Code"
                    disabled={isCreatingSubject}
                  />
                </div>
              </div>

              <div className="app-field-group">
                <Label htmlFor="subjectDescription" className="app-field-label">
                  Description
                </Label>
                <Textarea
                  id="subjectDescription"
                  placeholder="Provide a brief description of the subject."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-[120px]"
                  aria-label="Subject Description"
                  disabled={isCreatingSubject}
                />
              </div>

              <div className="app-section space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="tag-select" className="app-field-label">
                    Associated Tags
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Categorize the subject with existing tags, or create a new one inline.
                  </p>
                </div>

                <MultiSelectTags
                  selectedTags={selectedTags}
                  allTags={allAvailableTags}
                  onSelectedTagsChange={setSelectedTags}
                  onCreateNewTag={handleCreateNewTag}
                  availableTagTypes={initialTagTypes}
                  isLoading={isCreatingSubject}
                  disabled={isCreatingSubject}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-[140px]"
                  onClick={handleBackNavigation}
                  disabled={isCreatingSubject}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="sm:min-w-[160px]"
                  onClick={createSubject}
                  disabled={isCreatingSubject || !name.trim()}
                >
                  {isCreatingSubject ? <Spinner /> : "Create Subject"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
