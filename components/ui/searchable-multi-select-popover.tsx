"use client";

import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  defaultVisibleOptions?: number;
  clearLabel?: string;
  doneLabel?: string;
  showDoneAction?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

type SearchableMultiSelectOptionRowProps = {
  option: SearchableCommandOption;
  isSelected: boolean;
  disabled: boolean;
  onToggle: (value: string) => void;
};

function areStringArraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function handleBadgeRemoveKeyDown(
  event: React.KeyboardEvent<HTMLSpanElement>,
  onRemove: () => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  }
}

const SearchableMultiSelectOptionRow = memo(function SearchableMultiSelectOptionRow({
  option,
  isSelected,
  disabled,
  onToggle,
}: SearchableMultiSelectOptionRowProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(option.value)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
        isSelected
          ? "border-primary/25 bg-primary/5 text-foreground shadow-sm"
          : "border-transparent hover:border-border/60 hover:bg-accent/45 hover:text-accent-foreground",
      )}
      role="option"
      aria-selected={isSelected}
      disabled={disabled}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors",
          isSelected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-primary/50 bg-background text-transparent",
        )}
        aria-hidden="true"
      >
        <Check className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate">{option.label}</div>
        {option.description ? (
          <div className="truncate text-xs text-muted-foreground">
            {option.description}
          </div>
        ) : null}
      </div>
    </button>
  );
});

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
  defaultVisibleOptions = 24,
  clearLabel = "Clear",
  doneLabel = "Done",
  showDoneAction = true,
  triggerClassName,
  contentClassName,
}: SearchableMultiSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [optimisticSelectedValues, setOptimisticSelectedValues] = useState(selectedValues);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optimisticSelectedValuesRef = useRef(selectedValues);
  const onSelectedValuesChangeRef = useRef(onSelectedValuesChange);
  const closeOnSelectRef = useRef(closeOnSelect);
  const deferredSearchValue = useDeferredValue(searchValue);

  useEffect(() => {
    optimisticSelectedValuesRef.current = selectedValues;
    setOptimisticSelectedValues((currentValues) =>
      areStringArraysEqual(currentValues, selectedValues) ? currentValues : selectedValues,
    );
  }, [selectedValues]);

  useEffect(() => {
    onSelectedValuesChangeRef.current = onSelectedValuesChange;
  }, [onSelectedValuesChange]);

  useEffect(() => {
    closeOnSelectRef.current = closeOnSelect;
  }, [closeOnSelect]);

  const selectedSet = useMemo(() => new Set(optimisticSelectedValues), [optimisticSelectedValues]);
  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );
  const selectedOptions = useMemo(
    () =>
      optimisticSelectedValues
        .map((value) => optionMap.get(value))
        .filter((option): option is SearchableCommandOption => Boolean(option)),
    [optionMap, optimisticSelectedValues],
  );

  const filteredOptions = useMemo(() => {
    const query = deferredSearchValue.trim().toLowerCase();
    if (!query) return options;

    return options.filter((option) =>
      [
        option.label,
        option.description,
        option.value,
        ...(option.keywords || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [deferredSearchValue, options]);

  const hasSearchQuery = deferredSearchValue.trim().length > 0;
  const visibleOptions = useMemo(() => {
    if (hasSearchQuery) {
      return filteredOptions;
    }

    const selectedOptionsFirst = filteredOptions.filter((option) =>
      selectedSet.has(option.value),
    );
    const remainingOptions = filteredOptions.filter((option) =>
      !selectedSet.has(option.value),
    );

    return [
      ...selectedOptionsFirst,
      ...remainingOptions.slice(
        0,
        Math.max(defaultVisibleOptions - selectedOptionsFirst.length, 0),
      ),
    ];
  }, [defaultVisibleOptions, filteredOptions, hasSearchQuery, selectedSet]);

  const hiddenOptionCount = Math.max(filteredOptions.length - visibleOptions.length, 0);

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

  const toggleValue = useCallback((value: string) => {
    const currentValues = optimisticSelectedValuesRef.current;
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((item) => item !== value)
      : [...currentValues, value];

    optimisticSelectedValuesRef.current = nextValues;
    setOptimisticSelectedValues(nextValues);
    startTransition(() => {
      onSelectedValuesChangeRef.current(nextValues);
    });

    if (closeOnSelectRef.current) {
      setOpen(false);
      setSearchValue("");
    }
  }, []);

  const clearValues = useCallback(() => {
    optimisticSelectedValuesRef.current = [];
    setOptimisticSelectedValues([]);
    startTransition(() => {
      onSelectedValuesChangeRef.current([]);
    });
    setSearchValue("");
  }, []);

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
            "app-multi-select-trigger min-h-10 justify-start px-3 text-left font-normal",
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
                  className="app-selection-badge whitespace-nowrap border-transparent"
                >
                  {option.label}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      toggleValue(option.value);
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) =>
                      handleBadgeRemoveKeyDown(event, () => toggleValue(option.value))
                    }
                    className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={`Remove ${option.label}`}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </span>
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
        className={cn("app-selection-popover", contentClassName)}
        align="start"
      >
        <div className="border-b border-border/60 p-3">
          <Input
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            disabled={disabled || loading}
            className="h-10"
          />
        </div>
        {loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Spinner />
            <span className="ml-2">{loadingText}</span>
          </div>
        ) : options.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {noOptionsText}
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          <div
            className="app-scroll-area max-h-[320px] overflow-y-auto overscroll-contain p-1.5 pr-1"
            role="listbox"
            aria-multiselectable="true"
            onWheelCapture={(event) => {
              event.stopPropagation();
            }}
          >
            {!hasSearchQuery && hiddenOptionCount > 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Showing {visibleOptions.length} of {filteredOptions.length} options. Search to
                find the remaining {hiddenOptionCount}.
              </div>
            ) : null}
            {visibleOptions.map((option) => (
              <SearchableMultiSelectOptionRow
                key={option.value}
                option={option}
                isSelected={selectedSet.has(option.value)}
                disabled={disabled}
                onToggle={toggleValue}
              />
            ))}
          </div>
        )}
        <div className="app-selection-popover-footer">
          <p className="app-selection-summary">
            {optimisticSelectedValues.length === 0
              ? "No filters selected"
              : `${optimisticSelectedValues.length} selected`}
          </p>
          <div className="app-selection-popover-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="app-button-compact"
              onClick={clearValues}
              disabled={disabled || optimisticSelectedValues.length === 0}
            >
              {clearLabel}
            </Button>
            {showDoneAction ? (
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
                {doneLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
