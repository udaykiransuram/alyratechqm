import type { ReactNode } from "react";

import { ArrowLeft } from "lucide-react";

import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type WorkspaceCreateShellProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  backLabel: string;
  onBack: () => void;
  badges?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  mainClassName?: string;
  asideClassName?: string;
  stickyAside?: boolean;
};

export default function WorkspaceCreateShell({
  eyebrow,
  title,
  description,
  backLabel,
  onBack,
  badges,
  children,
  aside,
  mainClassName,
  asideClassName,
  stickyAside = true,
}: WorkspaceCreateShellProps) {
  return (
    <PageShell width="wide" padding="standard">
      <div className="space-y-4 sm:space-y-5">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="app-button-back w-full sm:w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>

        <section className="app-spotlight-card app-spotlight-card-strong">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              {eyebrow ? (
                <div className="app-spotlight-label">{eyebrow}</div>
              ) : null}
              <h1 className="app-spotlight-title">{title}</h1>
              {description ? (
                <p className="app-spotlight-copy">{description}</p>
              ) : null}
            </div>
            {badges ? (
              <div className="app-chip-cloud lg:max-w-sm lg:justify-end">
                {badges}
              </div>
            ) : null}
          </div>
        </section>

        {aside ? (
          <div className="app-create-shell-grid">
            <div className={cn("app-create-shell-main", mainClassName)}>
              {children}
            </div>
            <aside
              className={cn(
                "app-create-shell-aside",
                stickyAside && "app-create-shell-aside-sticky",
                asideClassName,
              )}
            >
              {aside}
            </aside>
          </div>
        ) : (
          <div className={cn("app-create-shell-main", mainClassName)}>
            {children}
          </div>
        )}
      </div>
    </PageShell>
  );
}
