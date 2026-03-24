import type { ReactNode } from "react";

import { AlertCircle, Inbox, Info } from "lucide-react";

import { cn } from "@/lib/utils";

type PageStateVariant = "empty" | "error" | "info";

type PageStateProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  variant?: PageStateVariant;
  icon?: ReactNode;
  className?: string;
};

function getDefaultIcon(variant: PageStateVariant) {
  if (variant === "error") return <AlertCircle className="h-5 w-5" />;
  if (variant === "info") return <Info className="h-5 w-5" />;
  return <Inbox className="h-5 w-5" />;
}

export default function PageState({
  title,
  description,
  action,
  variant = "empty",
  icon,
  className,
}: PageStateProps) {
  return (
    <div className={cn("app-surface overflow-hidden", className)}>
      <div className="app-surface-body">
        <div className={cn("app-state-panel", `app-state-panel-${variant}`)}>
          <div className="app-state-panel-icon">{icon ?? getDefaultIcon(variant)}</div>
          <div className="app-state-panel-copy">
            <p className="app-state-panel-title">{title}</p>
            {description ? (
              <p className="app-state-panel-description">{description}</p>
            ) : null}
          </div>
          {action ? <div className="app-state-panel-actions">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
