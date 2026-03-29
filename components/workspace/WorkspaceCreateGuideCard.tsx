import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspaceCreateGuideItem = {
  title: string;
  note: string;
};

type WorkspaceCreateGuideCardProps = {
  title: string;
  description?: string;
  items: WorkspaceCreateGuideItem[];
};

export default function WorkspaceCreateGuideCard({
  title,
  description,
  items,
}: WorkspaceCreateGuideCardProps) {
  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header space-y-2.5">
        <CardTitle>{title}</CardTitle>
        {description ? (
          <p className="app-form-section-copy">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="app-section-body">
        <div className="app-flow-list">
          {items.map((item, index) => (
            <div key={`${item.title}-${index}`} className="app-flow-item">
              <div className="app-flow-index">{index + 1}</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">{item.title}</p>
                <p className="app-flow-note">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
