import type { ReactNode } from "react";

import { ArrowLeft } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
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
    <PageShell width="wide" padding="standard" className="app-directory-stack">
      <PageHero
        variant="editor"
        density="compact"
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="app-button-back w-full sm:w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        }
        meta={badges}
      />

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
    </PageShell>
  );
}
