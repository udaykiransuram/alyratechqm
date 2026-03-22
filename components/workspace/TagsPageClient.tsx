"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPagination from "@/components/ui/list-pagination";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import type { WorkspaceTagItem } from "@/lib/workspace/support-types";

const INITIAL_TAG_BATCH_SIZE = 24;
const TAGS_PAGE_SIZE = INITIAL_TAG_BATCH_SIZE;

type FetchTagsOptions = {
  limit?: number;
  background?: boolean;
  suppressErrors?: boolean;
  signal?: AbortSignal;
};

type TagsPageClientProps = {
  initialTags: WorkspaceTagItem[];
  initialTotal: number;
  initialPartial: boolean;
  initialError?: string | null;
};

function sortTagsByName(items: WorkspaceTagItem[]) {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export default function TagsPageClient({
  initialTags,
  initialTotal,
  initialPartial,
  initialError = null,
}: TagsPageClientProps) {
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/tags");
  const [tags, setTags] = useState<WorkspaceTagItem[]>(sortTagsByName(initialTags));
  const [tagsLoading, setTagsLoading] = useState(false);
  const [backgroundLoading, setBackgroundLoading] = useState(initialPartial);
  const [totalTags, setTotalTags] = useState<number | null>(initialTotal);
  const [fetchError, setFetchError] = useState<string | null>(initialError);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [tagPage, setTagPage] = useState(1);
  const archivedTagIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchTagsWithSubjects = useCallback(
    async ({
      limit,
      background = false,
      suppressErrors = false,
      signal,
    }: FetchTagsOptions = {}) => {
      if (background) {
        setBackgroundLoading(true);
      } else {
        setTagsLoading(true);
        setBackgroundLoading(false);
        setFetchError(null);
      }

      try {
        const params = new URLSearchParams();
        if (limit) {
          params.set("limit", String(limit));
        }

        const endpoint =
          params.size > 0
            ? `/api/tags/with-subjects?${params.toString()}`
            : "/api/tags/with-subjects";

        const response = await fetch(endpoint, { signal });
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Failed to load tags.");
        }

        const visibleTags = (Array.isArray(data.tags) ? data.tags : []).filter(
          (tag: WorkspaceTagItem) => !archivedTagIdsRef.current.has(tag._id),
        );
        const sortedTags = sortTagsByName(visibleTags);
        setTags(sortedTags);
        setTotalTags(
          typeof data.total === "number" ? data.total : sortedTags.length,
        );
        return {
          success: true,
          partial: Boolean(data.partial),
        };
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return null;
        }
        const errorMessage =
          error?.message || "Could not fetch tags. Please check your connection.";
        if (!suppressErrors) {
          setFetchError(errorMessage);
          toast({
            title: "Network Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } finally {
        if (background) {
          setBackgroundLoading(false);
        } else {
          setTagsLoading(false);
        }
      }

      return null;
    },
    [toast],
  );

  const loadTagsProgressively = useCallback(
    async (signal?: AbortSignal) => {
      const initialResult = await fetchTagsWithSubjects({
        limit: INITIAL_TAG_BATCH_SIZE,
        signal,
      });

      if (!initialResult?.success || !initialResult.partial || signal?.aborted) {
        return;
      }

      void fetchTagsWithSubjects({
        background: true,
        suppressErrors: true,
        signal,
      });
    },
    [fetchTagsWithSubjects],
  );

  useEffect(() => {
    if (!initialPartial) {
      return;
    }

    const controller = new AbortController();
    void fetchTagsWithSubjects({
      background: true,
      suppressErrors: true,
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [fetchTagsWithSubjects, initialPartial]);

  const totalLoadedTagPages = useMemo(
    () => Math.max(1, Math.ceil(tags.length / TAGS_PAGE_SIZE)),
    [tags.length],
  );

  useEffect(() => {
    setTagPage((currentPage) => Math.min(currentPage, totalLoadedTagPages));
  }, [totalLoadedTagPages]);

  const visibleTags = useMemo(() => {
    const startIndex = (tagPage - 1) * TAGS_PAGE_SIZE;
    return tags.slice(startIndex, startIndex + TAGS_PAGE_SIZE);
  }, [tagPage, tags]);

  const visibleRangeStart = tags.length === 0 ? 0 : (tagPage - 1) * TAGS_PAGE_SIZE + 1;
  const visibleRangeEnd = Math.min(tags.length, tagPage * TAGS_PAGE_SIZE);

  const archiveTag = async (id: string) => {
    const isConfirmed = confirm(
      "Are you sure you want to archive this tag? This action cannot be undone.",
    );
    if (!isConfirmed) return;

    const originalTags = [...tags];
    archivedTagIdsRef.current.add(id);
    setDeletingTagId(id);
    setTags((currentTags) => currentTags.filter((tag) => tag._id !== id));
    setTotalTags((currentTotal) =>
      currentTotal === null ? currentTotal : Math.max(0, currentTotal - 1),
    );
    toast({
      title: "Archiving Tag...",
      description: "Your tag is being archived.",
    });

    try {
      const response = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Failed to archive tag.");
      }

      toast({
        title: "Tag Archived",
        description: "Successfully archived the tag.",
      });
    } catch (error: any) {
      archivedTagIdsRef.current.delete(id);
      setTags(originalTags);
      setTotalTags((currentTotal) =>
        currentTotal === null ? originalTags.length : currentTotal + 1,
      );
      toast({
        title: "Failed to Archive",
        description: error?.message || "Could not archive the tag. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingTagId((currentId) => (currentId === id ? null : currentId));
    }
  };

  return (
    <div className="app-page-shell max-w-7xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Curriculum"
        title="Tags"
        description="Browse, edit, and assign tags across subjects so question authoring and analytics stay aligned."
        actions={
          <Button asChild className="gap-2">
            <AppPrefetchLink
              href="/workspace/tags/create"
              prefetchOnMount
              relatedApiPrefetches={["/api/tag-types", "/api/subjects"]}
            >
              <Plus className="h-4 w-4" />
              Create Tag
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Cross-subject labels</span>
            <span className="app-meta-chip">Analytics-ready structure</span>
            {backgroundLoading ? (
              <span className="app-meta-chip">Loading more...</span>
            ) : null}
          </>
        }
        stats={[
          {
            label: "Total tags",
            value: String(totalTags ?? tags.length),
            meta: "Active tags available for question authoring and subject organization.",
          },
          {
            label: "Loaded now",
            value:
              totalTags !== null && tags.length < totalTags
                ? `${tags.length}/${totalTags}`
                : String(tags.length),
            meta: backgroundLoading
              ? "The first batch is ready now while the remaining tags continue loading in the background."
              : "The page now opens with the initial tag batch already rendered.",
          },
          {
            label: "Visible now",
            value:
              tags.length === 0
                ? "0"
                : `${visibleRangeStart}-${visibleRangeEnd}`,
            meta: "The tag library now uses paginated pages instead of an expanding load-more list.",
          },
          {
            label: "Library state",
            value: fetchError
              ? "Needs attention"
              : tagsLoading
                ? "Loading"
                : backgroundLoading
                  ? "Finishing load"
                  : "Ready",
            meta: fetchError
              ? "Refresh and retry if tags or subject links did not load cleanly."
              : backgroundLoading
                ? "You can start working with the first set of tags while the rest of the library catches up."
                : "Use this page to maintain reusable curriculum labels.",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Tag Library</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          {fetchError ? (
            <div className="app-feedback app-feedback-error text-center">
              <p>{fetchError}</p>
              <div className="mt-4 flex justify-center">
                <Button onClick={() => void loadTagsProgressively()} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          ) : tagsLoading ? (
            <div className="app-empty-state">
              <div className="flex items-center justify-center text-muted-foreground">
                <Spinner />
                <span>Loading tags...</span>
              </div>
            </div>
          ) : tags.length === 0 ? (
            <div className="app-empty-state">
              <p>No tags found yet.</p>
              <div className="mt-4 flex justify-center">
                <AppPrefetchLink href="/workspace/tags/create">
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Tag
                  </Button>
                </AppPrefetchLink>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {backgroundLoading ? (
                <div className="app-feedback app-feedback-info">
                  Loaded {tags.length} tag{tags.length === 1 ? "" : "s"} so far. The remaining
                  {totalTags !== null && totalTags > tags.length ? ` ${totalTags - tags.length}` : ""} tag
                  {totalTags !== null && totalTags - tags.length === 1 ? "" : "s"} are still loading in the background.
                </div>
              ) : null}

              <ListPagination
                page={tagPage}
                totalPages={totalLoadedTagPages}
                totalItems={tags.length}
                pageSize={TAGS_PAGE_SIZE}
                itemLabel="tags"
                onPageChange={setTagPage}
              />

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleTags.map((tag) => (
                  <Card
                    key={tag._id}
                    className="app-surface flex h-full flex-col overflow-hidden"
                  >
                    <CardContent className="flex h-full flex-col p-0 pt-0">
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h2 className="text-base font-semibold text-foreground">
                              {tag.name}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              Type: {tag.type?.name || "Unknown"}
                            </p>
                          </div>
                          <Badge variant="secondary">
                            {tag.subjects?.length || 0} linked subject
                            {tag.subjects?.length === 1 ? "" : "s"}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Assigned subjects
                          </p>
                          {tag.subjects?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {tag.subjects.map((subject) => (
                                <Badge key={subject._id} variant="outline" className="gap-1">
                                  <span>{subject.name}</span>
                                  {subject.code ? (
                                    <span className="opacity-70">• {subject.code}</span>
                                  ) : null}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              This tag is not linked to any subjects yet.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-border/60 bg-muted/10 p-4">
                        <AppPrefetchLink
                          href={buildReturnHref(`/workspace/tags/edit/${tag._id}`)}
                          className="flex-1"
                        >
                          <Button
                            disabled={deletingTagId === tag._id}
                            size="sm"
                            variant="outline"
                            className="app-button-compact w-full"
                          >
                            Edit
                          </Button>
                        </AppPrefetchLink>
                        <Button
                          onClick={() => void archiveTag(tag._id)}
                          disabled={deletingTagId === tag._id}
                          variant="destructive"
                          size="sm"
                          className="app-button-compact flex-1"
                        >
                          {deletingTagId === tag._id ? <Spinner /> : "Archive"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
