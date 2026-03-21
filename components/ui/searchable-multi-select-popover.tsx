"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type SearchableCommandOption } from "@/components/ui/searchable-command-select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type SearchableMultiSelectPopoverProps = {
  selectedValues: string[];
  options: SearchableCommandOption[];
  onSelectedValuesChange: (values: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  loadingText?: string;
  noOptionsText?: string;
  disabled?: boolean;
  closeOnSelect?: boolean;
  maxVisibleBadges?: number;
  triggerClassName?: string;
  contentClassName?: string;
};

export function SearchableMultiSelectPopover({
  selectedValues,
  options,
  onSelectedValuesChange,
  placeholder,
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  loading = false,
  loadingText = "Loading...",
  noOptionsText = "No options available.",
  disabled = false,
  closeOnSelect = false,
  maxVisibleBadges = 2,
  triggerClassName,
  contentClassName,
}: SearchableMultiSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const selectedOptions = useMemo(
    () => selectedValues
      .map((value) => options.find((option) => option.value === value))
      .filter((option): option is SearchableCommandOption => Boolean(option)),
    [options, selectedValues],
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

  const toggleValue = (value: string) => {
    const nextValues = selectedSet.has(value)
      ? selectedValues.filter((item) => item !== value)
      : [...selectedValues, value];

    onSelectedValuesChange(nextValues);

    if (closeOnSelect) {
      setOpen(false);
      setSearchValue("");
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearchValue("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || loading}
          className={cn(
            "flex h-10 w-full items-center justify-start px-3 text-left font-normal",
            triggerClassName,
          )}
          aria-expanded={open}
        >
          {loading ? (
            <div className="flex items-center text-muted-foreground">
              <Spinner />
              <span className="ml-2">{loadingText}</span>
            </div>
          ) : options.length === 0 ? (
            <span className="text-muted-foreground">{noOptionsText}</span>
          ) : selectedOptions.length > 0 ? (
            <div className="flex items-center gap-1.5 overflow-hidden">
              {selectedOptions.slice(0, maxVisibleBadges).map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="whitespace-nowrap rounded-md px-2 py-1"
                >
                  {option.label}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleValue(option.value);
                    }}
                    className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={`Remove ${option.label}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ))}
              {selectedOptions.length > maxVisibleBadges ? (
                <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
                  + {selectedOptions.length - maxVisibleBadges} more
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[--radix-popover-trigger-width] p-0", contentClassName)}
        align="start"
      >
        <Command>
          <CommandInput
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
            disabled={disabled || loading}
          />
          <CommandList>
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
                  onSelect={() => toggleValue(option.value)}
                  className="cursor-pointer"
                  disabled={disabled || loading}
                >
                  <Checkbox
                    checked={selectedSet.has(option.value)}
                    className="mr-2"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span>{option.label}</span>
                    {option.description ? (
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
