import { Card, CardContent, CardHeader } from "@/components/ui/card";

function EditorBlockSkeleton({
  lines = 3,
}: {
  lines?: number;
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
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="h-10 animate-pulse rounded-2xl bg-muted/60"
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default function QuestionEditorLoadingState() {
  return (
    <div className="app-editor-grid app-editor-grid-composer">
      <div className="app-editor-main space-y-3.5">
        <EditorBlockSkeleton lines={4} />
        <EditorBlockSkeleton lines={4} />
        <EditorBlockSkeleton lines={3} />
      </div>
      <aside className="app-editor-aside app-editor-aside-sticky space-y-4">
        <EditorBlockSkeleton lines={3} />
        <EditorBlockSkeleton lines={3} />
        <EditorBlockSkeleton lines={2} />
      </aside>
    </div>
  );
}
