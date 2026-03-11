"use client";

import { ReactNode, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type MultiSelectChecklistItem = {
  id: string;
  label: ReactNode;
  disabled?: boolean;
};

interface MultiSelectChecklistProps {
  items: MultiSelectChecklistItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  emptyContent?: ReactNode;
  helperText?: ReactNode;
  className?: string;
  listClassName?: string;
  itemClassName?: string;
  countLabel?: string;
}

export default function MultiSelectChecklist({
  items,
  selectedIds,
  onChange,
  emptyContent,
  helperText,
  className,
  listClassName,
  itemClassName,
  countLabel = "selected",
}: MultiSelectChecklistProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visibleSelectedCount = items.filter((item) => selectedSet.has(item.id)).length;
  const selectableItems = items.filter((item) => !item.disabled);
  const selectableIds = selectableItems.map((item) => item.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedSet.has(id));

  const toggleItem = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((value) => value !== id));
      return;
    }
    onChange([...selectedIds, id]);
  };

  const selectAll = () => {
    onChange(selectableIds);
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className={cn("space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
        <div className="text-xs font-medium text-muted-foreground">
          {visibleSelectedCount} of {items.length} {countLabel}
        </div>
        {items.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={allSelected ? clearAll : selectAll}
              disabled={selectableIds.length === 0}
            >
              {allSelected ? "Unselect all" : "Select all"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={visibleSelectedCount === 0}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-background/70 px-3 py-4 text-sm text-muted-foreground">
          {emptyContent || "No options available."}
        </div>
      ) : (
        <div
          className={cn(
            "max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/60 bg-background p-2",
            listClassName,
          )}
        >
          {items.map((item) => {
            const checked = selectedSet.has(item.id);
            return (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-sm text-foreground transition-colors hover:bg-muted/40",
                  item.disabled ? "cursor-not-allowed opacity-60" : "",
                  itemClassName,
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={item.disabled}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="mt-0.5"
                />
                <span className="leading-5">{item.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {helperText ? <p className="px-1 text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
