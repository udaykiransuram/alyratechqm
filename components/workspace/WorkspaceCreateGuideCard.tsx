import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WorkspaceCreateGuideItem = {
  title: string;
  note?: string;
};

type WorkspaceCreateGuideCardProps = {
  title: string;
  description?: string;
  items: WorkspaceCreateGuideItem[];
  compact?: boolean;
};

export default function WorkspaceCreateGuideCard({
  title,
  description,
  items,
  compact = false,
}: WorkspaceCreateGuideCardProps) {
  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader
        className={cn("app-section-header", compact ? "space-y-1.5" : "space-y-2")}
      >
        <CardTitle>{title}</CardTitle>
        {description ? (
          <p className="app-form-section-copy">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent
        className={cn("app-section-body", compact ? "space-y-0 pt-2.5" : "pt-3.5")}
      >
        <div className={cn("app-flow-list mt-0", compact && "space-y-1")}>
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="app-flow-item">
              <div className="app-flow-index">{index + 1}</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">{item.title}</p>
                {item.note ? <p className="app-flow-note">{item.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export type WorkspaceCreateMode = "single" | "bulk";

type WorkspaceCreateModeToggleProps = {
  value: WorkspaceCreateMode;
  onChange: (value: WorkspaceCreateMode) => void;
  singleLabel?: string;
  bulkLabel?: string;
  className?: string;
};

export function WorkspaceCreateModeToggle({
  value,
  onChange,
  singleLabel = "Single create",
  bulkLabel = "Bulk upload",
  className,
}: WorkspaceCreateModeToggleProps) {
  return (
    <div className={cn("app-segmented-control w-full sm:w-fit", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "app-segmented-link min-w-[9rem] items-center py-2 text-center",
          value === "single" && "app-segmented-link-active",
        )}
        onClick={() => onChange("single")}
        aria-pressed={value === "single"}
      >
        <span className="app-segmented-link-label">{singleLabel}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "app-segmented-link min-w-[9rem] items-center py-2 text-center",
          value === "bulk" && "app-segmented-link-active",
        )}
        onClick={() => onChange("bulk")}
        aria-pressed={value === "bulk"}
      >
        <span className="app-segmented-link-label">{bulkLabel}</span>
      </Button>
    </div>
  );
}
