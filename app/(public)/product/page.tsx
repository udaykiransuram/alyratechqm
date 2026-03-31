import Link from "next/link";
import { unstable_cache } from "next/cache";
import { CheckIcon } from "@heroicons/react/20/solid";

import { InnerHero } from "@/components/InnerHero";
import { LottieAnimation } from "@/components/LottieAnimation";
import { ProductSolutions } from "@/components/ProductSolutions";
import { PublicFaqStack } from "@/components/public/PublicFaqStack";
import { PublicFinalCta } from "@/components/public/PublicFinalCta";
import { PublicSectionIntro } from "@/components/public/PublicSectionIntro";
import { PublicStatsGrid } from "@/components/public/PublicStatsGrid";
import { PublicTestimonialsGrid } from "@/components/public/PublicTestimonialsGrid";
import { connectDB } from "@/lib/db";
import { resolvePublicPageData } from "@/lib/server/public-page-data";
import FAQ from "@/models/FAQ";
import PricingPlan from "@/models/PricingPlan";
import SiteStats from "@/models/SiteStats";
import Testimonial from "@/models/Testimonial";

export const metadata = {
  title: "Solutions | Alyra Tech",
  description:
    "Explore Alyra Tech solutions for diagnostics, ERP, alumni engagement, and OMR-based academic intelligence.",
};

export const revalidate = 60;

interface Tier {
  name: string;
  id: string;
  href: string;
  priceDisplay: string;
  periodLabel: string;
  description: string;
  features: string[];
  mostPopular: boolean;
  studentLimit: number;
}

type TrustStat = {
  key: string;
  label: string;
  value: string;
  icon?: string;
};

interface ProductTestimonial {
  quote: string;
  author: string;
  role: string;
  rating: number;
}

interface FAQItem {
  question: string;
  answer: string;
}

const DEFAULT_TRUST: TrustStat[] = [
  { key: "schools", label: "Schools Onboarded", value: "500+", icon: "🏫" },
  { key: "students", label: "Students Diagnosed", value: "50K+", icon: "👨‍🎓" },
  { key: "renewalRate", label: "Renewal Rate", value: "98%", icon: "🔄" },
];

const PRODUCT_PAGE_FALLBACK = {
  tiers: [] as Tier[],
  trustStats: DEFAULT_TRUST,
  testimonials: [] as ProductTestimonial[],
  faqs: [] as FAQItem[],
};

function fmtPrice(price: number, currency = "INR") {
  if (price === 0) return "Custom";
  return `${currency === "INR" ? "₹" : `${currency} `}${price.toLocaleString("en-IN")}`;
}

function fmtPeriod(billingPeriod: string) {
  return billingPeriod === "monthly"
    ? "/month"
    : billingPeriod === "yearly"
      ? "/year"
      : "";
}

function getStatsColumns(length: number): 2 | 3 | 4 {
  if (length === 3) return 3;
  if (length <= 2) return 2;
  return 4;
}

const getProductPageData = unstable_cache(
  async () => {
    return resolvePublicPageData(
      async () => {
        await connectDB();

        const [plans, statsDoc, testimonials, faqDocs]: [any[], any, any[], any[]] =
          await Promise.all([
            PricingPlan.find({ isActive: true }).sort({ displayOrder: 1 }).lean(),
            SiteStats.findOne({ section: "homepage" }).lean(),
            Testimonial.find({ section: "product", isActive: true })
              .sort({ displayOrder: 1 })
              .lean(),
            FAQ.find({ page: "product", isActive: true })
              .sort({ displayOrder: 1 })
              .lean(),
          ]);

        const tiers: Tier[] = plans.length
          ? plans.map((plan: any) => ({
              name: plan.name,
              id: `tier-${plan._id}`,
              href: "/contact",
              priceDisplay: fmtPrice(plan.price, plan.currency),
              periodLabel: fmtPeriod(plan.billingPeriod),
              description: plan.description,
              features: plan.features ?? [],
              mostPopular: Boolean(plan.isPopular),
              studentLimit: plan.studentLimit || 0,
            }))
          : [];

        const trustStats: TrustStat[] = (statsDoc?.stats ?? []).length
          ? (statsDoc.stats as any[]).map((stat: any) => ({
              key: stat.key,
              label: stat.label,
              value: String(stat.value),
              icon: stat.icon,
            }))
          : DEFAULT_TRUST;

        const productTestimonials: ProductTestimonial[] = testimonials.length
          ? testimonials.map((testimonial: any) => ({
              quote: testimonial.quote,
              author: testimonial.author,
              role: [testimonial.role, testimonial.school, testimonial.location]
                .filter(Boolean)
                .join(", "),
              rating: testimonial.rating ?? 5,
            }))
          : [];

        return {
          tiers,
          trustStats,
          testimonials: productTestimonials,
          faqs: faqDocs.map((faq: any) => ({
            question: faq.question,
            answer: faq.answer,
          })) as FAQItem[],
        };
      },
      PRODUCT_PAGE_FALLBACK,
      2000,
    );
  },
  ["public-product-page-data"],
  { revalidate: 60 },
);

