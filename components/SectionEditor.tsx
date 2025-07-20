import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { SectionTagSummary } from '@/components/SectionTagSummary';
import { Textarea } from '@/components/ui/textarea';

interface Section {
  id: string;
  name: string;
  description: string;
  defaultMarks: number | undefined;
  defaultNegativeMarks: number | undefined;
  questions: any[];
}

export function SectionEditor({
  section,
  onUpdate,
  onRemove,
  onAddQuestions,
  canAddQuestions,
  sectionTotalMarks,
  children
}: {
  section: Section;
  onUpdate: (field: string, value: any) => void;
  onRemove: () => void;
  onAddQuestions: () => void;
  canAddQuestions: boolean;
  sectionTotalMarks: number;
  children?: React.ReactNode;
}) {
  return (
    <>
      {/* Section Header Controls */}
      <div className="space-y-4 bg-muted/30 p-4 border-b">
        {/* Top row: Name, Question Count, and Remove button */}
        <div className="flex items-center justify-between gap-4">
          <Input
            value={section.name}
            onChange={e => onUpdate('name', e.target.value)}
            className="text-lg font-bold border-0 shadow-none p-1 h-auto focus-visible:ring-1 bg-transparent flex-1"
            aria-label="Section name"
            placeholder="Untitled Section"
          />
          <div className="flex items-center gap-4">
            <span className="inline-block px-2 py-1 rounded bg-muted text-xs font-semibold text-muted-foreground whitespace-nowrap">
              {section.questions.length} {section.questions.length === 1 ? 'Question' : 'Questions'}
            </span>
            <Button variant="ghost" size="icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Description Textarea */}
        <Textarea
          value={section.description}
          onChange={e => onUpdate('description', e.target.value)}
          placeholder="Optional: Add a description or instructions for this section..."
          className="text-sm bg-background"
          rows={2}
        />

        {/* Bottom row: Tag Summary and Marks inputs */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1">
            <SectionTagSummary section={section} />
          </div>
          <div className="flex items-center gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Default Marks</Label>
              <Input
                type="number"
                min={1}
                value={section.defaultMarks ?? ''}
                onChange={e => onUpdate('defaultMarks', e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-24 h-8"
                aria-label="Default marks"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Default Negative</Label>
              <Input
                type="number"
                min={0}
                value={section.defaultNegativeMarks ?? ''}
                onChange={e => onUpdate('defaultNegativeMarks', e.target.value === '' ? undefined : Number(e.target.value))}
                className="w-24 h-8"
                aria-label="Default negative marks"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section Content and Actions */}
      <div className="p-4">
        {children}
        <div className="mt-4 flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddQuestions}
            disabled={!canAddQuestions}
          >
            <Plus className="mr-2 h-4 w-4" /> Add / Manage Questions
          </Button>
          {!canAddQuestions && (
            <span className="text-xs text-destructive ml-2">
              Set section name & default marks to add questions.
            </span>
          )}
          <span className="text-sm font-semibold text-muted-foreground ml-auto">
            Section Total: {sectionTotalMarks} Marks
          </span>
        </div>
      </div>
    </>
  );
}