import type { ReactNode } from "react";

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

export type FeedbackNoticeVariant = "success" | "error" | "info" | "warning";

type FeedbackNoticeProps = {
  children: ReactNode;
  variant?: FeedbackNoticeVariant;
  icon?: ReactNode;
  className?: string;
};

function getDefaultIcon(variant: FeedbackNoticeVariant) {
  if (variant === "error") {
    return <AlertCircle className="h-4 w-4" />;
  }

  if (variant === "warning") {
    return <AlertTriangle className="h-4 w-4" />;
  }

  if (variant === "success") {
    return <CheckCircle2 className="h-4 w-4" />;
  }

  return <Info className="h-4 w-4" />;
}

function getVariantClassName(variant: FeedbackNoticeVariant) {
  if (variant === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return `app-feedback-${variant}`;
}

export default function FeedbackNotice({
  children,
  variant = "info",
  icon,
  className,
}: FeedbackNoticeProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "app-feedback flex items-start gap-3",
        getVariantClassName(variant),
        className,
      )}
    >
      <span className="mt-0.5 shrink-0">
        {icon ?? getDefaultIcon(variant)}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
