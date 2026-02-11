// app/tags/create/page.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ChevronLeft, PlusCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CreateTagTypeModal } from '@/components/CreateTagTypeModal';

interface TagType {
  _id: string;
  name: string;
}

interface TagItem {
  _id: string;
  name: string;
  type: string;
}

interface Subject {
  _id: string;
  name: string;
  tags: TagItem[];
}

const getSchoolKey = () => {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};
const schoolQS = (() => { const k = getSchoolKey(); return k ? `?school=${encodeURIComponent(k)}` : ''; })();

export default function CreateTagPage() {
  const router = useRouter();
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagTypeId, setSelectedTagTypeId] = useState('');
  const [tagTypes, setTagTypes] = useState<TagType[]>([]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagTypesLoading, setTagTypesLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [subjectSearchInput, setSubjectSearchInput] = useState('');
  const subjectInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  const fetchTagTypes = useCallback(async () => {
    setTagTypesLoading(true);
    try {
      const endpoint = '/api/tag-types'+schoolQS;
      console.debug('[tags/create] fetchTagTypes ->', { endpoint });
      const res = await fetch(endpoint);
      const data = await res.json();
      console.debug('[tags/create] fetchTagTypes <-', { ok: res.ok, status: res.status, count: Array.isArray(data?.tagTypes) ? data.tagTypes.length : undefined });
      if (data.success) {
        setTagTypes(data.tagTypes);
      } else {
        toast({ title: "Error", description: "Failed to load tag types.", variant: "destructive" });
      }
    } catch (err) {
      console.error('[tags/create] fetchTagTypes error', err);
      toast({ title: "Network Error", description: "Could not load tag types.", variant: "destructive" });
    } finally {
      setTagTypesLoading(false);
    }
  }, [toast]);

  const fetchSubjects = useCallback(async () => {
    setSubjectsLoading(true);
    try {
      const endpoint = '/api/subjects'+schoolQS;
      console.debug('[tags/create] fetchSubjects ->', { endpoint });
      const res = await fetch(endpoint);
      const data = await res.json();
      console.debug('[tags/create] fetchSubjects <-', { ok: res.ok, status: res.status, count: Array.isArray(data?.subjects) ? data.subjects.length : undefined });
      if (data.success) {
        setAllSubjects(data.subjects);
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to load subjects for assignment.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('[tags/create] fetchSubjects error', err);
      toast({
        title: "Network Error",
        description: "Could not load subjects due to a network issue.",
        variant: "destructive",
      });
    } finally {
      setSubjectsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTagTypes();
    fetchSubjects();
  }, [fetchTagTypes, fetchSubjects]);

  const handleCreateNewTag = useCallback(
    async (tagName: string, typeId: string, subjectIds: string[]): Promise<TagItem | null> => {
      try {
        const endpoint = '/api/tags'+schoolQS+'';
        const payload = { name: tagName, type: typeId, subjectIds };
        console.debug('[tags/create] POST /api/tags ->', { endpoint, payload });
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.debug('[tags/create] POST /api/tags <-', { ok: res.ok, status: res.status, data });
        if (data.success) {
          toast({
            title: "Tag Created",
            description: `"${data.tag.name}" (Type: ${data.tag.type.name}) has been added.`,
          });
          return data.tag;
        } else {
          console.warn('[tags/create] tag create responded with error', data);
          toast({ title: "Creation Failed", description: data.message, variant: "destructive" });
          return null;
        }
      } catch (err) {
        console.error('[tags/create] POST /api/tags network error', err);
        toast({ title: "Network Error", description: "Failed to create tag.", variant: "destructive" });
        return null;
      }
    },
    [toast]
  );

  const handleSelectSubject = (subject: Subject) => {
    setSelectedSubjects((prev) => {
      if (!prev.some((s) => s._id === subject._id)) {
        return [...prev, subject];
      }
      return prev;
    });
    setSubjectSearchInput('');
    setSubjectSearchOpen(false);
  };

  const handleDeselectSubject = (subjectToRemove: Subject) => {
    setSelectedSubjects((prev) => prev.filter((s) => s._id !== subjectToRemove._id));
  };

  const handleCreateAndAssignTag = async () => {
    if (!newTagName.trim() || !selectedTagTypeId) {
      toast({ title: "Validation Error", description: "Tag Name and Type are required.", variant: "destructive" });
      return;
    }

    setIsCreatingTag(true);
    try {
      console.debug('[tags/create] handleCreateAndAssignTag start', {
        newTagName,
        selectedTagTypeId,
        selectedSubjects: selectedSubjects.map(s => s._id)
      });
      const createdTag = await handleCreateNewTag(
        newTagName,
        selectedTagTypeId,
        selectedSubjects.map(s => s._id)
      );

      if (!createdTag) return;

      if (selectedSubjects.length > 0) {
        let successCount = 0;
        let failCount = 0;

        const currentSubjectsRes = await fetch('/api/subjects'+schoolQS);
        const currentSubjectsData = await currentSubjectsRes.json();
        console.debug('[tags/create] refresh subjects after create', { ok: currentSubjectsRes.ok, status: currentSubjectsRes.status, count: currentSubjectsData?.subjects?.length });

        if (!currentSubjectsData.success) {
            toast({
                title: "Assignment Interrupted",
                description: "Could not fetch current subject data to assign tag. Please try again.",
                variant: "destructive",
            });
            return;
        }
        const currentSubjects = currentSubjectsData.subjects as Subject[];

        for (const selectedSubject of selectedSubjects) {
          const currentSubject = currentSubjects.find(s => s._id === selectedSubject._id);
          if (!currentSubject) {
            failCount++;
            continue;
          }

          const currentTagIds = (currentSubject.tags || []).map(t => t._id);
          const updatedTagIds = currentTagIds.includes(createdTag._id)
            ? currentTagIds
            : [...currentTagIds, createdTag._id];

          try {
            const endpoint = `/api/subjects/${currentSubject._id}`;
            console.debug('[tags/create] PATCH subject assign ->', { endpoint, tagIds: updatedTagIds.length });
            const res = await fetch(endpoint, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tags: updatedTagIds }),
            });
            const data = await res.json();
            console.debug('[tags/create] PATCH subject assign <-', { ok: res.ok, status: res.status, subjectId: currentSubject._id, success: data?.success });
            if (data.success) {
              successCount++;
            } else {
              failCount++;
            }
          } catch (err) {
            console.error('[tags/create] PATCH subject assign error', { subjectId: currentSubject._id, err });
            failCount++;
          }
        }

        console.debug('[tags/create] assignment finished', { successCount, failCount });
        if (successCount > 0) {
          toast({
            title: "Tag Assignment Complete",
            description: `${successCount} subject(s) were successfully updated with "${createdTag.name}". ${failCount > 0 ? `${failCount} failed.` : ''}`,
          });
        } else if (failCount > 0) {
          toast({
            title: "Assignment Failed",
            description: `Tag "${createdTag.name}" could not be assigned to any selected subjects.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Tag Created",
          description: `Tag "${createdTag.name}" created successfully (no subjects were assigned).`,
        });
      }
    } catch (err) {
        console.error('[tags/create] handleCreateAndAssignTag error', err);
        toast({
            title: "Operation Failed",
            description: "An unexpected error occurred.",
            variant: "destructive",
        });
    } finally {
      console.debug('[tags/create] handleCreateAndAssignTag cleanup');
      setIsCreatingTag(false);
      setNewTagName('');
      setSelectedTagTypeId('');
      setSelectedSubjects([]);
      fetchTagTypes();
    }
  };

  const filteredAvailableSubjects = allSubjects.filter(
    (subject) =>
      !selectedSubjects.some((s) => s._id === subject._id) &&
      subject.name.toLowerCase().includes(subjectSearchInput.toLowerCase())
  );

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
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-3xl mx-auto space-y-8 py-8 px-4 sm:px-6 lg:px-8">
          <div className="space-y-2">
            <Button
              variant="ghost"
              onClick={() => router.push('/tags')}
              className="text-sm text-muted-foreground hover:text-foreground -ml-4"
              disabled={isCreatingTag}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Tags
            </Button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create a New Tag
            </h1>
            <p className="text-muted-foreground">
              Define a new tag, choose its type, and optionally assign it to existing subjects.
            </p>
          </div>

          <Card className="border-border/40">
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tagName" className="font-semibold">Tag Name</Label>
                  <Input
                    id="tagName"
                    placeholder="e.g., Algebra, Beginner, Art History"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="h-10"
                    aria-label="Tag Name"
                    required
                    disabled={isCreatingTag}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagTypeSelect" className="font-semibold">Tag Type</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      onValueChange={setSelectedTagTypeId}
                      value={selectedTagTypeId}
                      disabled={isCreatingTag || tagTypesLoading}
                    >
                      <SelectTrigger id="tagTypeSelect" className="w-full h-10">
                        <SelectValue placeholder={tagTypesLoading ? "Loading types..." : "Select a type"} />
                      </SelectTrigger>
                      <SelectContent>
                        {tagTypes.map((type) => (
                          <SelectItem key={type._id} value={type._id} className="capitalize">
                            {type.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setIsModalOpen(true)} disabled={isCreatingTag} className="h-10 w-10 flex-shrink-0">
                      <PlusCircle className="h-4 w-4" />
                      <span className="sr-only">Create new tag type</span>
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Assign to Subjects</h3>
                    <p className="text-sm text-muted-foreground">Select subjects this new tag should be associated with. Existing tags will be preserved.</p>
                </div>

                <Popover open={subjectSearchOpen} onOpenChange={setSubjectSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-10 px-3 flex items-center"
                      aria-expanded={subjectSearchOpen}
                      disabled={isCreatingTag || subjectsLoading}
                    >
                      {subjectsLoading ? (
                          <div className="flex items-center text-muted-foreground">
                              <Spinner /> <span className="ml-2">Loading subjects...</span>
                          </div>
                      ) : selectedSubjects.length > 0 ? (
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          {selectedSubjects.slice(0, 2).map((subject) => (
                            <Badge
                              key={subject._id}
                              variant="secondary"
                              className="py-1 px-2 rounded-md whitespace-nowrap"
                            >
                              {subject.name}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeselectSubject(subject);
                                }}
                                className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                aria-label={`Remove ${subject.name}`}
                              >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </button>
                            </Badge>
                          ))}
                          {selectedSubjects.length > 2 && (
                            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                              + {selectedSubjects.length - 2} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Select subjects...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search subjects..."
                        value={subjectSearchInput}
                        onValueChange={setSubjectSearchInput}
                        ref={subjectInputRef}
                        disabled={isCreatingTag}
                      />
                      <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup>
                          {filteredAvailableSubjects.map((subject) => (
                            <CommandItem
                              key={subject._id}
                              value={subject.name}
                              onSelect={() => handleSelectSubject(subject)}
                              className="cursor-pointer"
                              disabled={isCreatingTag}
                            >
                              <Checkbox
                                  checked={selectedSubjects.some((s) => s._id === subject._id)}
                                  className="mr-2"
                              />
                              <span>{subject.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <Separator />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => router.push('/tags')}
              variant="outline"
              className="h-11"
              disabled={isCreatingTag}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAndAssignTag}
              disabled={isCreatingTag || !newTagName.trim() || !selectedTagTypeId}
              className="h-11 font-semibold"
            >
              {isCreatingTag ? <div className="mr-2"><Spinner /></div> : null}
              Create Tag
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}