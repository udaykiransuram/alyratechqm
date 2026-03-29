import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from '@/components/ui/searchable-command-select';
import { fetchApiJson, resolveClientSchoolKey } from '@/lib/client/api';
import { cn } from '@/lib/utils';

function TagSelectorLoadingState() {
  return (
    <div className="space-y-2">
      <div className="flex h-10 items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3">
        <span className="text-sm text-muted-foreground">Loading tag selector...</span>
        <div className="flex items-center gap-2">
          <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Class and subject filters are ready. Tags will appear in a moment.
      </p>
    </div>
  );
}

const MultiSelectTags = dynamic(
  () =>
    import('@/components/ui/multi-select-tags').then(
      (module) => module.MultiSelectTags,
    ),
  {
    ssr: false,
    loading: () => <TagSelectorLoadingState />,
  },
);

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
  const classSelectOptions = React.useMemo<SearchableCommandOption[]>(
    () => [
      ...(allowAllClassOption
        ? [
            {
              value: 'all',
              label: allClassLabel,
              description: 'Browse across every class.',
            },
          ]
        : []),
      ...classes.map((classItem) => ({
        value: classItem._id,
        label: classItem.name,
      })),
    ],
    [allowAllClassOption, allClassLabel, classes],
  );
  const subjectSelectOptions = React.useMemo<SearchableCommandOption[]>(
    () => [
      ...(allowAllSubjectOption
        ? [
            {
              value: 'all',
              label: allSubjectLabel,
              description: 'Include every subject in the current scope.',
            },
          ]
        : []),
      ...subjects.map((subjectItem) => ({
        value: subjectItem._id,
        label: subjectItem.name,
      })),
    ],
    [allowAllSubjectOption, allSubjectLabel, subjects],
  );

  const fields = (
    <>
      <div className="app-field-group">
        <Label className="app-field-label">Class</Label>
        <SearchableCommandSelect
          value={classId}
          options={classSelectOptions}
          onValueChange={setClassId}
          disabled={disableClassSubject}
          placeholder={allowAllClassOption ? allClassLabel : 'Select a class'}
          searchPlaceholder="Search classes..."
          emptyText="No classes found."
          onClear={allowAllClassOption ? () => setClassId('all') : undefined}
          showCloseAction
        />
      </div>

      <div className="app-field-group">
        <Label className="app-field-label">Subject</Label>
        <SearchableCommandSelect
          value={subjectId}
          options={subjectSelectOptions}
          onValueChange={setSubjectId}
          disabled={disableClassSubject}
          placeholder={
            subjectsLoading
              ? 'Loading subjects...'
              : allowAllSubjectOption
                ? allSubjectLabel
                : !classId
                  ? 'Select a class first'
                  : 'Select a subject'
          }
          searchPlaceholder="Search subjects..."
          emptyText="No subjects found."
          onClear={allowAllSubjectOption ? () => setSubjectId('all') : undefined}
          showCloseAction
        />
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
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={cn('app-section-body space-y-4', contentClassName)}>{fields}</CardContent>
    </Card>
  );
}
