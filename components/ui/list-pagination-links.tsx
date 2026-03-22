import { ChevronLeft, ChevronRight } from "lucide-react";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ListPaginationLinksProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  itemLabel: string;
  previousHref?: string | null;
  nextHref?: string | null;
  className?: string;
  hideWhenSinglePage?: boolean;
};

function getRangeLabel({
  page,
  pageSize,
  totalItems,
  itemLabel,
}: Omit<ListPaginationLinksProps, "previousHref" | "nextHref">) {
  if (totalItems <= 0) {
    return `Showing 0 ${itemLabel}`;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);
  return `Showing ${start}-${end} of ${totalItems} ${itemLabel}`;
}

export default function ListPaginationLinks({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  previousHref,
  nextHref,
  className,
  hideWhenSinglePage = true,
}: ListPaginationLinksProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  if (hideWhenSinglePage && safeTotalPages <= 1) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {getRangeLabel({
            page: safePage,
            totalPages: safeTotalPages,
            totalItems,
            pageSize,
            itemLabel,
            className,
            hideWhenSinglePage,
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          Page {safePage} of {safeTotalPages}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {previousHref ? (
          <Button asChild variant="outline" size="sm" className="app-button-compact">
            <AppPrefetchLink href={previousHref} prefetchOnMount>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </AppPrefetchLink>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="app-button-compact"
            disabled
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
        )}

        {nextHref ? (
          <Button asChild variant="outline" size="sm" className="app-button-compact">
            <AppPrefetchLink href={nextHref} prefetchOnMount>
              Next
              <ChevronRight className="h-4 w-4" />
            </AppPrefetchLink>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="app-button-compact"
            disabled
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
