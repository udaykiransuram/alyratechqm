import { Card, CardContent, CardHeader } from "@/components/ui/card";

function BuilderPanelSkeleton({
  rows = 4,
}: {
  rows?: number;
}) {
  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header">
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted/80" />
        </div>
      </CardHeader>
      <CardContent className="app-section-body space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-2xl bg-muted/60"
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SectionSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
      <div className="space-y-3.5 border-b border-border/60 bg-muted/20 px-4 py-3.5">
        <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted/80" />
      </div>
      <div className="space-y-3.5 px-4 py-4">
        <div className="h-28 w-full animate-pulse rounded-2xl bg-muted/60" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/50" />
      </div>
    </div>
  );
}

export default function QuestionPaperFormLoadingState() {
  return (
    <div className="space-y-3.5 sm:space-y-4">
      <div className="app-editor-grid app-editor-grid-builder">
        <main className="app-editor-main">
          <div className="app-surface overflow-hidden">
            <div className="app-section-header">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="h-6 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-72 animate-pulse rounded bg-muted/80" />
                </div>
                <div className="h-10 w-40 animate-pulse rounded-xl bg-muted/70" />
              </div>
            </div>
            <div className="app-section-body space-y-3">
              <SectionSkeleton />
              <SectionSkeleton />
            </div>
          </div>
        </main>

        <aside className="app-editor-aside app-editor-aside-sticky space-y-4">
          <BuilderPanelSkeleton rows={6} />
          <BuilderPanelSkeleton rows={5} />
          <div className="h-11 w-full animate-pulse rounded-xl bg-muted/70" />
        </aside>
      </div>
    </div>
  );
}
