import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectTags } from '@/components/ui/multi-select-tags';
import { fetchApiJson, resolveClientSchoolKey } from '@/lib/client/api';
import { cn } from '@/lib/utils';

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
  variant?: 'card' | 'plain';
  title?: string;
  description?: string;
  contentClassName?: string;
  allowAllClassOption?: boolean;
  allowAllSubjectOption?: boolean;
  allClassLabel?: string;
  allSubjectLabel?: string;
}

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
  variant = 'card',
  title = 'Metadata',
  description = 'Select the class, subject, and relevant tags for this question.',
  contentClassName,
  allowAllClassOption = false,
  allowAllSubjectOption = false,
  allClassLabel = 'All classes',
  allSubjectLabel = 'All subjects',
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
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error('Please select a school in the navbar first.');
      }

      const data = await fetchApiJson<any>('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tagName,
          type: tagTypeId,
          subjectIds:
            subjectId && subjectId !== 'all'
              ? [subjectId]
              : [],
        }),
        schoolKey,
        fallbackMessage: 'Failed to create the new tag.',
      });

      toast({
        title: 'Tag Created',
        description: `Tag "${data.tag.name}" has been created.`,
      });
      return data.tag;
    } catch (error: any) {
      toast({
        title: 'Error Creating Tag',
        description: error?.message || 'Failed to create the new tag.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const fields = (
    <>
      <div className="app-field-group">
        <Label className="app-field-label">Class</Label>
        <Select value={classId} onValueChange={setClassId} disabled={disableClassSubject}>
          <SelectTrigger>
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            {allowAllClassOption ? (
              <SelectItem value="all">{allClassLabel}</SelectItem>
            ) : null}
            {classes.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
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
                  : allowAllSubjectOption
                    ? allSubjectLabel
                    : !classId
                    ? 'Select a class first'
                    : 'Select a subject'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {allowAllSubjectOption ? (
              <SelectItem value="all">{allSubjectLabel}</SelectItem>
            ) : null}
            {subjects.map((sub) => (
              <SelectItem key={sub._id} value={sub._id}>
                {sub.name}
              </SelectItem>
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
    </>
  );

  if (variant === 'plain') {
    return <div className={cn('space-y-4', contentClassName)}>{fields}</div>;
  }

  return (
    <Card className="app-surface overflow-hidden shadow-none">
      <CardHeader className="app-section-header">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn('app-section-body space-y-4', contentClassName)}>{fields}</CardContent>
    </Card>
  );
}
