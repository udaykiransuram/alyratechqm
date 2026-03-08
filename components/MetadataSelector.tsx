import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectTags } from '@/components/ui/multi-select-tags';

interface MetadataSelectorProps {
  classes: { _id: string; name: string }[];
  classId: string;
  setClassId: (value: string) => void;
  subjects: { _id: string; name: string }[];
  subjectId: string;
  setSubjectId: (value: string) => void;
  subjectsLoading: boolean;
  allTags: any[];
  selectedTags: any[];
  setSelectedTags: (tags: any[]) => void;
  recommendedTagIds: string[];
  initialDataLoading: boolean;
  disableClassSubject?: boolean;
  resetCounter: number;
  toast: any;
  onCreateNewTag: (tagName: string, tagTypeId: string) => Promise<any>;
}

const getSchoolKey = () => {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};
const getSchoolQS = () => {
  const k = getSchoolKey();
  return k ? `?school=${encodeURIComponent(k)}` : '';
};

export function MetadataSelector({
  classes,
  classId,
  setClassId,
  subjects,
  subjectId,
  setSubjectId,
  subjectsLoading,
  allTags,
  selectedTags,
  setSelectedTags,
  recommendedTagIds,
  initialDataLoading,
  disableClassSubject = false,
  resetCounter,
  toast,
}: MetadataSelectorProps) {
  const [selectedTypeId] = useState<string | null>(null);

  const handleCreateNewTag = async (tagName: string, tagTypeId: string) => {
    if (!tagTypeId) {
      toast({
        title: 'Cannot Create Tag',
        description: 'A tag type must be selected first.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const res = await fetch('/api/tags' + getSchoolQS(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tagName,
          type: tagTypeId,
          subjectIds: [subjectId],
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Tag Created',
          description: `Tag "${data.tag.name}" has been created.`,
        });
        return data.tag;
      }

      toast({
        title: 'Error Creating Tag',
        description: data.message,
        variant: 'destructive',
      });
      return null;
    } catch {
      toast({
        title: 'Network Error',
        description: 'Failed to create the new tag.',
        variant: 'destructive',
      });
      return null;
    }
  };

  return (
    <Card className="app-surface overflow-hidden shadow-none">
      <CardHeader className="app-section-header">
        <CardTitle className="text-base">Metadata</CardTitle>
        <CardDescription>Select the class, subject, and relevant tags for this question.</CardDescription>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <div className="app-field-group">
          <Label className="app-field-label">Class</Label>
          <Select value={classId} onValueChange={setClassId} disabled={disableClassSubject}>
            <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="app-field-group">
          <Label className="app-field-label">Subject</Label>
          <Select value={subjectId} onValueChange={setSubjectId} disabled={disableClassSubject}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  subjectsLoading
                    ? 'Loading subjects...'
                    : !classId
                      ? 'Select a class first'
                      : 'Select a subject'
                }
              />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(sub => (
                <SelectItem key={sub._id} value={sub._id}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="app-field-group">
          <Label className="app-field-label">Tags</Label>
          <MultiSelectTags
            key={`${resetCounter}-tags-${selectedTypeId ?? 'all'}`}
            isLoading={initialDataLoading}
            allTags={allTags}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
            recommendedTagIds={recommendedTagIds}
            disabled={false}
            onCreateNewTag={handleCreateNewTag}
          />
        </div>

        {disableClassSubject ? (
          <p className="text-xs text-muted-foreground">
            Deselect all questions to change class or subject.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
