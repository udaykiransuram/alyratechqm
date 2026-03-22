import type { Metadata } from "next";
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
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import PageHero from "@/components/layout/PageHero";

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
    title: "Analytics",
    description:
      "Inspect class trends, student tag reports, and workbook upload workflows.",
    href: "/workspace/analytics",
    cta: "Open analytics",
    icon: BarChart2,
  },
  {
    title: "Report Delivery",
    description:
      "Monitor dispatch jobs, retry failures, and track WhatsApp delivery state.",
    href: "/workspace/manage/reports",
    cta: "Open report jobs",
    icon: MessageSquareText,
  },
  {
    title: "Users & Access",
    description:
      "Create admins, teachers, and students, then keep password and access management in one place.",
    href: "/workspace/manage/users",
    cta: "Open users",
    icon: Users,
  },
];

const roleAreaLinks = [
  {
    title: "Students",
    description:
      "Manage enrollment, roll-number usernames, and student test access from a dedicated area.",
    href: "/workspace/students",
    icon: GraduationCap,
  },
  {
    title: "Teachers",
    description:
      "Review teacher records, academic scope, and classroom assignments without mixing student workflows.",
    href: "/workspace/teachers",
    icon: Users,
  },
  {
    title: "Admins",
    description:
      "Keep school admins and operational access separate from teacher and learner records.",
    href: "/workspace/admins",
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
    <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Workspace"
        title={PRODUCT_NAME}
        description={HOME_DESCRIPTION}
        actions={
          <>
            <AppPrefetchLink
              href="/workspace/question-papers/create"
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
            <AppPrefetchLink href="/" className="app-button-secondary">
              Open talent test
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

              <AppPrefetchLink
                href={card.href}
                className="mt-auto inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                {card.cta}
                <ArrowRight className="h-4 w-4" />
              </AppPrefetchLink>
            </div>
          );
        })}
      </div>

      </div>
  );
}
