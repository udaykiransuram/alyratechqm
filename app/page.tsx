import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  BookOpen,
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
import PageHero from "@/components/layout/PageHero";

const workspaceCards = [
  {
    title: "Question Papers",
    description:
      "Create papers, review responses, and manage the assessment library from one place.",
    href: "/question-papers",
    cta: "Open papers",
    icon: BookOpen,
  },
  {
    title: "Analytics",
    description:
      "Inspect class trends, student tag reports, and workbook upload workflows.",
    href: "/analytics",
    cta: "Open analytics",
    icon: BarChart2,
  },
  {
    title: "Report Delivery",
    description:
      "Monitor dispatch jobs, retry failures, and track WhatsApp delivery state.",
    href: "/manage/reports",
    cta: "Open report jobs",
    icon: MessageSquareText,
  },
  {
    title: "Users & Access",
    description:
      "Create admins, teachers, and students, then keep password and access management in one place.",
    href: "/manage/users",
    cta: "Open users",
    icon: Users,
  },
];

const roleAreaLinks = [
  {
    title: "Students",
    description:
      "Manage enrollment, roll-number usernames, and student test access from a dedicated area.",
    href: "/students",
    icon: GraduationCap,
  },
  {
    title: "Teachers",
    description:
      "Review teacher records, academic scope, and classroom assignments without mixing student workflows.",
    href: "/teachers",
    icon: Users,
  },
  {
    title: "Admins",
    description:
      "Keep school admins and operational access separate from teacher and learner records.",
    href: "/admins",
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
    title: "Run assessments and review outcomes",
    description:
      "Move from question papers into analytics, workbook uploads, and report delivery without changing context.",
  },
];

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: HOME_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: `${PRODUCT_NAME} | ${COMPANY_NAME}`,
    description: HOME_DESCRIPTION,
    url: "/",
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
    <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Workspace"
        title={PRODUCT_NAME}
        description={HOME_DESCRIPTION}
        actions={
          <>
            <Link href="/question-papers/create" className="app-button-primary">
              Create question paper
            </Link>
            <Link href="/manage/users" className="app-button-secondary">
              Manage users
            </Link>
          </>
        }
        meta={
          <>
            <span className="app-meta-chip">ALYRA TECH</span>
            <span className="app-meta-chip">Tenant-aware operations</span>
            <span className="app-meta-chip">Student online test ready</span>
          </>
        }
        stats={[
          {
            label: "Core modules",
            value: String(workspaceCards.length),
            meta: "Papers, analytics, reports, and user operations.",
          },
          {
            label: "People surfaces",
            value: "3",
            meta: "Dedicated students, teachers, and admins pages stay separate.",
          },
          {
            label: "School model",
            value: "Tenant scoped",
            meta: "Each school keeps its own workspace, users, and data.",
          },
          {
            label: "Assessment mode",
            value: "Hybrid",
            meta: "Manual uploads and student online tests share the same response stack.",
          },
        ]}
      />

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Standardized workspace</p>
          <h2 className="app-spotlight-title">
            Move from school setup to assessment delivery without losing the thread
          </h2>
          <p className="app-spotlight-copy">
            The main screens now share the same lighter visual rhythm so teams can
            move between structure setup, people management, papers, analytics,
            and delivery with less friction.
          </p>
          <div className="app-inline-stat-grid">
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Academic setup</p>
              <p className="app-inline-stat-value">Classes, sections, subjects</p>
              <p className="app-inline-stat-copy">
                Start here when a new school or term is being prepared.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">People operations</p>
              <p className="app-inline-stat-value">Admins, teachers, students</p>
              <p className="app-inline-stat-copy">
                Dedicated pages remain separate for cleaner day-to-day navigation.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Delivery modes</p>
              <p className="app-inline-stat-value">Manual and online</p>
              <p className="app-inline-stat-copy">
                Offline uploads and online tests still converge into the same reporting stack.
              </p>
            </div>
          </div>
          <div className="app-spotlight-actions">
            <Link href="/manage/classes" className="app-button-secondary">
              Manage classes
            </Link>
            <Link href="/manage/sections" className="app-button-secondary">
              Manage sections
            </Link>
            <Link href="/subjects" className="app-button-secondary">
              Manage subjects
            </Link>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Dedicated people areas</p>
          <h2 className="text-lg font-semibold text-foreground">
            Student, teacher, and admin workflows stay separate
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            The workspace keeps role-specific pages intact so operations teams can
            jump into the right records quickly.
          </p>
          <div className="app-link-grid">
            {roleAreaLinks.map((area) => {
              const Icon = area.icon;
              return (
                <Link key={area.title} href={area.href} className="app-link-card">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="app-link-card-title">{area.title}</p>
                      <p className="app-link-card-copy">{area.description}</p>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workspaceCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="app-spotlight-card flex h-full flex-col gap-4">
              <p className="app-spotlight-label">Core module</p>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    {card.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {card.description}
                  </p>
                </div>
              </div>

              <Link
                href={card.href}
                className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                {card.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Recommended operating flow</p>
          <h2 className="text-lg font-semibold text-foreground">
            Follow the same setup path across every school workspace
          </h2>
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
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Operator notes</p>
          <h2 className="text-lg font-semibold text-foreground">
            Small checks that keep the workspace predictable
          </h2>
          <div className="mt-4 space-y-2">
            <div className="app-note-item">
              Confirm the school workspace badge before creating or reviewing
              tenant-specific records.
            </div>
            <div className="app-note-item">
              Keep academic structure and user setup complete before opening
              papers to students or teachers.
            </div>
            <div className="app-note-item">
              Use analytics and report jobs once responses or workbook uploads
              are available.
            </div>
          </div>
          <div className="app-spotlight-actions">
            <Link href="/manage/users" className="app-button-secondary">
              Manage users
            </Link>
            <Link href="/manage/classes" className="app-button-secondary">
              Manage classes
            </Link>
            <Link href="/analytics" className="app-button-secondary">
              Open analytics
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
