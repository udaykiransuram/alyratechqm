import type { ChangeEventHandler, ReactNode } from "react";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
import FilePickerField from "@/components/ui/file-picker-field";
import { cn } from "@/lib/utils";

type BulkUploadPanelProps = {
  id?: string;
  title: string;
  description?: string;
  inputId: string;
  accept?: string;
  loading?: boolean;
  loadingLabel?: string;
  onFileChange: ChangeEventHandler<HTMLInputElement>;
  onDownloadTemplate?: () => void;
  templateLabel?: string;
  feedback?: {
    message: string;
    variant?: FeedbackNoticeVariant;
  } | null;
  tips?: string[];
  children?: ReactNode;
  disabled?: boolean;
  disabledMessage?: string;
  compact?: boolean;
};

export default function BulkUploadPanel({
  id,
  title,
  description,
  inputId,
  accept = ".csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  loading = false,
  loadingLabel = "Uploading...",
  onFileChange,
  onDownloadTemplate,
  templateLabel = "Download Template",
  feedback = null,
  tips = [],
  children,
  disabled = false,
  disabledMessage,
  compact = false,
}: BulkUploadPanelProps) {
  return (
    <Card id={id} className="app-surface overflow-hidden">
      <CardHeader
        className={cn("app-section-header", compact ? "space-y-2" : "space-y-3")}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className={cn("space-y-1", compact && "space-y-0.5")}>
            <CardTitle>{title}</CardTitle>
            {description ? <p className="app-form-section-copy">{description}</p> : null}
          </div>
          {onDownloadTemplate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadTemplate}
            >
              <Download className="mr-2 h-4 w-4" />
              {templateLabel}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent
        className={cn("app-section-body", compact ? "space-y-3" : "space-y-4")}
      >
        <div className={cn("space-y-2", compact && "space-y-1.5")}>
          <FilePickerField
            id={inputId}
            label="Upload file"
            accept={accept}
            onChange={onFileChange}
            disabled={disabled || loading}
            placeholder={
              disabled
                ? "Upload unavailable"
                : "CSV or Excel file"
            }
          />
          {loading ? <p className="app-field-note">{loadingLabel}</p> : null}
          {disabled && disabledMessage ? (
            <p className="app-field-note text-amber-700">{disabledMessage}</p>
          ) : null}
        </div>

        {feedback?.message ? (
          <FeedbackNotice variant={feedback.variant || "info"}>
            {feedback.message}
          </FeedbackNotice>
        ) : null}

        {tips.length > 0 ? (
          <div
            className={cn(
              "rounded-2xl border border-border/60 bg-muted/20",
              compact ? "p-3" : "p-3.5",
            )}
          >
            <ul
              className={cn(
                "text-sm leading-6 text-muted-foreground",
                compact ? "space-y-1.5" : "space-y-2",
              )}
            >
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {children}
      </CardContent>
    </Card>
  );
}
