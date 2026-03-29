"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableCommandOption = {
  value: string;
  label: string;
  description?: string;
  keywords?: string[];
};

type SearchableCommandSelectProps = {
  value: string;
  options: SearchableCommandOption[];
  onValueChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearLabel?: string;
  onClear?: () => void;
  closeLabel?: string;
  showCloseAction?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

export function SearchableCommandSelect({
  value,
  options,
  onValueChange,
  onOpenChange,
  placeholder,
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  clearLabel = "Clear",
  onClear,
  closeLabel = "Done",
  showCloseAction = false,
  triggerClassName,
  contentClassName,
}: SearchableCommandSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const showFooterActions = Boolean(onClear) || showCloseAction;

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [open]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange?.(nextOpen);
        if (!nextOpen) {
          setSearchValue("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "app-filter-select-trigger",
            triggerClassName,
          )}
        >
          <span
            className={cn(
              "truncate",
              !selectedOption && "font-normal text-muted-foreground",
            )}
          >
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "app-selection-popover w-[--radix-popover-trigger-width] p-0",
          contentClassName,
        )}
        align="start"
      >
        <Command className="flex min-h-0 flex-1 flex-col rounded-none bg-transparent">
          <CommandInput
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="min-h-0 flex-1">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={[
                    option.label,
                    option.description,
                    option.value,
                    ...(option.keywords || []),
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  className="cursor-pointer rounded-xl border border-transparent px-3 py-2.5 data-[selected=true]:border-primary/18 data-[selected=true]:bg-primary/5 data-[selected=true]:text-foreground"
                >
                  <Check
                    className={cn(
                      "h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="text-[12px] leading-5 text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {showFooterActions ? (
          <div className="app-selection-popover-footer">
            <p className="app-selection-summary">
              {selectedOption?.label || placeholder}
            </p>
            <div className="app-selection-popover-actions">
              {onClear ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="app-button-compact"
                  onClick={() => {
                    onClear();
                    setSearchValue("");
                  }}
                  disabled={disabled}
                >
                  {clearLabel}
                </Button>
              ) : null}
              {showCloseAction ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="app-button-compact"
                  onClick={() => {
                    setOpen(false);
                    setSearchValue("");
                  }}
                >
                  {closeLabel}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