export default async function ProductPage() {
  const {
    tiers,
    trustStats,
    testimonials: productTestimonials,
    faqs,
  } = await getProductPageData();

  return (
    <main className="public-page">
      <InnerHero
        title="Everything your school needs to operate, diagnose, and grow"
        subtitle="Alyra Tech brings diagnostics, school operations, report delivery, and academic intelligence into one premium system designed for real school teams."
        pillText="Solutions"
        variant="flagship"
        lottieRight="/animations/online-learning-platform.lottie"
        lottieLeft="/animations/growth-chart.lottie"
      >
        <Link href="/contact" className="public-button-primary">
          Book a demo
        </Link>
        <Link href="/talent-test" className="public-button-secondary">
          Explore talent test
        </Link>
      </InnerHero>

      <ProductSolutions />

      {tiers.length > 0 ? (
        <section className="public-section public-section-divider">
          <div className="public-shell">
            <PublicSectionIntro
              eyebrow="Pricing"
              title="Transparent plans for institutions that want clarity early"
              description="Choose a starting point, run a pilot, and expand only when the academic and operational value is obvious."
            />

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {tiers.map((tier) => (
                <article
                  key={tier.id}
                  className={
                    tier.mostPopular
                      ? "public-panel relative flex h-full flex-col justify-between p-7 md:p-8"
                      : "public-card relative flex h-full flex-col justify-between p-7 md:p-8"
                  }
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))]">
                        {tier.name}
                      </h3>
                      {tier.mostPopular ? (
                        <span className="public-eyebrow border-[hsl(var(--public-accent))/0.18] bg-[hsl(var(--public-accent))/0.1] px-3 py-1 text-[10px] text-[hsl(var(--public-accent))]">
                          Most Popular
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-4 text-sm leading-7 text-[hsl(var(--public-muted))]">
                      {tier.description}
                    </p>

                    <div className="mt-7 flex items-end gap-2">
                      <div className="text-4xl font-semibold tracking-[-0.05em] text-[hsl(var(--public-ink))]">
                        {tier.priceDisplay}
                      </div>
                      {tier.periodLabel ? (
                        <div className="pb-1 text-sm font-medium text-[hsl(var(--public-muted))]">
                          {tier.periodLabel}
                        </div>
                      ) : null}
                    </div>

                    <ul className="mt-8 space-y-3 text-sm leading-7 text-[hsl(var(--public-ink-soft))]">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <CheckIcon className="mt-0.5 h-5 w-5 flex-none text-[hsl(var(--public-accent))]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                      {tier.studentLimit > 0 ? (
                        <li className="flex items-start gap-3 font-medium text-[hsl(var(--public-ink))]">
                          <CheckIcon className="mt-0.5 h-5 w-5 flex-none text-[hsl(var(--public-accent))]" />
                          <span>
                            Up to {tier.studentLimit.toLocaleString()} students
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  </div>

                  <Link
                    href={tier.href}
                    className={`mt-8 ${tier.mostPopular ? "public-button-primary" : "public-button-secondary"}`}
                  >
                    Get started
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="public-section">
        <div className="public-shell">
          <div className="public-band-dark p-8 md:p-12 lg:p-14">
            <PublicSectionIntro
              eyebrow="Trust"
              title="Trusted by schools that need better academic visibility"
              description="Alyra Tech is built for principals and academic leaders who want deeper evidence, cleaner operations, and faster action after every test cycle."
              className="max-w-2xl"
              align="left"
              titleClassName="!text-white"
              descriptionClassName="!text-white/78"
            />

            <PublicStatsGrid
              items={trustStats.map((stat) => ({
                icon: stat.icon ? <span>{stat.icon}</span> : undefined,
                value: stat.value,
                label: stat.label,
              }))}
              columns={getStatsColumns(trustStats.length)}
              tone="dark"
              className="mt-10"
            />
          </div>
        </div>
      </section>

      {productTestimonials.length > 0 ? (
        <section className="public-section">
          <div className="public-shell">
            <PublicSectionIntro
              eyebrow="Testimonials"
              title="What school teams say after rollout"
              description="The value shows up in faster decisions, clearer teaching plans, and reports that people actually use."
            />
            <PublicTestimonialsGrid
              items={productTestimonials.map((testimonial) => ({
                quote: testimonial.quote,
                author: testimonial.author,
                role: testimonial.role,
                rating: testimonial.rating,
              }))}
              className="mt-12"
            />
          </div>
        </section>
      ) : null}

      {faqs.length > 0 ? (
        <section className="public-section">
          <div className="public-shell-narrow">
            <PublicSectionIntro
              eyebrow="FAQ"
              title="Questions teams usually ask before they start"
              description="The first conversation is usually about rollout, reports, and what changes for the school team. Here are the common answers."
            />
            <PublicFaqStack items={faqs} className="mt-12" />
          </div>
        </section>
      ) : null}

      <section className="public-section pt-0">
        <div className="public-shell">
          <PublicFinalCta
            eyebrow="Ready to Start"
            title="See how Alyra Tech can fit your school before you commit."
            description="Run a pilot, review the diagnostic depth, and decide from real outcomes instead of a sales deck."
            primaryAction={{ href: "/contact", label: "Book a demo" }}
            secondaryAction={{
              href: "/talent-test",
              label: "Try the talent test",
            }}
            visual={
              <LottieAnimation
                src="/animations/seo-team-isometric.lottie"
                className="h-[220px] w-full max-w-sm"
              />
            }
          />
        </div>
      </section>
    </main>
  );
}
