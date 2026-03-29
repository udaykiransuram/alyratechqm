"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";

import { Upload } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FilePickerFieldProps = {
  id: string;
  label: string;
  accept?: string;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  selectedFileName?: string | null;
  className?: string;
};

export default function FilePickerField({
  id,
  label,
  accept,
  disabled = false,
  onChange,
  placeholder = "No file selected",
  selectedFileName,
  className,
}: FilePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalFileName, setInternalFileName] = useState("");

  const fileName = selectedFileName ?? internalFileName;

  const handleKeyboardTrigger = (event: KeyboardEvent<HTMLLabelElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            setInternalFileName(event.target.files?.[0]?.name || "");
            onChange(event);
          }}
        />
        <label
          htmlFor={id}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onKeyDown={handleKeyboardTrigger}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full shrink-0 sm:w-auto",
            disabled
              ? "cursor-not-allowed pointer-events-none opacity-45"
              : "cursor-pointer",
          )}
        >
          <Upload className="h-4 w-4" />
          <span>Choose file</span>
        </label>
        <div
          className={cn(
            "flex min-h-9 min-w-0 flex-1 items-center rounded-[var(--app-radius-md)] border border-border/70 bg-[hsl(var(--app-surface-1)/0.82)] px-3.5 text-sm shadow-[0_14px_24px_-28px_hsl(var(--app-shadow-deep)/0.08)]",
            fileName ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span className="truncate">{fileName || placeholder}</span>
        </div>
      </div>
    </div>
  );
}
