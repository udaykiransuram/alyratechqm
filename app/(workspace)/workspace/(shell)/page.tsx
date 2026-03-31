import type { Metadata } from "next";
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  FileQuestion,
  GraduationCap,
  MessageSquareText,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  COMPANY_NAME,
  HOME_DESCRIPTION,
  PRODUCT_NAME,
  SITE_KEYWORDS,
} from "@/lib/seo";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";

const workspaceCards = [
  {
    title: "Question Papers",
    label: "Assessment desk",
    description:
      "Draft papers, assign them fast, and review responses from one place.",
    href: "/workspace/question-papers",
    cta: "Open papers",
    icon: BookOpen,
    tone: "papers",
    highlights: ["Create and assign", "Review responses"],
  },
  {
    title: "Questions",
    label: "Question bank",
    description:
      "Keep reusable bank items clean with subjects, tags, and authoring controls.",
    href: "/workspace/questions",
    cta: "Open questions",
    icon: FileQuestion,
    tone: "questions",
    highlights: ["Metadata ready", "Reuse faster"],
  },
  {
    title: "Students",
    label: "Learner ops",
    description:
      "Handle enrollment, sections, and test access without leaving the school workspace.",
    href: "/workspace/students",
    cta: "Open students",
    icon: GraduationCap,
    tone: "students",
    highlights: ["Roster and sections", "Exam access"],
  },
  {
    title: "Report Delivery",
    label: "Reporting ops",
    description:
      "Track report jobs, recover failures, and keep delivery visibility tight.",
    href: "/workspace/manage/reports",
    cta: "Open report jobs",
    icon: MessageSquareText,
    tone: "reports",
    highlights: ["Job status", "Retry queue"],
  },
];

const roleAreaLinks = [
  {
    title: "Manage Users",
    description: "Admins, teachers, and students with role-aware access.",
    href: "/workspace/manage/users",
    icon: Users,
  },
  {
    title: "Analytics Hub",
    description: "Benchmarks, workbook uploads, and reporting views.",
    href: "/workspace/analytics",
    icon: BarChart2,
  },
  {
    title: "Staff Areas",
    description: "Teacher and admin surfaces when ownership needs to split.",
    href: "/workspace/teachers",
    icon: ShieldCheck,
  },
];

const setupSteps = [
  {
    title: "Structure the school",
    description: "Set classes, sections, and subjects first.",
  },
  {
    title: "Add people",
    description: "Bring in admins, teachers, and students.",
  },
  {
    title: "Run assessments",
    description: "Move from papers into live responses and review.",
  },
  {
    title: "Close the loop",
    description: "Dispatch reports and follow delivery state.",
  },
];

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: HOME_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/workspace",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: `${PRODUCT_NAME} | ${COMPANY_NAME}`,
    description: HOME_DESCRIPTION,
    url: "/workspace",
    siteName: COMPANY_NAME,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} | ${COMPANY_NAME}`,
    description: HOME_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function WorkspaceHomePage() {
  return (
    <PageShell
      width="wide"
      padding="standard"
      className="app-workspace-overview-page app-directory-stack"
    >
      <PageHero
        variant="overview"
        density="compact"
        eyebrow="School Workspace"
        title="One calmer place to run school operations"
        description="Launch papers, question bank, learner operations, and reporting from one school-scoped workspace."
        actions={
          <>
            <AppPrefetchLink
              href="/workspace/question-papers/create"
              prefetchOnMount
              className="app-button-primary"
              relatedApiPrefetches={[
                "/api/classes",
                "/api/sections",
                "/api/subjects",
                "/api/tags/with-subjects",
              ]}
            >
              Create paper
            </AppPrefetchLink>
            <AppPrefetchLink
              href="/workspace/questions"
              className="app-button-secondary"
            >
              Question bank
            </AppPrefetchLink>
            <AppPrefetchLink
              href="/workspace/manage/users"
              className="app-button-secondary"
            >
              Manage users
            </AppPrefetchLink>
          </>
        }
        meta={
          <>
            <span className="app-meta-chip">School scoped</span>
            <span className="app-meta-chip">Assessment ready</span>
            <span className="app-meta-chip">Online test ready</span>
          </>
        }
        stats={[
          {
            label: "Core modules",
            value: String(workspaceCards.length),
            meta: "Papers, bank, learners, reports",
          },
          {
            label: "Support areas",
            value: String(roleAreaLinks.length),
            meta: "Users, analytics, staff",
          },
          {
            label: "Workflow",
            value: `${setupSteps.length} steps`,
            meta: "Setup through reporting",
          },
          {
            label: "Mode",
            value: "Single school",
            meta: "One active school context",
          },
        ]}
      />

      <div className="app-dashboard-module-grid">
        {workspaceCards.map((card) => {
          const Icon = card.icon;
          return (
            <AppPrefetchLink
              key={card.title}
              href={card.href}
              className={`group app-workspace-module-card app-workspace-module-card-${card.tone}`}
            >
              <div>
                <div className="app-workspace-module-card-top">
                  <span className="app-workspace-module-label">{card.label}</span>
                </div>
                <div className="app-workspace-module-header mt-4">
                  <div className="app-workspace-module-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="app-workspace-module-title">{card.title}</h2>
                    <p className="app-workspace-module-copy">
                      {card.description}
                    </p>
                  </div>
                </div>
              </div>
              <div className="app-workspace-module-chip-row">
                {card.highlights.map((highlight) => (
                  <span key={highlight} className="app-workspace-module-chip">
                    {highlight}
                  </span>
                ))}
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
          <p className="app-spotlight-label">Operating flow</p>
          <h2 className="app-spotlight-title">A clean path from setup to reporting</h2>
          <p className="app-spotlight-copy">
            The overview should help you see what to do next, open the right
            area fast, and keep school work from feeling crowded.
          </p>
          <div className="app-flow-list">
            {setupSteps.map((step, index) => (
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
          <p className="app-spotlight-label">Support areas</p>
          <h2 className="app-spotlight-title">Keep adjacent work within easy reach</h2>
          <p className="app-spotlight-copy">
            Open users, analytics, and staff spaces without losing the school
            workspace rhythm.
          </p>
          <div className="app-link-grid">
            {roleAreaLinks.map((area) => {
              const Icon = area.icon;

              return (
                <AppPrefetchLink key={area.title} href={area.href} className="app-link-card">
                  <div className="flex items-start gap-3">
                    <div className="app-workspace-overview-link-icon">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="app-link-card-title">{area.title}</p>
                      <p className="app-link-card-copy">{area.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </AppPrefetchLink>
              );
            })}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
