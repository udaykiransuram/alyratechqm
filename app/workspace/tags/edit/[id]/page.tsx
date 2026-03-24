'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { useParams } from 'next/navigation';

import PageHero from '@/components/layout/PageHero';
import { CreateTagTypeModal } from '@/components/CreateTagTypeModal';
import { useBackNavigation } from '@/hooks/useReturnNavigation';
import { buildPartialLoadMessage, fetchApiJson, resolveClientSchoolKey } from '@/lib/client/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageLoadingState from '@/components/ui/page-loading-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/use-toast';

interface TagType {
  _id: string;
  name: string;
}

interface TagItem {
  _id: string;
  name: string;
  type: TagType;
  subjects?: { _id: string; name: string; code?: string }[];
}

interface Subject {
  _id: string;
  name: string;
  code?: string;
}

export default function EditTagPage() {
  const { id: tagId } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { navigateBack } = useBackNavigation('/workspace/tags');

  const [tagName, setTagName] = useState('');
  const [selectedTagTypeId, setSelectedTagTypeId] = useState('');
  const [tagTypes, setTagTypes] = useState<TagType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [, setPageNotice] = useState<string | null>(null);

  const fetchPageData = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    setPageNotice(null);
    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setPageError('Select a school to edit tags.');
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
      setSelectedSubjects(tag.subjects?.map((subject) => subject._id) || []);
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
      toast({ title: 'Validation Error', description: 'Tag Name and Type are required.', variant: 'destructive' });
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
      toast({ title: 'Success', description: `Tag "${data.tag.name}" updated successfully.` });
      navigateBack();
    } catch (error: any) {
      toast({ title: 'Network Error', description: error?.message || 'Failed to update tag.', variant: 'destructive' });
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
      <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Curriculum"
          title="Edit Tag"
          description="The requested tag could not be loaded for editing."
          actions={
            <Button variant="outline" onClick={navigateBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Tags
            </Button>
          }
        />
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

      <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
        <PageHero
          eyebrow="Curriculum"
          title="Edit Tag"
          description="Update the tag details and subject associations without leaving the dedicated tag management flow."
          actions={
            <Button variant="outline" onClick={navigateBack} disabled={isSaving} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Tags
            </Button>
          }
          meta={
            <>
              <span className="app-meta-chip">Dedicated tag maintenance</span>
              <span className="app-meta-chip">Subject association editor</span>
            </>
          }
          stats={[
            {
              label: 'Current type',
              value: tagTypes.find((type) => type._id === selectedTagTypeId)?.name || 'Not set',
              meta: 'Type grouping helps keep tag filters readable across the workspace.',
            },
            {
              label: 'Assigned subjects',
              value: String(selectedSubjects.length),
              meta: 'Update the subject checklist below to change where this tag is available.',
            },
          ]}
        />

        <div className="app-editor-grid">
          <div className="app-editor-main">
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Tag Details</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-5">
                <div className="app-field-group">
                  <Label htmlFor="tagName" className="app-field-label">Tag Name</Label>
                  <Input id="tagName" value={tagName} onChange={(event) => setTagName(event.target.value)} disabled={isSaving} />
                </div>

                <div className="app-field-group">
                  <Label htmlFor="tagType" className="app-field-label">Tag Type</Label>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={setSelectedTagTypeId} value={selectedTagTypeId} disabled={isSaving}>
                      <SelectTrigger id="tagType">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                      <SelectContent>
                        {tagTypes.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">No tag types available yet.</div>
                        ) : null}
                        {tagTypes.map((type) => (
                          <SelectItem key={type._id} value={type._id} className="capitalize">{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setIsModalOpen(true)} disabled={isSaving} className="h-10 w-10">
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Subject Associations</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                <div className="max-h-60 space-y-3 overflow-y-auto pr-2">
                  {subjects.length === 0 ? <div className="text-sm text-muted-foreground">No subjects available for this school yet.</div> : null}
                  {subjects.map((subject) => (
                    <div key={subject._id} className="flex items-center space-x-3">
                      <Checkbox
                        id={`subject-${subject._id}`}
                        checked={selectedSubjects.includes(subject._id)}
                        onCheckedChange={(checked) => {
                          setSelectedSubjects((prev) =>
                            checked ? [...prev, subject._id] : prev.filter((id) => id !== subject._id),
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

                  </div>
      </div>
    </>
  );
}
