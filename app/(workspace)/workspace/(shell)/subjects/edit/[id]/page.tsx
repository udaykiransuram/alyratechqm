'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useParams } from 'next/navigation';

import PageHero from '@/components/layout/PageHero';
import PageShell from '@/components/layout/PageShell';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import {
  buildPartialLoadMessage,
  fetchApiJson,
  resolveClientSchoolKey,
} from '@/lib/client/api';
import { MultiSelectTags, TagItem } from '@/components/ui/multi-select-tags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageLoadingState from '@/components/ui/page-loading-state';
import PageState from '@/components/ui/page-state';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

interface Subject {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  tags: TagItem[];
}

function mergeTagsById(...groups: Array<TagItem[] | undefined>) {
  const tagMap = new Map<string, TagItem>();

  groups.flat().forEach((tag) => {
    if (!tag) return;

    const tagId = String(tag._id || '').trim();
    if (!tagId) return;
    if (!tagMap.has(tagId)) {
      tagMap.set(tagId, tag);
    }
  });

  return Array.from(tagMap.values());
}

export default function EditSubjectPage() {
  const routeParams = useParams<{ id: string }>();
  const subjectId = String(routeParams.id || '').trim();
  const { toast } = useToast();
  const { navigateBack } = useBackNavigation('/workspace/subjects');

  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  const [allAvailableTags, setAllAvailableTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);

  const fetchSubjectDetailsAndAllTags = useCallback(async () => {
    setPageLoading(true);
    setFetchError(null);
    setPageNotice(null);

    try {
      if (!subjectId) {
        throw new Error('Subject ID is missing.');
      }

      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Select a school to edit subjects.');
      }

      const [subjectResult, tagsResult] = await Promise.allSettled([
        fetchApiJson<{ subject: Subject }>(`/api/subjects/${subjectId}`, {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load subject details.',
        }),
        fetchApiJson<{ tags?: TagItem[] }>('/api/tags', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load available tags.',
        }),
      ]);

      if (subjectResult.status !== 'fulfilled') {
        throw subjectResult.reason;
      }

      const subject = subjectResult.value.subject as Subject;
      const fetchedTags =
        tagsResult.status === 'fulfilled' && Array.isArray(tagsResult.value.tags)
          ? (tagsResult.value.tags as TagItem[])
          : [];
      const mergedTags = mergeTagsById(subject.tags || [], fetchedTags);

      setSubjectName(subject.name || '');
      setSubjectCode(subject.code || '');
      setSubjectDescription(subject.description || '');
      setSelectedTags(Array.isArray(subject.tags) ? subject.tags : []);
      setAllAvailableTags(mergedTags);
      setPageNotice(
        buildPartialLoadMessage(
          [
            ...(tagsResult.status === 'rejected' ? ['Available tags'] : []),
          ],
          'You can keep editing this subject and retry later.',
        ),
      );
    } catch (error: any) {
      const errorMessage =
        error?.message || 'Failed to load subject details or available tags.';
      setFetchError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setPageLoading(false);
    }
  }, [subjectId, toast]);

  const handleCreateNewTag = useCallback(
    async (tagName: string, tagType: string): Promise<TagItem | null> => {
      try {
        const schoolKey = resolveClientSchoolKey();
        if (!schoolKey) {
          throw new Error('Please select a school in the navbar first.');
        }

        const data = await fetchApiJson<any>('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tagName, type: tagType }),
          schoolKey,
          fallbackMessage: `Could not create tag "${tagName}".`,
        });

        toast({
          title: 'Tag Created',
          description: `"${data.tag.name}" added.`,
        });
        setAllAvailableTags((prev) => mergeTagsById(prev, [data.tag]));
        return data.tag;
      } catch (error: any) {
        toast({
          title: 'Creation Failed',
          description: error?.message || `Could not create tag "${tagName}".`,
          variant: 'destructive',
        });
        return null;
      }
    },
    [toast],
  );

  useEffect(() => {
    void fetchSubjectDetailsAndAllTags();
  }, [fetchSubjectDetailsAndAllTags]);

  const handleUpdateSubject = async () => {
    if (!subjectName.trim()) {
      toast({
        title: 'Validation Issue',
        description: 'Subject name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const payload: {
      name: string;
      code?: string | null;
      description?: string | null;
      tags?: string[];
    } = {
      name: subjectName.trim(),
      code: subjectCode.trim() !== '' ? subjectCode.trim() : null,
      description:
        subjectDescription.trim() !== '' ? subjectDescription.trim() : null,
      tags: selectedTags.map((tag) => tag._id),
    };

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Please select a school in the navbar first.');
      }

      const data = await fetchApiJson<any>(`/api/subjects/${subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        schoolKey,
        fallbackMessage: `Failed to update "${subjectName}".`,
      });

      toast({
        title: 'Success',
        description: `"${data.subject.name}" updated.`,
      });
      navigateBack();
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error?.message || `Failed to update "${subjectName}".`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <PageLoadingState
        title="Loading subject details"
        description="Preparing the subject form, linked tags, and school data."
        width="narrow"
        dense
      />
    );
  }

  if (fetchError) {
    return (
      <PageShell width="narrow">
        <PageHero
          variant="editor"
          eyebrow="Curriculum"
          title="Edit Subject"
          description="We couldn’t load the subject details for editing."
          actions={
            <Button
              type="button"
              variant="outline"
              className="app-button-back"
              onClick={navigateBack}
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Subjects
            </Button>
          }
        />

        <PageState
          variant="error"
          title="Could not load subject details"
          description={fetchError}
          action={
            <>
              <Button type="button" variant="outline" className="app-button-back" onClick={navigateBack}>
                Go Back to Subjects
              </Button>
              <Button type="button" className="app-button-filter" onClick={fetchSubjectDetailsAndAllTags}>
                Try Again
              </Button>
            </>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell width="narrow">
      <PageHero
        variant="editor"
        eyebrow="Curriculum"
        title="Edit Subject"
        description="Update the subject details and keep related tags organized across your question and paper setup."
        actions={
          <Button
            type="button"
            variant="outline"
            className="app-button-back"
            onClick={navigateBack}
            disabled={isSaving}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Subjects
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Subject maintenance</span>
            <span className="app-meta-chip">Tag-aware updates</span>
          </>
        }
        stats={[
          {
            label: 'Subject code',
            value: subjectCode.trim() || 'Not set',
            meta: 'Codes stay optional, but they help with reporting and authoring clarity.',
          },
          {
            label: 'Linked tags',
            value: String(selectedTags.length),
            meta: 'Adjust associated tags here or create a new one inline.',
          },
        ]}
      />

      {pageNotice ? (
        <div className="app-feedback app-feedback-info">{pageNotice}</div>
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
                    placeholder="e.g., Algebra I"
                    value={subjectName}
                    onChange={(event) => setSubjectName(event.target.value)}
                    aria-label="Subject Name"
                    required
                    disabled={isSaving}
                  />
                </div>

                <div className="app-field-group">
                  <Label htmlFor="subjectCode" className="app-field-label">
                    Subject Code
                  </Label>
                  <Input
                    id="subjectCode"
                    placeholder="e.g., MATH101"
                    value={subjectCode}
                    onChange={(event) => setSubjectCode(event.target.value)}
                    aria-label="Subject Code"
                    disabled={isSaving}
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
                  value={subjectDescription}
                  onChange={(event) => setSubjectDescription(event.target.value)}
                  className="min-h-[120px]"
                  aria-label="Subject Description"
                  disabled={isSaving}
                />
              </div>

              <div className="app-section space-y-3.5">
                <div className="space-y-1">
                  <Label htmlFor="tag-select" className="app-field-label">
                    Associated Tags
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Adjust related tags here, or create a new tag without leaving
                    the page.
                  </p>
                </div>

                <MultiSelectTags
                  selectedTags={selectedTags}
                  allTags={allAvailableTags}
                  onSelectedTagsChange={setSelectedTags}
                  onCreateNewTag={handleCreateNewTag}
                  isLoading={isSaving}
                />
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-[140px]"
                  onClick={navigateBack}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="sm:min-w-[160px]"
                  onClick={handleUpdateSubject}
                  disabled={isSaving || !subjectName.trim()}
                >
                  {isSaving ? <Spinner /> : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
