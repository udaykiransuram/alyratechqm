// app/tags/edit/[id]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from '@/components/ui/spinner';
import { CreateTagTypeModal } from '@/components/CreateTagTypeModal'; // Import the modal
import { PlusCircle } from 'lucide-react';

// Updated interfaces to reflect the new data structure
interface TagType {
  _id: string;
  name: string;
}

interface TagItem {
  _id: string;
  name: string;
  type: TagType; // Type is now an object
  subjects?: { _id: string; name: string; code?: string; }[];
}

interface Subject {
  _id: string;
  name: string;
  code?: string;
}

export default function EditTagPage({ params }: { params: { id: string } }) {
  const { id: tagId } = params;
  const router = useRouter();
  const { toast } = useToast();

  const [tagName, setTagName] = useState('');
  const [selectedTagTypeId, setSelectedTagTypeId] = useState(''); // State now holds the ID
  const [tagTypes, setTagTypes] = useState<TagType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPageData = useCallback(async () => {
    setPageLoading(true);
    try {
      const [tagRes, allSubjectsRes, tagTypesRes] = await Promise.all([
        fetch(`/api/tags/${tagId}`),
        fetch('/api/subjects'),
        fetch('/api/tag-types')
      ]);

      const tagData = await tagRes.json();
      const allSubjectsData = await allSubjectsRes.json();
      const tagTypesData = await tagTypesRes.json();

      if (tagData.success && allSubjectsData.success && tagTypesData.success) {
        const tag = tagData.tag as TagItem;
        
        setTagName(tag.name);
        setSelectedTagTypeId(tag.type._id); // Set the ID of the tag's type
        setSelectedSubjects(tag.subjects?.map(sub => sub._id) || []);
        
        setSubjects(allSubjectsData.subjects as Subject[]);
        setTagTypes(tagTypesData.tagTypes as TagType[]);
      } else {
        toast({
          title: "Error",
          description: tagData.message || allSubjectsData.message || tagTypesData.message || "Failed to load page data.",
          variant: "destructive",
        });
        router.push('/tags');
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Failed to load page data.", variant: "destructive" });
      router.push('/tags');
    } finally {
      setPageLoading(false);
    }
  }, [tagId, toast, router]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const handleUpdateTag = async () => {
    if (!tagName.trim() || !selectedTagTypeId) {
      toast({ title: "Validation Error", description: "Tag Name and Type are required.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tags/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tagName,
          type: selectedTagTypeId, // Send the selected type ID
          selectedSubjectIds: selectedSubjects,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Success", description: `Tag "${data.tag.name}" updated successfully.` });
        router.push('/tags');
      } else {
        toast({ title: "Error Updating Tag", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Failed to update tag.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner /> <span className="ml-2 text-muted-foreground">Loading tag details...</span>
      </div>
    );
  }

  return (
    <>
      <CreateTagTypeModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTagTypeCreated={(newTagType) => {
          setTagTypes((prev) => [...prev, newTagType].sort((a, b) => a.name.localeCompare(b.name)));
          setSelectedTagTypeId(newTagType._id);
        }}
      />
      <div className="max-w-2xl mx-auto py-8 space-y-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Edit Tag</h1>
          <p className="text-muted-foreground mt-1">Update the tag's details and its subject associations.</p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Tag Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="tagName">Tag Name</Label>
              <Input id="tagName" value={tagName} onChange={(e) => setTagName(e.target.value)} disabled={isSaving} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tagType">Tag Type</Label>
              <div className="flex items-center gap-2">
                <Select onValueChange={setSelectedTagTypeId} value={selectedTagTypeId} disabled={isSaving}>
                  <SelectTrigger id="tagType">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {tagTypes.map((type) => (
                      <SelectItem key={type._id} value={type._id} className="capitalize">{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => setIsModalOpen(true)} disabled={isSaving}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subject Associations</CardTitle>
            <CardDescription>Assign or unassign this tag from subjects.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
              {subjects.map((subject) => (
                <div key={subject._id} className="flex items-center space-x-3">
                  <Checkbox
                    id={`subject-${subject._id}`}
                    checked={selectedSubjects.includes(subject._id)}
                    onCheckedChange={(checked) => {
                      setSelectedSubjects((prev) =>
                        checked ? [...prev, subject._id] : prev.filter((id) => id !== subject._id)
                      );
                    }}
                    disabled={isSaving}
                  />
                  <Label htmlFor={`subject-${subject._id}`} className="font-normal">
                    {subject.name} {subject.code ? `(${subject.code})` : ''}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push('/tags')} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleUpdateTag} disabled={isSaving}>
            {isSaving && <Spinner />}
            Save Changes
          </Button>
        </div>
      </div>
    </>
  );
}