import Link from "next/link";
import { BarChart2, BookOpen, FileSpreadsheet, MessageSquareText } from "lucide-react";

const analyticsCards = [
  {
    title: "Analytics Workspace",
    description:
      "Start from the analytics hub, then jump into class reports, response review, and benchmark actions for a selected paper.",
    href: "/question-papers",
    cta: "Open Question Papers",
    icon: BookOpen,
  },
  {
    title: "Excel Upload",
    description:
      "Upload student responses from a workbook, validate headers, and inspect upload history for a paper and section.",
    href: "/analytics/student-tag-report/excel-upload",
    cta: "Open Excel Upload",
    icon: FileSpreadsheet,
  },
  {
    title: "Report Delivery",
    description:
      "Track queued, processing, sent, and failed report jobs and manually trigger the delivery worker when needed.",
    href: "/manage/reports",
    cta: "Open Report Jobs",
    icon: MessageSquareText,
  },
];

export default function AnalyticsHubPage() {
  return (
    <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
      <div className="app-page-header-row">
        <div className="app-page-header">
          <h1 className="app-page-title">Analytics Hub</h1>
          <p className="app-page-subtitle">
            Use this workspace to enter the class analytics flow, upload response sheets,
            and monitor report delivery.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {analyticsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="app-surface app-surface-body flex h-full flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">{card.title}</h2>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
              </div>

              <Link
                href={card.href}
                className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <BarChart2 className="h-4 w-4" />
                {card.cta}
              </Link>
            </div>
          );
        })}
      </div>

      <div className="app-surface app-surface-body">
        <h2 className="text-base font-semibold text-foreground">How to use it</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a school from the header first. For class-level analytics, open a paper from
          the question paper list and use its analytics actions. For student-level imports,
          start from Excel upload and pick the paper context there.
        </p>
      </div>
    </div>
  );
}
