import { BarChart2, BookOpen, FileSpreadsheet, MessageSquareText } from "lucide-react";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";

const analyticsCards = [
  {
    title: "Analytics Workspace",
    description:
      "Start from the analytics hub, then jump into class reports, response review, and benchmark actions for a selected paper.",
    href: "/workspace/question-papers",
    cta: "Open Question Papers",
    icon: BookOpen,
  },
  {
    title: "Excel Upload",
    description:
      "Upload student responses from a workbook, validate headers, and inspect upload history for a paper and section.",
    href: "/workspace/analytics/student-tag-report/excel-upload",
    cta: "Open Excel Upload",
    icon: FileSpreadsheet,
  },
  {
    title: "Report Delivery",
    description:
      "Track queued, processing, sent, and failed report jobs and manually trigger the delivery worker when needed.",
    href: "/workspace/manage/reports",
    cta: "Open Report Jobs",
    icon: MessageSquareText,
  },
];

export default function AnalyticsHubPage() {
  return (
    <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Analytics"
        title="Analytics Hub"
        description="Use this workspace to enter the class analytics flow, upload response sheets, and monitor report delivery."
        meta={
          <>
            <span className="app-meta-chip">Assessment analytics</span>
            <span className="app-meta-chip">Delivery monitoring</span>
          </>
        }
        stats={[
          {
            label: "Entry points",
            value: String(analyticsCards.length),
            meta: "Use these shortcuts to jump into the main analytics flows.",
          },
        ]}
      />

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

              <AppPrefetchLink
                href={card.href}
                prefetchOnMount
                className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                <BarChart2 className="h-4 w-4" />
                {card.cta}
              </AppPrefetchLink>
            </div>
          );
        })}
      </div>

    </div>
  );
}
