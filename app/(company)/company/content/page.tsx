import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
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

export const metadata: Metadata = {
  title: "Public Site CMS | Alyra Tech",
  description:
    "Manage public-site content, inbound messages, and the talent-test experience from the company admin surface.",
};

const contentCards = [
  {
    href: "/company/content/theme",
    title: "Theme Studio",
    description:
      "Preview public-site styles, switch palettes, and tune the homepage shell before opening the live site.",
    icon: Palette,
    tag: "Design system",
  },
  {
    href: "/company/content/stats",
    title: "Site Stats",
    description: "Update homepage, about, benefits, and case-study stat blocks.",
    icon: BarChart3,
    tag: "Metrics",
  },
  {
    href: "/company/content/testimonials",
    title: "Testimonials",
    description: "Manage trust signals across homepage, product, benefits, case study, and talent test pages.",
    icon: MessageSquareQuote,
    tag: "Social proof",
  },
  {
    href: "/company/content/messages",
    title: "Messages",
    description: "Review and triage contact-form submissions from the public site.",
    icon: Mail,
    tag: "Lead inbox",
  },
  {
    href: "/company/content/case-studies",
    title: "Case Studies",
    description: "Publish school success stories, metrics, and featured outcomes.",
    icon: BookOpenText,
    tag: "Stories",
  },
  {
    href: "/company/content/pricing",
    title: "Pricing Plans",
    description: "Control plan tiers and package details shown on the product page.",
    icon: WalletCards,
    tag: "Commercial",
  },
  {
    href: "/company/talent-test",
    title: "Talent Test",
    description: "Configure the public talent-test offer, schedule, and registration availability.",
    icon: Sparkles,
    tag: "Program",
  },
  {
    href: "/company/content/faq",
    title: "FAQs",
    description: "Keep page-specific answers current across the public site.",
    icon: CircleHelp,
    tag: "Support",
  },
  {
    href: "/company/content/contact-info",
    title: "Contact Info",
    description: "Update public phone, email, WhatsApp, and response-time details.",
    icon: PhoneCall,
    tag: "Contact",
  },
] as const;

export default function CompanyContentDashboardPage() {
  return (
    <div className="company-admin-page">
            <section className="company-admin-card-grid" aria-label="Company CMS sections">
        {contentCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="company-admin-link-card group">
              <div className="company-admin-link-card-icon">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="company-admin-link-card-title">{card.title}</h3>
                  <span className="app-meta-chip">{card.tag}</span>
                </div>
                <p className="company-admin-link-card-copy">{card.description}</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <span>Open section</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
