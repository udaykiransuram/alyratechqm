// app/subjects/create/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label'; // Added Label for form fields
import { Textarea } from '@/components/ui/textarea'; // Added Textarea for description
import { Separator } from '@/components/ui/separator'; // Added Separator for visual breaks
import { MultiSelectTags, TagItem } from '@/components/ui/multi-select-tags'; // Added MultiSelectTags
import { Spinner } from '@/components/ui/spinner'; // Ensure Spinner is imported from shared location
import Link from 'next/link'; // For the cancel button to act as a link

export default function CreateSubjectPage() {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

  const [allAvailableTags, setAllAvailableTags] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagItem[]>([]); // State for selected tags (TagItem objects)
  const [tagsLoading, setTagsLoading] = useState(true); // Loading state for tags

  const { toast } = useToast();
  const router = useRouter();

  // Fetch all available tags when component mounts
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
          title: "Error",
          description: data.message || "Failed to load available tags.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Network error fetching tags:', error);
      toast({
        title: "Error",
        description: "Network error when fetching available tags.",
        variant: "destructive",
      });
    } finally {
      setTagsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllTags();
  }, [fetchAllTags]);

  // Handler for creating new tags directly from MultiSelectTags
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


  const createSubject = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject Name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    setIsCreatingSubject(true);

    // Construct the payload, mapping selectedTags to their IDs
    const payload = {
      name: name.trim(),
      // Send code as null if empty, otherwise trimmed value
      code: code.trim() === '' ? null : code.trim(),
      // Send description as null if empty, otherwise trimmed value
      description: description.trim() === '' ? null : description.trim(),
      // Send selected tag IDs to the backend
      tags: selectedTags.map(tag => tag._id),
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
        setSelectedTags([]); // Clear selected tags
        toast({
          title: "Success",
          description: "Subject created successfully! Redirecting...",
        });
        router.push('/subjects'); // Redirect to view all subjects page
      } else {
        console.error('Failed to create subject:', data.message);
        toast({
          title: "Error",
          description: data.message || "Failed to create subject.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating subject:', error);
      toast({
        title: "Error",
        description: "Network error when creating subject.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSubject(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-md mx-auto space-y-8">
        <h1 className="text-4xl font-extrabold text-center text-foreground mb-10">Create New Subject</h1>

        <Card className="shadow-lg border border-border/50 bg-card text-card-foreground">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">Add New Subject Details</CardTitle>
            <CardDescription className="mt-2 text-base">
              Fill in the details below to create a new subject.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-0"> {/* Consistent spacing */}
            {/* Subject Name Input */}
            <div className="space-y-2">
              <Label htmlFor="subjectName">Subject Name</Label>
              <Input
                id="subjectName"
                placeholder="e.g., Mathematics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10"
                aria-label="Subject Name"
                required
                disabled={isCreatingSubject}
              />
            </div>

            {/* Subject Code Input */}
            <div className="space-y-2">
              <Label htmlFor="subjectCode">Subject Code (Optional)</Label>
              <Input
                id="subjectCode"
                placeholder="e.g., MATH101"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-10"
                aria-label="Subject Code"
                disabled={isCreatingSubject}
              />
            </div>

            {/* Subject Description Textarea */}
            <div className="space-y-2">
              <Label htmlFor="subjectDescription">Description (Optional)</Label>
              <Textarea
                id="subjectDescription"
                placeholder="Provide a brief description of the subject."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[100px]"
                aria-label="Subject Description"
                disabled={isCreatingSubject}
              />
            </div>

            <Separator className="my-6" /> {/* Visual separator */}

            {/* Tag Selection Section */}
            <div className="space-y-2">
              <Label htmlFor="tag-select" className="text-base font-medium">Associated Tags (Optional)</Label>
              {tagsLoading ? (
                <div className="flex items-center justify-center h-10 text-muted-foreground">
                  <Spinner /> <span className="ml-2">Loading tags...</span>
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
              <p className="text-sm text-muted-foreground pt-1">
                Categorize your subject with relevant tags. You can also create new tags on the fly.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={createSubject}
                disabled={isCreatingSubject || !name.trim()}
                className="flex-1 h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-md shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreatingSubject ? <Spinner /> : 'Add Subject'}
              </Button>
              <Button
                onClick={() => router.push('/subjects')}
                variant="outline"
                className="flex-1 h-11 text-muted-foreground border-input hover:bg-accent hover:text-accent-foreground"
                disabled={isCreatingSubject}
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