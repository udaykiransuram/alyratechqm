'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Plus } from 'lucide-react';

import AppPrefetchLink from '@/components/navigation/AppPrefetchLink';
import PageHero from '@/components/layout/PageHero';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';

interface TagItem {
  _id: string;
  name: string;
  type: {
    _id: string;
    name: string;
  };
  subjects?: {
    _id: string;
    name: string;
    code?: string;
  }[];
}

const INITIAL_TAG_BATCH_SIZE = 24;
const TAGS_VISIBLE_PAGE_SIZE = INITIAL_TAG_BATCH_SIZE;

type FetchTagsOptions = {
  limit?: number;
  background?: boolean;
  suppressErrors?: boolean;
  signal?: AbortSignal;
};

export default function TagsListPage() {
  const { buildReturnHref } = useReturnHrefBuilder('/workspace/tags');
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [totalTags, setTotalTags] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [visibleTagCount, setVisibleTagCount] = useState(TAGS_VISIBLE_PAGE_SIZE);
  const archivedTagIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  const sortTagsByName = useCallback((items: TagItem[]) => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const fetchTagsWithSubjects = useCallback(async ({
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
        params.set('limit', String(limit));
      }

      const endpoint = params.size > 0
        ? `/api/tags/with-subjects?${params.toString()}`
        : '/api/tags/with-subjects';

      const res = await fetch(endpoint, { signal });
      const data = await res.json();

      if (data.success) {
        const visibleTags = (Array.isArray(data.tags) ? data.tags : []).filter(
          (tag: TagItem) => !archivedTagIdsRef.current.has(tag._id),
        );
        const sortedTags = sortTagsByName(visibleTags);
        setTags(sortedTags);
        setTotalTags(typeof data.total === 'number' ? data.total : sortedTags.length);
        return {
          success: true,
          partial: Boolean(data.partial),
        };
      } else {
        const errorMessage = data.message || 'Failed to load tags.';
        if (!suppressErrors) {
          setFetchError(errorMessage);
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
          });
        }
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return null;
      }
      const errorMessage = 'Could not fetch tags. Please check your connection.';
      if (!suppressErrors) {
        setFetchError(errorMessage);
        toast({
          title: 'Network Error',
          description: errorMessage,
          variant: 'destructive',
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
  }, [sortTagsByName, toast]);

  const loadTagsProgressively = useCallback(async (signal?: AbortSignal) => {
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
  }, [fetchTagsWithSubjects]);

  useEffect(() => {
    const controller = new AbortController();
    void loadTagsProgressively(controller.signal);
    return () => controller.abort();
  }, [loadTagsProgressively]);

  const visibleTags = useMemo(() => {
    return tags.slice(0, visibleTagCount);
  }, [tags, visibleTagCount]);
  const hasMoreVisibleTags = tags.length > visibleTags.length;
  const remainingVisibleTags = Math.max(0, tags.length - visibleTags.length);

  const archiveTag = async (id: string) => {
    const isConfirmed = confirm('Are you sure you want to archive this tag? This action cannot be undone.');
    if (!isConfirmed) return;

    const originalTags = [...tags];
    archivedTagIdsRef.current.add(id);
    setDeletingTagId(id);
    setTags((prevTags) => prevTags.filter((tag) => tag._id !== id));
    setTotalTags((currentTotal) => (currentTotal === null ? currentTotal : Math.max(0, currentTotal - 1)));
    toast({ title: 'Archiving Tag...', description: 'Your tag is being archived.' });

    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Tag Archived', description: 'Successfully archived the tag.' });
      } else {
        archivedTagIdsRef.current.delete(id);
        setTags(originalTags);
        setTotalTags((currentTotal) => (currentTotal === null ? originalTags.length : currentTotal + 1));
        toast({
          title: 'Failed to Archive',
          description: data.message || 'An error occurred.',
          variant: 'destructive',
        });
      }
    } catch {
      archivedTagIdsRef.current.delete(id);
      setTags(originalTags);
      setTotalTags((currentTotal) => (currentTotal === null ? originalTags.length : currentTotal + 1));
      toast({
        title: 'Network Error',
        description: 'Could not archive the tag. Please try again.',
        variant: 'destructive',
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
              relatedApiPrefetches={['/api/tag-types', '/api/subjects']}
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
            {backgroundLoading ? <span className="app-meta-chip">Loading more...</span> : null}
          </>
        }
        stats={[
          {
            label: 'Total tags',
            value: String(totalTags ?? tags.length),
            meta: 'Active tags available for question authoring and subject organization.',
          },
          {
            label: 'Loaded now',
            value:
              totalTags !== null && tags.length < totalTags
                ? `${tags.length}/${totalTags}`
                : String(tags.length),
            meta: backgroundLoading
              ? 'The first batch is ready now while the remaining tags continue loading in the background.'
              : 'All currently loaded tags are ready to browse.',
          },
          {
            label: 'Visible now',
            value:
              visibleTags.length < tags.length
                ? `${visibleTags.length}/${tags.length}`
                : String(visibleTags.length),
            meta: 'Progressive reveal keeps the grid quick while the full library stays available.',
          },
          {
            label: 'Library state',
            value: fetchError ? 'Needs attention' : tagsLoading ? 'Loading' : backgroundLoading ? 'Finishing load' : 'Ready',
            meta: fetchError
              ? 'Refresh and retry if tags or subject links did not load cleanly.'
              : backgroundLoading
                ? 'You can start working with the first set of tags while the rest of the library catches up.'
                : 'Use this page to maintain reusable curriculum labels.',
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
                  Loaded {tags.length} tag{tags.length === 1 ? '' : 's'} so far. The remaining
                  {totalTags !== null && totalTags > tags.length ? ` ${totalTags - tags.length}` : ''} tag
                  {totalTags !== null && totalTags - tags.length === 1 ? '' : 's'} are still loading in the background.
                </div>
              ) : null}
              {tags.length > TAGS_VISIBLE_PAGE_SIZE ? (
                <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Showing {visibleTags.length} of {tags.length} loaded tag
                        {tags.length === 1 ? '' : 's'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Load more when you want to expand the library without jumping between pages.
                      </p>
                    </div>
                    {hasMoreVisibleTags ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="app-button-compact"
                        onClick={() =>
                          setVisibleTagCount(
                            (currentCount) => currentCount + TAGS_VISIBLE_PAGE_SIZE,
                          )
                        }
                      >
                        Load More
                        {remainingVisibleTags > 0
                          ? ` (${Math.min(TAGS_VISIBLE_PAGE_SIZE, remainingVisibleTags)} more)`
                          : ''}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {visibleTags.map((tag) => (
                  <Card key={tag._id} className="app-surface flex h-full flex-col overflow-hidden">
                    <CardContent className="flex h-full flex-col p-0 pt-0">
                      <div className="flex flex-1 flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <h2 className="text-base font-semibold text-foreground">{tag.name}</h2>
                            <p className="text-sm text-muted-foreground">
                              Used in {tag.subjects?.length ?? 0} subject{(tag.subjects?.length ?? 0) === 1 ? '' : 's'}.
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 capitalize">
                            {tag.type?.name ?? 'Unassigned'}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                            Associated Subjects
                          </p>
                          {tag.subjects && tag.subjects.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {tag.subjects.map((subject) => (
                                <Badge key={subject._id} variant="secondary">
                                  {subject.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No subjects assigned.</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-border/60 bg-muted/10 p-3">
                        <AppPrefetchLink
                          href={buildReturnHref(`/workspace/tags/edit/${tag._id}`)}
                          className="flex-1"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="app-button-compact w-full"
                            disabled={deletingTagId === tag._id}
                          >
                            Edit
                          </Button>
                        </AppPrefetchLink>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="app-button-compact flex-1"
                          onClick={() => archiveTag(tag._id)}
                          disabled={deletingTagId === tag._id}
                        >
                          {deletingTagId === tag._id ? <Spinner /> : 'Archive'}
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
