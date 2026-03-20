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
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-border/70 bg-background/85 p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {visibleSelectedCount} of {items.length} {countLabel}
        </div>
        {items.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={allSelected ? clearAll : selectAll}
              disabled={selectableIds.length === 0}
            >
              {allSelected ? "Unselect all" : "Select all"}
            </Button>
            <Button
              variant="outline"
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
            "max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 bg-background p-2.5",
            listClassName,
          )}
        >
          {items.map((item) => {
            const checked = selectedSet.has(item.id);
            return (
              <label
                key={item.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm text-foreground transition-all duration-200",
                  checked
                    ? "border-primary/25 bg-primary/5 shadow-sm"
                    : "border-transparent hover:border-border/60 hover:bg-accent/45",
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
