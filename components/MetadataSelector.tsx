import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectTags } from "@/components/ui/multi-select-tags";

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
  disableClassSubject?: boolean; // <-- changed from 'disabled'
  resetCounter: number;
  toast: any;
  onCreateNewTag: (tagName: string, tagTypeId: string) => Promise<any>;
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
  disableClassSubject = false, // <-- default to false
  resetCounter,
  toast,
  onCreateNewTag,
}: MetadataSelectorProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

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
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tagName,
          type: tagTypeId,
          subjectIds: [subjectId]
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Tag Created',
          description: `Tag "${data.tag.name}" has been created.`,
        });
        return data.tag;
      } else {
        toast({
          title: 'Error Creating Tag',
          description: data.message,
          variant: 'destructive',
        });
        return null;
      }
    } catch (error) {
      toast({
        title: 'Network Error',
        description: 'Failed to create the new tag.',
        variant: 'destructive',
      });
      return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata</CardTitle>
        <CardDescription>Select the class, subject, and relevant tags for this question.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Class (Required)</Label>
          <Select
            value={classId}
            onValueChange={setClassId}
            disabled={disableClassSubject} // <-- disable only if needed
          >
            <SelectTrigger><SelectValue placeholder="Select a class" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Subject (Required)</Label>
          <Select
            value={subjectId}
            onValueChange={setSubjectId}
            disabled={disableClassSubject} // <-- disable only if needed
          >
            <SelectTrigger>
              <SelectValue placeholder={
                subjectsLoading ? "Loading subjects..." : 
                !classId ? "Select a class first" : "Select a subject"
              } />
            </SelectTrigger>
            <SelectContent>
              {subjects.map(sub => (
                <SelectItem key={sub._id} value={sub._id}>{sub.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tags</Label>
          <MultiSelectTags
            key={resetCounter + '-tags'}
            isLoading={initialDataLoading}
            allTags={allTags}
            selectedTags={selectedTags}
            onSelectedTagsChange={setSelectedTags}
            recommendedTagIds={recommendedTagIds}
            disabled={false} // <-- always enabled
            onCreateNewTag={handleCreateNewTag}
          />
        </div>
        {disableClassSubject && (
          <p className="text-xs text-muted-foreground">
            Deselect all questions to change class or subject.
          </p>
        )}
      </CardContent>
    </Card>
  );
}