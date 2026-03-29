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
  children,
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
      <div className="space-y-3.5 border-b border-border/60 bg-muted/20 px-4 py-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <Input
            value={section.name}
            onChange={e => onUpdate('name', e.target.value)}
            className="h-auto flex-1 border-0 bg-transparent px-0 py-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            aria-label="Section name"
            placeholder="Untitled Section"
          />
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {section.questions.length} {section.questions.length === 1 ? 'Question' : 'Questions'}
            </span>
            <Button variant="ghost" size="icon" className="app-button-compact-icon" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        <Textarea
          value={section.description}
          onChange={e => onUpdate('description', e.target.value)}
          placeholder="Optional: Add a description or instructions for this section..."
          className="min-h-[80px] bg-background"
          rows={3}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <SectionTagSummary section={section} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-auto">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Default Marks</Label>
              <Input
                type="number"
                min={1}
                value={section.defaultMarks ?? ''}
                onChange={e => onUpdate('defaultMarks', e.target.value === '' ? undefined : Number(e.target.value))}
                className="h-9 w-full sm:w-24"
                aria-label="Default marks"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Default Negative</Label>
              <Input
                type="number"
                min={0}
                value={section.defaultNegativeMarks ?? ''}
                onChange={e => onUpdate('defaultNegativeMarks', e.target.value === '' ? undefined : Number(e.target.value))}
                className="h-9 w-full sm:w-24"
                aria-label="Default negative marks"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3.5 px-4 py-3.5">
        {children}
        <div className="flex flex-col gap-3 border-t border-border/60 pt-3.5 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            className="app-button-inline"
            onClick={onAddQuestions}
            disabled={!canAddQuestions}
          >
            <Plus className="h-4 w-4" />
            Add / Manage Questions
          </Button>
          {!canAddQuestions ? (
            <span className="text-xs text-destructive">
              Complete section setup to manage questions.
            </span>
          ) : null}
          <span className="sm:ml-auto text-sm font-semibold text-muted-foreground">
            Section Total: {sectionTotalMarks} Marks
          </span>
        </div>
      </div>
    </>
  );
}
