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
    description:
      "Create papers, review responses, and manage the assessment library from one place.",
    href: "/workspace/question-papers",
    cta: "Open papers",
    icon: BookOpen,
  },
  {
    title: "Questions",
    description:
      "Build and curate the question bank with metadata, tags, and authoring tools designed for reuse.",
    href: "/workspace/questions",
    cta: "Open questions",
    icon: FileQuestion,
  },
  {
    title: "Students",
    description:
      "Manage enrollment, section grouping, and student test access from one clean operations area.",
    href: "/workspace/students",
    cta: "Open students",
    icon: GraduationCap,
  },
  {
    title: "Report Delivery",
    description:
      "Monitor dispatch jobs, retry failures, and track WhatsApp delivery state.",
    href: "/workspace/manage/reports",
    cta: "Open report jobs",
    icon: MessageSquareText,
  },
];

const roleAreaLinks = [
  {
    title: "Manage Users",
    description:
      "Create and manage admins, teachers, and students from one role-aware directory before you move into dedicated detail flows.",
    href: "/workspace/manage/users",
    icon: Users,
  },
  {
    title: "Analytics Hub",
    description:
      "Move from question papers into benchmark views, workbook uploads, and reporting without changing the visual rhythm.",
    href: "/workspace/analytics",
    icon: BarChart2,
  },
  {
    title: "Staff Areas",
    description:
      "Open teacher and admin areas when school operations need clearer ownership and access separation.",
    href: "/workspace/teachers",
    icon: ShieldCheck,
  },
];

const setupSteps = [
  {
    title: "Set up the academic structure",
    description:
      "Create classes, sections, and subjects first so user onboarding and papers stay clean.",
  },
  {
    title: "Onboard the right people",
    description:
      "Add admins, teachers, and students in their own management areas before assignments begin.",
  },
  {
    title: "Run assessments with confidence",
    description:
      "Move from question papers into responses and analytics without losing the school context.",
  },
  {
    title: "Deliver reporting with control",
    description:
      "Track report jobs, retry failures, and review delivery state from a dedicated operational queue.",
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
    <PageShell width="wide" padding="relaxed">
      <PageHero
        variant="overview"
        eyebrow="School Operations"
        title="Workspace Overview"
        description="Run academic setup, learner operations, assessments, and reporting from one calmer command surface designed for international-school administration."
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
              Create question paper
            </AppPrefetchLink>
            <AppPrefetchLink
              href="/workspace/questions"
              className="app-button-secondary"
            >
              Open question bank
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
            <span className="app-meta-chip">School-scoped workspace</span>
            <span className="app-meta-chip">Assessment operations</span>
            <span className="app-meta-chip">Online test ready</span>
          </>
        }
        stats={[
          {
            label: "Primary workflows",
            value: String(workspaceCards.length),
            meta: "The most common daily operations stay up front.",
          },
          {
            label: "Workflow stages",
            value: String(setupSteps.length),
            meta: "Setup, onboarding, assessments, and reporting stay connected.",
          },
          {
            label: "Operational model",
            value: "Balanced",
            meta: "Dense enough for real school work without feeling crowded.",
          },
          {
            label: "School context",
            value: "Single workspace",
            meta: "People, setup, and assessment operations stay under one school identity.",
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workspaceCards.map((card) => {
          const Icon = card.icon;
          return (
            <AppPrefetchLink
              key={card.title}
              href={card.href}
              className="group app-workspace-module-card"
            >
              <div>
                <span className="app-workspace-module-label">Core module</span>
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
          <p className="app-spotlight-label">Operating rhythm</p>
          <h2 className="app-spotlight-title">
            Move from setup to reporting without losing context
          </h2>
          <p className="app-spotlight-copy">
            Daily work feels better when setup, people management, and report
            delivery share the same visual rhythm. This overview is meant to
            answer where you are, what matters next, and which workflows are
            most important without forcing you to scan a wall of equal-looking
            cards.
          </p>
          <div className="app-inline-stat-grid">
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Support links</p>
              <p className="app-inline-stat-value">{roleAreaLinks.length}</p>
              <p className="app-inline-stat-copy">Analytics, people management, and staff tools stay within easy reach.</p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Flow stages</p>
              <p className="app-inline-stat-value">{setupSteps.length}</p>
              <p className="app-inline-stat-copy">Structure, onboarding, assessment, and reporting stay in one rhythm.</p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Workspace mode</p>
              <p className="app-inline-stat-value">School scoped</p>
              <p className="app-inline-stat-copy">Each workspace stays focused on one school context at a time.</p>
            </div>
          </div>
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
          <p className="app-spotlight-label">Role areas</p>
          <h2 className="app-spotlight-title">Keep operational work split by audience</h2>
          <p className="app-spotlight-copy">
            Supporting areas still feel connected to the dashboard system, but
            each one is framed for a different job so school operations do not
            blur into one crowded admin layer.
          </p>
          <div className="app-link-grid">
            {roleAreaLinks.map((area) => {
              const Icon = area.icon;

              return (
                <AppPrefetchLink key={area.title} href={area.href} className="app-link-card">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/10 text-primary shadow-[0_16px_28px_-24px_hsl(var(--primary)/0.3)]">
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
