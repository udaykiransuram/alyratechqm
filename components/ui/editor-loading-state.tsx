import { Skeleton } from "@/components/ui/skeleton";

type EditorLoadingStateProps = {
  label?: string;
};

export default function EditorLoadingState({
  label = "Loading editor workspace",
}: EditorLoadingStateProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Preparing formatting tools and question content.</p>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-10 rounded-md" />
          <Skeleton className="h-8 w-10 rounded-md" />
          <Skeleton className="h-8 w-10 rounded-md" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
