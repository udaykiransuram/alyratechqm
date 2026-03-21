'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft } from 'lucide-react';

import PageHero from '@/components/layout/PageHero';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { MultiSelectTags, TagItem } from '@/components/ui/multi-select-tags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageLoadingState from '@/components/ui/page-loading-state';
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

export default function EditSubjectPage({ params }: { params: { id: string } }) {
  const { id: subjectId } = params;
  const { toast } = useToast();
  const { navigateBack } = useBackNavigation('/workspace/subjects');

  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [allAvailableTags, setAllAvailableTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);

  const fetchSubjectDetailsAndAllTags = useCallback(async () => {
    setPageLoading(true);
    setFetchError(null);
    try {
      const subjectRes = await fetch(`/api/subjects/${subjectId}`);
      const subjectData = await subjectRes.json();

      const allTagsRes = await fetch('/api/tags');
      const allTagsData = await allTagsRes.json();

      if (subjectData.success && allTagsData.success) {
        const subject = subjectData.subject as Subject;
        const tags = allTagsData.tags as TagItem[];

        setSubjectName(subject.name);
        setSubjectCode(subject.code || '');
        setSubjectDescription(subject.description || '');
        setSelectedTags(subject.tags || []);
        setAllAvailableTags(tags);
      } else {
        const errorMessage =
          (!subjectData.success ? subjectData.message : '') +
          (!allTagsData.success ? (subjectData.success ? '' : ' & ') + allTagsData.message : '');
        console.error('Failed to fetch data:', errorMessage);
        setFetchError(errorMessage || 'Failed to load subject details or available tags.');
        toast({
          title: 'Error',
          description: errorMessage || 'Failed to load subject details or available tags.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const errorMessage = 'Network error when fetching subject details. Please check your connection.';
      console.error('Network error fetching subject/tags for edit:', error);
      setFetchError(errorMessage);
      toast({
        title: 'Network Error',
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
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tagName, type: tagType }),
        });
        const data = await res.json();
        if (data.success) {
          toast({
            title: 'Tag Created',
            description: `"${data.tag.name}" (${data.tag.type}) added.`,
          });
          setAllAvailableTags((prev) => {
            if (!prev.some((tag) => tag._id === data.tag._id)) {
              return [...prev, data.tag];
            }
            return prev;
          });
          return data.tag;
        }

        console.error('Failed to create new tag:', data.message);
        toast({
          title: 'Creation Failed',
          description: data.message || `Could not create tag "${tagName}".`,
          variant: 'destructive',
        });
        return null;
      } catch (error) {
        console.error('Network error creating tag:', error);
        toast({
          title: 'Network Error',
          description: `Failed to create tag "${tagName}" due to a network issue.`,
          variant: 'destructive',
        });
        return null;
      }
    },
    [toast],
  );

  useEffect(() => {
    fetchSubjectDetailsAndAllTags();
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
    };

    payload.code = subjectCode.trim() !== '' ? subjectCode.trim() : null;
    payload.description = subjectDescription.trim() !== '' ? subjectDescription.trim() : null;
    payload.tags = selectedTags.map((tag) => tag._id);

    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `"${data.subject.name}" updated.`,
        });
        navigateBack();
      } else {
        console.error('Failed to update subject:', data.message);
        toast({
          title: 'Update Failed',
          description: data.message || `Failed to update "${subjectName}".`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Network error updating subject:', error);
      toast({
        title: 'Network Error',
        description: `Failed to update "${subjectName}" due to a network issue.`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
        <PageLoadingState
          title="Loading subject details"
          description="Preparing the subject form, linked tags, and school data."
          className="px-0 py-0"
          contentClassName="max-w-none"
          dense
        />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Curriculum"
          title="Edit Subject"
          description="We couldn’t load the subject details for editing."
          actions={
            <Button type="button" variant="outline" className="gap-2" onClick={navigateBack}>
              <ChevronLeft className="h-4 w-4" />
              Back to Subjects
            </Button>
          }
        />

        <Card className="app-surface overflow-hidden">
          <CardContent className="app-surface-body">
            <div className="app-feedback app-feedback-error space-y-4">
              <div>
                <p className="font-medium">Loading Error</p>
                <p className="mt-1">{fetchError}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={navigateBack}>
                  Go Back to Subjects
                </Button>
                <Button type="button" onClick={fetchSubjectDetailsAndAllTags}>
                  Try Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Curriculum"
        title="Edit Subject"
        description="Update the subject details and keep related tags organized across your question and paper setup."
        actions={
          <Button
            type="button"
            variant="outline"
            className="gap-2"
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
                    Adjust related tags here, or create a new tag without leaving the page.
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
    </div>
  );
}
