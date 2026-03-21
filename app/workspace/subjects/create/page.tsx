'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import PageHero from '@/components/layout/PageHero';
import { MultiSelectTags, TagItem } from '@/components/ui/multi-select-tags';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';

export default function CreateSubjectPage() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  const [allAvailableTags, setAllAvailableTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);

  const { toast } = useToast();
  const router = useRouter();

  const fetchAllTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await fetch('/api/tags');
      const data = await res.json();
      if (data.success) {
        setAllAvailableTags(data.tags);
      } else {
        console.error('Failed to fetch tags:', data.message);
        toast({
          title: 'Error',
          description: data.message || 'Failed to load available tags.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Network error fetching tags:', error);
      toast({
        title: 'Error',
        description: 'Network error when fetching available tags.',
        variant: 'destructive',
      });
    } finally {
      setTagsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllTags();
  }, [fetchAllTags]);

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

  const createSubject = async () => {
    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Subject name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingSubject(true);

    const payload = {
      name: name.trim(),
      code: code.trim() === '' ? null : code.trim(),
      description: description.trim() === '' ? null : description.trim(),
      tags: selectedTags.map((tag) => tag._id),
    };

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setName('');
        setCode('');
        setDescription('');
        setSelectedTags([]);
        toast({
          title: 'Success',
          description: 'Subject created successfully. Redirecting…',
        });
        router.push('/workspace/subjects');
      } else {
        console.error('Failed to create subject:', data.message);
        toast({
          title: 'Error',
          description: data.message || 'Failed to create subject.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating subject:', error);
      toast({
        title: 'Error',
        description: 'Network error when creating subject.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingSubject(false);
    }
  };

  return (
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Curriculum"
        title="Create Subject"
        description="Add a new subject with an optional code, short description, and linked tags so question authoring stays consistent."
        actions={
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => router.push('/workspace/subjects')}
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
          </>
        }
        stats={[
          {
            label: 'Available tags',
            value: tagsLoading ? 'Loading' : String(allAvailableTags.length),
            meta: 'Existing tags can be linked now or added inline while creating the subject.',
          },
          {
            label: 'Selected tags',
            value: String(selectedTags.length),
            meta: 'Linked tags help question filtering and downstream paper assembly.',
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

                {tagsLoading ? (
                  <div className="app-status-row justify-center rounded-xl border border-dashed border-border/60 bg-background px-4 py-6">
                    <Spinner />
                    <span>Loading tags…</span>
                  </div>
                ) : (
                  <MultiSelectTags
                    selectedTags={selectedTags}
                    allTags={allAvailableTags}
                    onSelectedTagsChange={setSelectedTags}
                    onCreateNewTag={handleCreateNewTag}
                    isLoading={isCreatingSubject}
                  />
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="sm:min-w-[140px]"
                  onClick={() => router.push('/workspace/subjects')}
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
                  {isCreatingSubject ? <Spinner /> : 'Create Subject'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

              </div>
    </div>
  );
}
