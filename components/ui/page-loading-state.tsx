import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type PageLoadingStateProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  dense?: boolean;
};

export default function PageLoadingState({
  title = "Loading workspace",
  description = "Preparing the latest data and layout.",
  actions,
  className,
  contentClassName,
  dense = false,
}: PageLoadingStateProps) {
  return (
    <div className={cn("app-page-shell px-4 py-6 sm:px-0", className)}>
      <div className={cn("space-y-6", contentClassName)}>
        <div className="app-page-header-row">
          <div className="space-y-2">
            <h1 className="app-page-title">{title}</h1>
            <p className="app-page-subtitle">{description}</p>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        <div className="app-surface overflow-hidden border border-border/60 bg-card/90 shadow-sm">
          <div className="app-section-header border-b border-border/60 bg-muted/20">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-32 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-52" />
                <Skeleton className="h-4 w-full max-w-2xl" />
              </div>
            </div>
          </div>

          <div className="app-section-body space-y-4">
            <div className={cn("grid gap-4", dense ? "lg:grid-cols-2" : "lg:grid-cols-3")}>
              {Array.from({ length: dense ? 2 : 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-3 h-9 w-24" />
                  <Skeleton className="mt-3 h-4 w-full" />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/60 bg-background/90 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-24 rounded-md" />
                  <Skeleton className="h-9 w-20 rounded-md" />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {Array.from({ length: dense ? 4 : 6 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[minmax(0,1.4fr)_120px_120px] gap-3">
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
