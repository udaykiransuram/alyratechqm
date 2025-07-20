// components/ui/multi-select-tags.tsx
'use client';

import * as React from 'react';
import { PlusCircle, Tag as TagIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/components/ui/use-toast';
import { Spinner } from '@/components/ui/spinner';
import { CreateTagTypeModal } from '../CreateTagTypeModal';
import { Label } from './label';

export interface TagType {
  _id: string;
  name: string;
}

export interface TagItem {
  _id: string;
  name: string;
  type: TagType;
}

interface MultiSelectTagsProps {
  selectedTags: TagItem[];
  allTags: TagItem[];
  onSelectedTagsChange: (selected: TagItem[]) => void;
  onCreateNewTag?: (tagName: string, typeId: string) => Promise<TagItem | null>;
  isLoading?: boolean;
  recommendedTagIds?: string[];
  disabled?: boolean; // --- FIX: Add a disabled prop ---
}

export function MultiSelectTags({
  selectedTags,
  allTags,
  onSelectedTagsChange,
  onCreateNewTag,
  isLoading,
  recommendedTagIds = [],
  disabled = false, // --- FIX: Set default value for the disabled prop ---
}: MultiSelectTagsProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [selectedTypeIdFilter, setSelectedTypeIdFilter] = React.useState('all');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState('');
  const [newTagTypeId, setNewTagTypeId] = React.useState('');
  const [isCreatingNewTag, setIsCreatingNewTag] = React.useState(false);

  const [tagTypes, setTagTypes] = React.useState<TagType[]>([]);
  const [isTagTypeModalOpen, setIsTagTypeModalOpen] = React.useState(false);

  const { toast } = useToast();

  React.useEffect(() => {
    const fetchTagTypes = async () => {
      try {
        const res = await fetch('/api/tag-types');
        const data = await res.json();
        if (data.success) setTagTypes(data.tagTypes);
      } catch (error) {
        console.error("Failed to fetch tag types.");
      }
    };
    fetchTagTypes();
  }, []);

  const uniqueTagTypesForFilter = React.useMemo(() => {
    const typeMap = new Map<string, TagType>();
    allTags.forEach(tag => {
      if (tag.type) typeMap.set(tag.type._id, tag.type);
    });
    return Array.from(typeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allTags]);

  const { recommendedTags, otherTags } = React.useMemo(() => {
    const recommended = new Set(recommendedTagIds);
    const selected = new Set(selectedTags.map(t => t._id));
    const recs: TagItem[] = [];
    const others: TagItem[] = [];
    const searchInput = inputValue.toLowerCase();

    allTags.forEach(tag => {
      // Skip tags that are already selected
      if (selected.has(tag._id)) return;

      // --- FIX: A simpler, more robust search logic ---
      
      // 1. Check if the tag matches the dropdown filter
      const matchesTypeFilter = selectedTypeIdFilter === 'all' || (tag.type && tag.type._id === selectedTypeIdFilter);

      // 2. Create a single searchable string for the tag
      const searchableText = `${tag.name} ${tag.type ? tag.type.name : ''}`.toLowerCase();
      
      // 3. Check if the tag matches the search input
      const matchesSearch = searchInput ? searchableText.includes(searchInput) : true;

      // Add the tag if it matches both filters
      if (matchesTypeFilter && matchesSearch) {
        if (recommended.has(tag._id)) {
          recs.push(tag);
        } else {
          others.push(tag);
        }
      }
    });

    return { recommendedTags: recs, otherTags: others };
  }, [allTags, selectedTags, inputValue, selectedTypeIdFilter, recommendedTagIds]);

  const handleSelect = (tag: TagItem) => {
    onSelectedTagsChange([...selectedTags, tag]);
    setInputValue('');
    setShowCreateForm(false);
  };

  const handleDeselect = (tagToRemove: TagItem) => {
    onSelectedTagsChange(selectedTags.filter((tag) => tag._id !== tagToRemove._id));
  };

  const handleConfirmCreateNewTag = async () => {
    if (!newTagName.trim() || !newTagTypeId) {
      toast({ title: "Validation Error", description: "Tag name and type are required.", variant: "destructive" });
      return;
    }
    if (!onCreateNewTag) return;
    setIsCreatingNewTag(true);
    try {
      const newTag = await onCreateNewTag(newTagName.trim(), newTagTypeId);
      if (newTag) {
        handleSelect(newTag);
        toast({ title: "Tag Created", description: `Successfully created and selected: "${newTag.name}".` });
        setOpen(false);
      }
    } finally {
      setIsCreatingNewTag(false);
    }
  };

  const isNewTagCandidate = React.useMemo(() => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput) return false;
    return !allTags.some(tag => tag.name.toLowerCase() === trimmedInput.toLowerCase());
  }, [inputValue, allTags]);

  return (
    <>
      <CreateTagTypeModal
        open={isTagTypeModalOpen}
        onClose={() => setIsTagTypeModalOpen(false)}
        onTagTypeCreated={(newType) => {
          setTagTypes(prev => [...prev, newType].sort((a, b) => a.name.localeCompare(b.name)));
          setNewTagTypeId(newType._id);
        }}
      />

      {/* --- FIX: The entire component is now the Popover and its trigger --- */}
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setShowCreateForm(false);
          setInputValue('');
        }
      }}>
        {/* --- FIX: Pass the disabled state to the trigger --- */}
        <PopoverTrigger asChild disabled={disabled}>
          <div
            className={cn(
              "flex flex-wrap gap-2 items-center min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
              "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
              // --- FIX: Add styles for the disabled state ---
              disabled ? "cursor-not-allowed opacity-50" : "cursor-text"
            )}
            onClick={() => !disabled && setOpen(true)}
          >
            {selectedTags.map((tag) => (
              <Badge key={tag._id} variant="secondary" className="py-1 px-2.5 rounded-md">
                {tag.type?.name ? `${tag.type.name}: ` : ''}
                {tag.name}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeselect(tag); }}
                  className="ml-2 rounded-full outline-none"
                  aria-label={`Remove ${tag.name}`}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            ))}
            {/* --- FIX: Add a persistent button to open the selection popover --- */}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-muted-foreground hover:text-accent-blue"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              disabled={disabled}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              {selectedTags.length > 0 ? 'Add' : 'Select tags...'}
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent forceMount className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-2 py-2 gap-2">
              <CommandInput
                placeholder="Search or create..."
                value={inputValue}
                onValueChange={setInputValue}
                ref={inputRef}
                className="h-9 flex-1 border-none focus:ring-0"
              />
              <Select value={selectedTypeIdFilter} onValueChange={setSelectedTypeIdFilter}>
                <SelectTrigger className="w-auto h-9 text-xs px-2 border-none">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueTagTypesForFilter.map(type => (
                    <SelectItem key={type._id} value={type._id} className="capitalize">{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CommandList className="h-[300px] overflow-y-auto">
              <CommandEmpty>
                {isNewTagCandidate && onCreateNewTag ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No tag named &quot;{inputValue}&quot;.
                    <Button variant="link" className="h-auto p-0 text-accent-blue mt-1" onClick={() => { setShowCreateForm(true); setNewTagName(inputValue); }}>
                      <PlusCircle className="mr-1 h-4 w-4" /> Create it now
                    </Button>
                  </div>
                ) : 'No tags found.'}
              </CommandEmpty>
              {showCreateForm ? (
                <div className="p-3 border-t">
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-foreground">Create New Tag</h4>
                    <input
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Tag Name"
                    />
                    <div className="flex items-center gap-2">
                      <Select value={newTagTypeId} onValueChange={setNewTagTypeId}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Select a type" /></SelectTrigger>
                        <SelectContent>
                          {tagTypes.map(type => (<SelectItem key={type._id} value={type._id} className="capitalize">{type.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={() => setIsTagTypeModalOpen(true)} className="h-9 w-9 flex-shrink-0">
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                      <Button type="button" size="sm" onClick={handleConfirmCreateNewTag} disabled={isCreatingNewTag}>
                        {isCreatingNewTag && <span className="mr-2 h-4 w-4"><Spinner /></span>} Create
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {recommendedTags.length > 0 && (
                    <CommandGroup heading="Recommended">
                      {recommendedTags.map((tag) => (
                        <CommandItem key={tag._id} value={tag.name} onSelect={() => handleSelect(tag)} className="cursor-pointer">
                          <TagIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{tag.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground/80 capitalize">{tag.type.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  <CommandGroup heading={recommendedTags.length > 0 ? "Other Tags" : "All Tags"}>
                    {otherTags.map((tag) => (
                      <CommandItem key={tag._id} value={tag.name} onSelect={() => handleSelect(tag)} className="cursor-pointer">
                        <TagIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>{tag.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground/80 capitalize">{tag.type.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}