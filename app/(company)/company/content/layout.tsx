"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenText,
  CircleHelp,
  Mail,
  MessageSquareQuote,
  Palette,
  PhoneCall,
  Sparkles,
  WalletCards,
} from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { cn } from "@/lib/utils";

const cmsNavItems = [
  { href: "/company/content", label: "Dashboard", icon: BookOpenText },
  { href: "/company/content/theme", label: "Theme Studio", icon: Palette },
  { href: "/company/content/stats", label: "Site Stats", icon: BarChart3 },
  { href: "/company/content/testimonials", label: "Testimonials", icon: MessageSquareQuote },
  { href: "/company/content/messages", label: "Messages", icon: Mail },
  { href: "/company/content/case-studies", label: "Case Studies", icon: BookOpenText },
  { href: "/company/content/pricing", label: "Pricing Plans", icon: WalletCards },
  { href: "/company/talent-test", label: "Talent Test", icon: Sparkles },
  { href: "/company/content/faq", label: "FAQs", icon: CircleHelp },
  { href: "/company/content/contact-info", label: "Contact Info", icon: PhoneCall },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function CompanyContentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/company/content";

  return (
    <PageShell
      width="wide"
      padding="relaxed"
      className="company-admin-shell app-directory-stack"
    >
      <PageHero
        eyebrow="Company CMS"
        title="Standardized public-site admin"
        description="Manage public content, inbound leads, pricing, FAQs, and the talent test from the same company-admin surface used for operations."
        actions={
          <>
            <Link href="/" className="app-button-secondary">
              Open public site
            </Link>
            <Link href="/company/schools" className="app-button-primary">
              Company operations
            </Link>
          </>
        }
        meta={
          <>
            <span className="app-meta-chip">8 content modules</span>
            <span className="app-meta-chip">Public-site CMS</span>
            <span className="app-meta-chip">Talent test controls included</span>
          </>
        }
        stats={[
          {
            label: "CMS areas",
            value: String(cmsNavItems.length),
            meta: "Stats, testimonials, leads, pricing, FAQs, and more.",
          },
          {
            label: "Admin mode",
            value: "Company-level",
            meta: "Central control without leaving the existing admin surface.",
          },
          {
            label: "Public sync",
            value: "Site-wide",
            meta: "Changes flow into homepage, product, benefits, contact, and talent test pages.",
          },
          {
            label: "Primary outcome",
            value: "Consistent publishing",
            meta: "One shell, one navigation rhythm, and one visual system.",
          },
        ]}
      >
        <div className="app-toolbar">
          <div className="space-y-3">
            <div className="app-toolbar-copy">
              <p className="app-toolbar-title">CMS navigation</p>
              <p className="app-toolbar-note">
                Switch between public-site editing surfaces without falling back to the older isolated teal forms.
              </p>
            </div>
            <nav className="company-admin-tabs" aria-label="Public site CMS navigation">
              {cmsNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn("company-admin-tab", active && "company-admin-tab-active")}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </PageHero>

      <div className="company-admin-content">{children}</div>
    </PageShell>
  );
}
