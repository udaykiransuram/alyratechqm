import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TagItem } from '@/components/ui/multi-select-tags';

export function TagSelector({ allTags, selectedTags, setSelectedTags }: {
  allTags: TagItem[];
  selectedTags: TagItem[];
  setSelectedTags: (tags: TagItem[]) => void;
}) {
  return (
    <div>
      <Label className="font-semibold">Tags</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {selectedTags.length > 0 ? (
          selectedTags.map(tag => (
            <Badge key={tag._id} variant="secondary">
              {tag.name}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">No tags selected</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {allTags.map(tag => (
          <Button
            key={tag._id}
            variant={selectedTags.some(t => t._id === tag._id) ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedTags(
                selectedTags.some(t => t._id === tag._id)
                  ? selectedTags.filter(t => t._id !== tag._id)
                  : [...selectedTags, tag]
              );
            }}
          >
            {tag.name}
          </Button>
        ))}
      </div>
    </div>
  );
}