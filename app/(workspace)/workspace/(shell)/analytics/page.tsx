import {
  ArrowRight,
  BookOpen,
  FileSpreadsheet,
  MessageSquareText,
} from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";

const analyticsCards = [
  {
    label: "Primary workflow",
    title: "Question Paper Analytics",
    description:
      "Start from the paper directory, then move into responses, class analytics, and benchmark reporting without switching mental models.",
    href: "/workspace/question-papers",
    cta: "Open question papers",
    icon: BookOpen,
  },
  {
    label: "Workbook intake",
    title: "Excel Upload",
    description:
      "Upload student responses from workbooks, validate them, and keep the upload history close to the reporting workflow.",
    href: "/workspace/analytics/student-tag-report/excel-upload",
    cta: "Open Excel upload",
    icon: FileSpreadsheet,
  },
  {
    label: "Queue monitoring",
    title: "Report Delivery",
    description:
      "Track queued, processing, sent, and failed report jobs so delivery problems are easy to notice and resolve.",
    href: "/workspace/manage/reports",
    cta: "Open report delivery",
    icon: MessageSquareText,
  },
];

const analyticsFlow = [
  {
    title: "Start from an assessment",
    description:
      "Use question papers as the source of truth for responses, analytics, and class-level reporting.",
  },
  {
    title: "Bring in workbook responses when needed",
    description:
      "Excel uploads stay connected to the same analytics language instead of becoming a separate utility workflow.",
  },
  {
    title: "Close the loop with delivery monitoring",
    description:
      "Operational queues stay near analytics so admins can move from insight to action without losing context.",
  },
];

export default function AnalyticsHubPage() {
  return (
    <PageShell width="content" padding="relaxed">
      <PageHero
        variant="overview"
        eyebrow="Insights"
        title="Analytics & Reporting"
        description="Use one executive-style analytics hub for paper outcomes, workbook uploads, and delivery operations without the pages feeling like a separate product."
        actions={
          <>
            <AppPrefetchLink
              href="/workspace/question-papers"
              prefetchOnMount
              className="app-button-primary"
            >
              Open question papers
            </AppPrefetchLink>
            <AppPrefetchLink
              href="/workspace/manage/reports"
              className="app-button-secondary"
            >
              Open report delivery
            </AppPrefetchLink>
          </>
        }
        meta={
          <>
            <span className="app-meta-chip">Assessment analytics</span>
            <span className="app-meta-chip">Workbook intake</span>
            <span className="app-meta-chip">Delivery monitoring</span>
          </>
        }
        stats={[
          {
            label: "Entry points",
            value: String(analyticsCards.length),
            meta: "Core analytics workflows kept in one navigation zone.",
          },
          {
            label: "Operating model",
            value: "Executive clear",
            meta: "Charts, exports, and queues should read clearly during real use.",
          },
          {
            label: "Flow stages",
            value: String(analyticsFlow.length),
            meta: "Assessment, intake, and delivery stay connected.",
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {analyticsCards.map((card) => {
          const Icon = card.icon;

          return (
            <AppPrefetchLink
              key={card.title}
              href={card.href}
              className="group app-workspace-module-card"
            >
              <div>
                <span className="app-workspace-module-label">{card.label}</span>
                <div className="app-workspace-module-header mt-4">
                  <div className="app-workspace-module-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="app-workspace-module-title">{card.title}</h2>
                    <p className="app-workspace-module-copy">{card.description}</p>
                  </div>
                </div>
              </div>
              <div className="app-workspace-module-cta">
                {card.cta}
                <ArrowRight className="h-4 w-4" />
              </div>
            </AppPrefetchLink>
          );
        })}
      </div>

      <div className="app-spotlight-grid">
        <section className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Workflow clarity</p>
          <h2 className="app-spotlight-title">
            Keep analytics operational, not decorative
          </h2>
          <p className="app-spotlight-copy">
            School admins should be able to move from outcome review to action
            without entering a different visual language. This hub keeps exports,
            workbook intake, and report delivery visibly connected.
          </p>
          <div className="app-flow-list">
            {analyticsFlow.map((step, index) => (
              <div key={step.title} className="app-flow-item">
                <div className="app-flow-index">{index + 1}</div>
                <div className="app-flow-copy">
                  <p className="app-flow-title">{step.title}</p>
                  <p className="app-flow-note">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="app-spotlight-card">
          <p className="app-spotlight-label">Design intent</p>
          <h2 className="app-spotlight-title">
            The same workspace language should carry through insights
          </h2>
          <p className="app-spotlight-copy">
            Filters, exports, queues, and reports should feel like the same
            institutional product. That means the analytics hub stays calm,
            bright, and structured instead of becoming a patchwork utility zone.
          </p>
          <div className="app-inline-stat-grid">
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Dashboard tone</p>
              <p className="app-inline-stat-value">International school</p>
              <p className="app-inline-stat-copy">
                More academic and credible than startup-like or overly flashy.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Action clarity</p>
              <p className="app-inline-stat-value">Primary first</p>
              <p className="app-inline-stat-copy">
                One clear next step should stand out even in denser workflows.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Surface model</p>
              <p className="app-inline-stat-value">Shared system</p>
              <p className="app-inline-stat-copy">
                Tables, exports, and queue actions inherit the same shell and
                card language used elsewhere in the workspace.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
