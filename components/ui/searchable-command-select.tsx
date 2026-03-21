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
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

export function SearchableCommandSelect({
  value,
  options,
  onValueChange,
  placeholder,
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  disabled = false,
  triggerClassName,
  contentClassName,
}: SearchableCommandSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
            "h-11 w-full justify-between rounded-xl px-3.5 text-left font-normal",
            triggerClassName,
          )}
        >
          <span className="truncate">
            {selectedOption?.label || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  className="cursor-pointer"
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
