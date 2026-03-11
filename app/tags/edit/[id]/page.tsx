// app/tags/edit/[id]/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from '@/components/ui/spinner';
import PageLoadingState from '@/components/ui/page-loading-state';
import { CreateTagTypeModal } from '@/components/CreateTagTypeModal'; // Import the modal
import { PlusCircle } from 'lucide-react';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { buildPartialLoadMessage, fetchApiJson, resolveClientSchoolKey } from '@/lib/client/api';

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
  const { toast } = useToast();
  const { navigateBack } = useBackNavigation('/tags');

  const [tagName, setTagName] = useState('');
  const [selectedTagTypeId, setSelectedTagTypeId] = useState(''); // State now holds the ID
  const [tagTypes, setTagTypes] = useState<TagType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<string | null>(null);

  const fetchPageData = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    setPageNotice(null);
    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setPageError('Select a school workspace to edit tags.');
        return;
      }

      const [tagResult, subjectsResult, tagTypesResult] = await Promise.allSettled([
        fetchApiJson<any>(`/api/tags/${tagId}`, {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load tag details.',
        }),
        fetchApiJson<any>('/api/subjects', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load subjects.',
        }),
        fetchApiJson<any>('/api/tag-types', {
          cache: 'no-store',
          schoolKey,
          fallbackMessage: 'Failed to load tag types.',
        }),
      ]);

      if (tagResult.status !== 'fulfilled') {
        throw tagResult.reason;
      }

      const tagData = tagResult.value;
      const tag = tagData.tag as TagItem;
      setTagName(tag.name);
      setSelectedTagTypeId(tag.type._id);
      setSelectedSubjects(tag.subjects?.map(sub => sub._id) || []);
      setSubjects(subjectsResult.status === 'fulfilled' && Array.isArray(subjectsResult.value.subjects) ? subjectsResult.value.subjects as Subject[] : []);
      setTagTypes(tagTypesResult.status === 'fulfilled' && Array.isArray(tagTypesResult.value.tagTypes) ? tagTypesResult.value.tagTypes as TagType[] : []);
      setPageNotice(
        buildPartialLoadMessage([
          ...(subjectsResult.status === 'rejected' ? ['Subject associations'] : []),
          ...(tagTypesResult.status === 'rejected' ? ['Tag types'] : []),
        ]),
      );
    } catch (error: any) {
      setPageError(error?.message || 'Failed to load page data.');
    } finally {
      setPageLoading(false);
    }
  }, [tagId]);

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
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Please select a school in the navbar first.');
      }

      const payload = {
        name: tagName,
        type: selectedTagTypeId,
        selectedSubjectIds: selectedSubjects,
      };
      const data = await fetchApiJson<any>(`/api/tags/${tagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        schoolKey,
        fallbackMessage: 'Failed to update tag.',
      });
      toast({ title: "Success", description: `Tag "${data.tag.name}" updated successfully.` });
      navigateBack();
    } catch (error: any) {
      toast({ title: "Network Error", description: error?.message || "Failed to update tag.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <PageLoadingState
        title="Loading tag details"
        description="Preparing the tag form, subject links, and type options."
      />
    );
  }

  if (pageError) {
    return (
      <div className="app-page-shell max-w-2xl px-4 py-6 sm:px-0">
        <div className="app-feedback app-feedback-error">{pageError}</div>
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
        {pageNotice ? <div className="app-feedback app-feedback-info">{pageNotice}</div> : null}
        <header className="text-center">
          <h1 className="app-page-title">Edit Tag</h1>
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
                    {tagTypes.length === 0 ? <div className="px-3 py-2 text-sm text-muted-foreground">No tag types available yet.</div> : null}
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
              {subjects.length === 0 ? <div className="text-sm text-muted-foreground">No subjects available for this school yet.</div> : null}
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
          <Button variant="outline" onClick={navigateBack} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleUpdateTag} disabled={isSaving}>
            {isSaving && <Spinner />}
            Save Changes
          </Button>
        </div>
      </div>
    </>
  );
}
