import type { ReactNode } from "react";

import { AlertCircle, Inbox, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type SectionStateVariant = "empty" | "error" | "info";

type SectionStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: SectionStateVariant;
  icon?: ReactNode;
  className?: string;
};

function getDefaultIcon(variant: SectionStateVariant) {
  if (variant === "error") return <AlertCircle className="h-5 w-5" />;
  if (variant === "info") return <Info className="h-5 w-5" />;
  return <Inbox className="h-5 w-5" />;
}

export default function SectionState({
  title,
  description,
  action,
  variant = "empty",
  icon,
  className,
}: SectionStateProps) {
  return (
    <div
      className={cn(
        "app-state-panel app-state-panel-compact",
        `app-state-panel-${variant}`,
        className,
      )}
    >
      <div className="app-state-panel-icon">{icon ?? getDefaultIcon(variant)}</div>
      <div className="app-state-panel-copy">
        <p className="app-state-panel-title">{title}</p>
        {description ? (
          <p className="app-state-panel-description">{description}</p>
        ) : null}
      </div>
      {action ? <div className="app-state-panel-actions">{action}</div> : null}
    </div>
  );
}
