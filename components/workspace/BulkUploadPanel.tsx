import type { ChangeEventHandler, ReactNode } from "react";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
import { Label } from "@/components/ui/label";

type BulkUploadPanelProps = {
  id?: string;
  title: string;
  description: string;
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
}: BulkUploadPanelProps) {
  return (
    <Card id={id} className="app-surface overflow-hidden">
      <CardHeader className="app-section-header space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
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
      <CardContent className="app-section-body space-y-4">
        <div className="space-y-2">
          <Label htmlFor={inputId}>Upload file</Label>
          <input
            id={inputId}
            type="file"
            accept={accept}
            onChange={onFileChange}
            disabled={disabled || loading}
            className="app-form-file"
          />
          {loading ? (
            <p className="text-sm text-muted-foreground">{loadingLabel}</p>
          ) : null}
        </div>

        {feedback?.message ? (
          <FeedbackNotice variant={feedback.variant || "info"}>
            {feedback.message}
          </FeedbackNotice>
        ) : null}

        {tips.length > 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">Upload notes</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
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
