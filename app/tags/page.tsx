'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';

import PageHero from '@/components/layout/PageHero';
import { useReturnHrefBuilder } from '@/hooks/useReturnNavigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function TagsListPage() {
  const { buildReturnHref } = useReturnHrefBuilder('/tags');
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTagsWithSubjects = useCallback(async () => {
    setTagsLoading(true);
    setFetchError(null);

    try {
      const res = await fetch('/api/tags/with-subjects');
      const data = await res.json();

      if (data.success) {
        const sortedTags = data.tags.sort((a: TagItem, b: TagItem) => a.name.localeCompare(b.name));
        setTags(sortedTags);
      } else {
        const errorMessage = data.message || 'Failed to load tags.';
        setFetchError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    } catch {
      const errorMessage = 'Could not fetch tags. Please check your connection.';
      setFetchError(errorMessage);
      toast({
        title: 'Network Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setTagsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTagsWithSubjects();
  }, [fetchTagsWithSubjects]);

  const archiveTag = async (id: string) => {
    const isConfirmed = confirm('Are you sure you want to archive this tag? This action cannot be undone.');
    if (!isConfirmed) return;

    const originalTags = [...tags];
    setDeletingTagId(id);
    setTags((prevTags) => prevTags.filter((tag) => tag._id !== id));
    toast({ title: 'Archiving Tag...', description: 'Your tag is being archived.' });

    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Tag Archived', description: 'Successfully archived the tag.' });
      } else {
        setTags(originalTags);
        toast({
          title: 'Failed to Archive',
          description: data.message || 'An error occurred.',
          variant: 'destructive',
        });
      }
    } catch {
      setTags(originalTags);
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
            <Link href="/tags/create">
              <Plus className="h-4 w-4" />
              Create Tag
            </Link>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Cross-subject labels</span>
            <span className="app-meta-chip">Analytics-ready structure</span>
          </>
        }
        stats={[
          {
            label: 'Total tags',
            value: String(tags.length),
            meta: 'Tags available for question authoring and subject organization.',
          },
          {
            label: 'Linked subjects',
            value: String(tags.reduce((sum, tag) => sum + (tag.subjects?.length ?? 0), 0)),
            meta: 'Total subject associations currently stored across the tag library.',
          },
          {
            label: 'Library state',
            value: fetchError ? 'Needs attention' : tagsLoading ? 'Loading' : 'Ready',
            meta: fetchError
              ? 'Refresh and retry if tags or subject links did not load cleanly.'
              : 'Use this page to maintain reusable curriculum labels.',
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Tag Library</CardTitle>
          <CardDescription>Review each tag, its type, and the subjects it is attached to.</CardDescription>
        </CardHeader>
        <CardContent className="app-section-body">
          {fetchError ? (
            <div className="app-feedback app-feedback-error text-center">
              <p>{fetchError}</p>
              <div className="mt-4 flex justify-center">
                <Button onClick={fetchTagsWithSubjects} variant="outline">
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
                <Link href="/tags/create">
                  <Button variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Tag
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tags.map((tag) => (
                <Card key={tag._id} className="app-surface flex h-full flex-col overflow-hidden">
                  <CardContent className="flex h-full flex-col p-0">
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
                      <Link href={buildReturnHref(`/tags/edit/${tag._id}`)} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full" disabled={deletingTagId === tag._id}>
                          Edit
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
