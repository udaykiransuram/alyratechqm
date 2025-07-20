// app/tags/list/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Plus } from 'lucide-react';

// Updated TagItem interface to reflect the populated 'type' object
interface TagItem {
  _id: string;
  name: string;
  type: { // 'type' is now an object
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
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTagsWithSubjects = useCallback(async () => {
    setTagsLoading(true);
    try {
      const res = await fetch('/api/tags/with-subjects');
      const data = await res.json();

      if (data.success) {
        const sortedTags = data.tags.sort((a: TagItem, b: TagItem) => a.name.localeCompare(b.name));
        setTags(sortedTags);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to load tags.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Could not fetch tags. Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setTagsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTagsWithSubjects();
  }, [fetchTagsWithSubjects]);

  const deleteTag = async (id: string) => {
    const isConfirmed = confirm("Are you sure you want to delete this tag? This action cannot be undone.");
    if (!isConfirmed) return;

    const originalTags = [...tags];
    setTags(prevTags => prevTags.filter(tag => tag._id !== id));
    toast({ title: "Deleting Tag...", description: "Your tag is being removed." });

    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        toast({ title: "Tag Deleted", description: "Successfully deleted the tag." });
      } else {
        setTags(originalTags); // Revert UI on failure
        toast({
          title: "Failed to Delete",
          description: data.message || "An error occurred.",
          variant: "destructive",
        });
      }
    } catch (err) {
      setTags(originalTags); // Revert UI on network error
      toast({
        title: "Network Error",
        description: "Could not delete the tag. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">All Tags</h1>
          <p className="text-muted-foreground mt-1">Browse, edit, or create new tags.</p>
        </header>
        <Link href="/tags/create" passHref>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New Tag
          </Button>
        </Link>
      </div>

      {tagsLoading ? (
        <div className="flex flex-col justify-center items-center h-64">
          <Spinner />
          <p className="mt-4 text-muted-foreground">Loading tags...</p>
        </div>
      ) : tags.length === 0 ? (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>No Tags Found</CardTitle>
            <CardDescription>It looks like you haven't created any tags yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tags/create" passHref>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" /> Create Your First Tag
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tags.map((tag) => (
            <Card key={tag._id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{tag.name}</CardTitle>
                <CardDescription>
                  {/* Access tag.type.name to display the type */}
                  Type: <span className="font-medium text-foreground capitalize">{tag.type.name}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                {tag.subjects && tag.subjects.length > 0 ? (
                  <>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Associated Subjects</h4>
                    <div className="flex flex-wrap gap-2">
                      {tag.subjects.map(subject => (
                        <Badge key={subject._id} variant="secondary">
                          {subject.name}
                        </Badge>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No subjects assigned.</p>
                )}
              </CardContent>
              <div className="p-4 border-t flex gap-2">
                <Link href={`/tags/edit/${tag._id}`} passHref className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">Edit</Button>
                </Link>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => deleteTag(tag._id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}