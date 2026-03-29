import type { ReactNode } from "react";

import { ArrowLeft } from "lucide-react";

import PageShell from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";

type WorkspaceCreateShellProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  backLabel: string;
  onBack: () => void;
  badges?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
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
}: WorkspaceCreateShellProps) {
  return (
    <PageShell width="wide" padding="relaxed">
      <div className="space-y-6">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          className="app-button-back w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Button>

        <section className="app-spotlight-card app-spotlight-card-strong">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
          <div className="min-w-0 space-y-5">{children}</div>
          {aside ? (
            <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
              {aside}
            </aside>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}
