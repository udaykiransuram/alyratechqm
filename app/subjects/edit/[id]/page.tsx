// app/subjects/edit/[id]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MultiSelectTags, TagItem } from '@/components/ui/multi-select-tags';
import { Spinner } from '@/components/ui/spinner';
import { ChevronLeft } from 'lucide-react'; // Added for a back button icon

interface Subject {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  tags: TagItem[];
}

export default function EditSubjectPage({ params }: { params: { id: string } }) {
  const { id: subjectId } = params;
  const router = useRouter();
  const { toast } = useToast();

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
        setFetchError(errorMessage || "Failed to load subject details or available tags.");
        toast({
          title: "Error",
          description: errorMessage || "Failed to load subject details or available tags.",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMessage = "Network error when fetching subject details. Please check your connection.";
      console.error('Network error fetching subject/tags for edit:', error);
      setFetchError(errorMessage);
      toast({
        title: "Network Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPageLoading(false);
    }
  }, [subjectId, toast]);

  const handleCreateNewTag = useCallback(async (tagName: string, tagType: string): Promise<TagItem | null> => {
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName, type: tagType }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Tag Created",
          description: `"${data.tag.name}" (${data.tag.type}) added.`,
        });
        setAllAvailableTags(prev => {
            if (!prev.some(t => t._id === data.tag._id)) {
                return [...prev, data.tag];
            }
            return prev;
        });
        return data.tag;
      } else {
        console.error('Failed to create new tag:', data.message);
        toast({
          title: "Creation Failed",
          description: data.message || `Could not create tag "${tagName}".`,
          variant: "destructive",
        });
        return null;
      }
    } catch (error) {
      console.error('Network error creating tag:', error);
      toast({
        title: "Network Error",
        description: `Failed to create tag "${tagName}" due to network issue.`,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);


  useEffect(() => {
    fetchSubjectDetailsAndAllTags();
  }, [fetchSubjectDetailsAndAllTags]);

  const handleUpdateSubject = async () => {
    if (!subjectName.trim()) {
      toast({
        title: "Validation Issue",
        description: "Subject Name cannot be empty.",
        variant: "destructive",
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
    payload.tags = selectedTags.map(tag => tag._id);

    try {
      const res = await fetch(`/api/subjects/${subjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Success",
          description: `"${data.subject.name}" updated!`,
        });
        router.push('/subjects');
      } else {
        console.error('Failed to update subject:', data.message);
        toast({
          title: "Update Failed",
          description: data.message || `Failed to update "${subjectName}".`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Network error updating subject:', error);
      toast({
        title: "Network Error",
        description: `Failed to update "${subjectName}" due to network issue.`,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Loading and Error States ---
  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Spinner />
        <p className="mt-4 text-lg text-muted-foreground">Loading subject details...</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <Card className="w-full max-w-md text-center shadow-lg border border-destructive/50 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Loading Error</CardTitle>
            <CardDescription className="text-destructive/80 mt-2">
              {fetchError}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button onClick={fetchSubjectDetailsAndAllTags} variant="outline" className="text-destructive border-destructive hover:bg-destructive/20">
              Try Again
            </Button>
            <Button onClick={() => router.push('/subjects')} variant="secondary">
              Go Back to Subjects
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Main Edit Form UI ---
  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Back Button and Title */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/subjects')}
            className="text-muted-foreground hover:text-foreground"
            disabled={isSaving}
          >
            <ChevronLeft className="mr-2 h-5 w-5" />
            Back to Subjects
          </Button>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-foreground flex-1 pr-12">
            Edit Subject
          </h1>
          <div className="w-auto"></div> {/* Placeholder to balance flex */}
        </div>

        <Card className="shadow-lg border border-border/50 bg-card text-card-foreground">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">Subject Details</CardTitle>
            <CardDescription className="mt-2 text-base">
              Update the information for your subject.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-0"> {/* Increased spacing */}
            {/* Subject Name Input */}
            <div className="space-y-2"> {/* Consistent spacing */}
              <Label htmlFor="subjectName">Subject Name</Label>
              <Input
                id="subjectName"
                placeholder="e.g., Algebra I"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="h-10"
                aria-label="Subject Name"
                required
                disabled={isSaving}
              />
            </div>

            {/* Subject Code Input */}
            <div className="space-y-2">
              <Label htmlFor="subjectCode">Subject Code (Optional)</Label>
              <Input
                id="subjectCode"
                placeholder="e.g., MATH101, CS200"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                className="h-10"
                aria-label="Subject Code"
                disabled={isSaving}
              />
            </div>

            {/* Subject Description Textarea */}
            <div className="space-y-2">
              <Label htmlFor="subjectDescription">Description (Optional)</Label>
              <Textarea
                id="subjectDescription"
                placeholder="Provide a brief description of the subject."
                value={subjectDescription}
                onChange={(e) => setSubjectDescription(e.target.value)}
                className="min-h-[100px]"
                aria-label="Subject Description"
                disabled={isSaving}
              />
            </div>

            <Separator className="my-6" /> {/* More prominent separator */}

            {/* Tag Selection Section */}
            <div className="space-y-2">
              <Label htmlFor="tag-select" className="text-base font-medium">Associated Tags (Optional)</Label>
              <MultiSelectTags
                selectedTags={selectedTags}
                allTags={allAvailableTags ?? []} // <-- Ensure it's always an array
                onSelectedTagsChange={setSelectedTags}
                onCreateNewTag={handleCreateNewTag}
                isLoading={isSaving}
              />
              <p className="text-sm text-muted-foreground pt-1">
                Select relevant tags to categorize your subject. You can also create new tags.
              </p>
            </div>

            <div className="flex gap-3 pt-4"> {/* Buttons side-by-side with gap */}
                <Button
                    onClick={handleUpdateSubject}
                    disabled={isSaving || !subjectName.trim()}
                    className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-md shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {isSaving ? <Spinner /> : 'Save Changes'}
                </Button>
                <Button
                    onClick={() => router.push('/subjects')}
                    variant="outline"
                    className="flex-1 h-11 text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground"
                    disabled={isSaving}
                >
                    Cancel
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}