import Link from "next/link";
import { MapPinIcon, EnvelopeIcon, PhoneIcon } from "@heroicons/react/24/outline";

import { InnerHero } from "@/components/InnerHero";
import { LottieAnimation } from "@/components/LottieAnimation";
import { PublicFaqStack } from "@/components/public/PublicFaqStack";
import { PublicFinalCta } from "@/components/public/PublicFinalCta";
import { PublicInfoCardGrid } from "@/components/public/PublicInfoCardGrid";
import { PublicSectionIntro } from "@/components/public/PublicSectionIntro";
import { PublicStatsGrid } from "@/components/public/PublicStatsGrid";
import { getAboutPageData } from "@/lib/server/public-marketing";

export const revalidate = 60;

export const metadata = {
  title: "About Us | Alyra Tech",
  description: "Built by IITians & NITians to transform K-12 education.",
};

const coreValues = [
  {
    title: "Precision over intuition",
    description:
      "We break performance down to the concept and sub-skill level so schools act on evidence, not assumptions.",
  },
  {
    title: "Student-first outcomes",
    description:
      "Every report, recommendation, and worksheet exists to help one student get the right attention faster.",
  },
  {
    title: "Respect teacher time",
    description:
      "Teachers should spend more time teaching and less time reconstructing performance manually after every test.",
  },
];

const processSteps = [
  {
    step: "01",
    title: "Baseline assessment",
    description:
      "We capture a reliable picture of each student’s current understanding instead of waiting for term-end surprises.",
  },
  {
    step: "02",
    title: "Deep diagnostic analysis",
    description:
      "Our engine maps conceptual gaps, prerequisite issues, misconceptions, and learning patterns at a far finer level than marks alone.",
  },
  {
    step: "03",
    title: "Actionable reports",
    description:
      "School leaders, teachers, and families receive role-specific reports designed to help them make the next move quickly.",
  },
  {
    step: "04",
    title: "Track growth over time",
    description:
      "Repeated cycles show whether interventions are working and where the next instructional focus should move.",
  },
];

function getStatsColumns(length: number): 2 | 3 | 4 {
  if (length === 3) return 3;
  if (length <= 2) return 2;
  return 4;
}

export default async function AboutPage() {
  const { stats, faqs, contact } = await getAboutPageData();
  const waDigits = (contact.whatsappNumber || contact.phone).replace(/\D+/g, "");
  const waHref = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
        "Hello! I would like to request a demo of Alyra Tech’s diagnostics for our school.",
      )}`
    : "";

  return (
    <main className="public-page">
      <InnerHero
        title="Built by educators, operators, and problem-solvers who wanted better evidence"
        subtitle="We started Alyra Tech because marks alone were hiding the real reasons students struggled, and schools deserved something far more actionable."
        pillText="Our Mission"
        variant="story"
        lottieLeft="/animations/seo-isometric-team.lottie"
        whatsappHref={waHref}
      >
        <Link href="/contact" className="public-button-primary">
          Talk to our team
        </Link>
        <Link href="/product" className="public-button-secondary">
          Explore the platform
        </Link>
      </InnerHero>

      <section className="public-section">
        <div className="public-shell">
          <div className="grid gap-10 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
            <div className="space-y-6">
              <PublicSectionIntro
                eyebrow="Our Story"
                title="Marks don&apos;t tell the whole story."
                description="A 60% score in mathematics can hide ten different issues. It might be a prerequisite gap, a misconception, a careless procedural habit, or a pace problem."
                align="left"
                compact
              />
              <div className="space-y-5 text-base leading-8 text-[hsl(var(--public-ink-soft))]">
                <p>
                  As graduates from <strong>IITs and NITs</strong>, we saw too
                  many capable students fall behind because the system could not
                  explain why they were struggling.
                </p>
                <p>
                  We built <strong>Alyra Tech</strong> so schools could see the
                  real learning pattern underneath every score and act before a
                  student lost confidence.
                </p>
                <p>
                  The goal is simple: better evidence, faster intervention, and
                  more students getting the right help at the right time.
                </p>
              </div>
            </div>

            <div className="public-panel-soft flex items-center justify-center p-6 md:p-8">
              <LottieAnimation
                src="/animations/team-collaboration.lottie"
                className="h-[260px] w-full max-w-lg md:h-[320px]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          <div className="public-band p-8 md:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
              <div>
                <div className="public-eyebrow mb-5">Founder&apos;s Note</div>
                <h2 className="public-heading text-3xl font-semibold tracking-tight md:text-4xl">
                  Every student deserves the kind of attention that changes a
                  learning path early.
                </h2>
                <p className="mt-5 text-base leading-8 text-[hsl(var(--public-ink-soft))] md:text-lg">
                  The students we worry most about are often not the ones who
                  score the lowest. They are the ones whose real issue stays
                  hidden for too long. Once schools can see the exact gap, they
                  can respond with far more confidence.
                </p>
              </div>

              <div className="public-card p-6 md:p-8">
                <p className="text-lg leading-8 text-[hsl(var(--public-ink-soft))]">
                  &ldquo;With the right evidence, we don&apos;t just improve
                  grades. We help teachers intervene earlier, help parents
                  understand more clearly, and help students feel seen instead
                  of labelled.&rdquo;
                </p>
                <div className="mt-6 border-t border-[hsl(var(--public-border)/0.7)] pt-4">
                  <p className="text-base font-semibold text-[hsl(var(--public-ink))]">
                    Uday Suram
                  </p>
                  <p className="mt-1 text-sm text-[hsl(var(--public-muted))]">
                    CEO & Founder, Alyra Tech
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          <PublicSectionIntro
            eyebrow="Scale"
            title="Built for sustained school impact, not isolated pilots"
            description="The mission only matters if the system works at real school scale, across classes, sections, and changing academic cycles."
          />
          <PublicStatsGrid
            items={stats.map((stat) => ({
              icon: stat.icon ? <span>{stat.icon}</span> : undefined,
              value: stat.value,
              label: stat.label,
            }))}
            columns={getStatsColumns(stats.length)}
            className="mt-12"
          />
        </div>
      </section>

      <section className="public-section">
        <div className="public-shell">
          <div className="public-band-dark p-8 md:p-10 lg:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.95fr,1.05fr]">
              <div>
                <PublicSectionIntro
                  eyebrow="Core Values"
                  title="Calm systems, precise diagnosis, and respect for real school constraints"
                  description="We design for school leaders and teachers who need clarity and follow-through, not more dashboard noise."
                  align="left"
                  compact
                  titleClassName="!text-white"
                  descriptionClassName="!text-white/78"
                />
              </div>

              <div className="grid gap-4">
                {coreValues.map((value) => (
                  <article key={value.title} className="public-card p-6 md:p-7">
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))]">
                      {value.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[hsl(var(--public-muted))]">
                      {value.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          <PublicSectionIntro
            eyebrow="Contact"
            title="Talk directly to the team behind the work"
            description="If you want to understand rollout, reports, diagnostics, or school fit, the fastest path is still a direct conversation."
            actions={
              waHref ? (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="public-button-primary"
                >
                  Chat on WhatsApp
                </a>
              ) : undefined
            }
          />

          <PublicInfoCardGrid
            className="mt-12"
            items={[
              {
                eyebrow: "Email",
                title: contact.email,
                supportingText: "For demos, partnerships, and questions.",
                icon: <EnvelopeIcon className="h-5 w-5" />,
                href: `mailto:${contact.email}`,
              },
              {
                eyebrow: "Phone",
                title: contact.phone,
                supportingText: "Speak to the team directly.",
                icon: <PhoneIcon className="h-5 w-5" />,
                href: `tel:${contact.phone.replace(/\s+/g, "")}`,
              },
              {
                eyebrow: "HQ",
                title: contact.city,
                supportingText: contact.address,
                icon: <MapPinIcon className="h-5 w-5" />,
              },
            ]}
          />
        </div>
      </section>

      <section className="public-section">
        <div className="public-shell">
          <PublicSectionIntro
            eyebrow="How We Work"
            title="A diagnostic cycle that schools can actually operationalize"
            description="The value is not just in identifying gaps. It is in turning those gaps into a repeatable action loop for leaders, teachers, and families."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {processSteps.map((step) => (
              <article key={step.step} className="public-card-soft p-6 md:p-7">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-accent))]">
                  {step.step}
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[hsl(var(--public-muted))]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {faqs.length > 0 ? (
        <section className="public-section">
          <div className="public-shell-narrow">
            <PublicSectionIntro
              eyebrow="FAQ"
              title="A few things schools usually ask about us"
              description="If you are evaluating fit, these are the questions that usually come up first."
            />
            <PublicFaqStack items={faqs} className="mt-12" />
          </div>
        </section>
      ) : null}

      <section className="public-section pt-0">
        <div className="public-shell">
          <PublicFinalCta
            eyebrow="See It Live"
            title="Want to understand how Alyra Tech would work inside your school?"
            description="We can walk you through the diagnostic depth, the reporting model, and the rollout path that makes sense for your team."
            primaryAction={{ href: "/contact", label: "Schedule a demo" }}
            secondaryAction={{
              href: waHref || "/talent-test",
              label: waHref ? "Request on WhatsApp" : "Try the talent test",
              external: Boolean(waHref),
            }}
            visual={
              <LottieAnimation
                src="/animations/rocket-success.lottie"
                className="h-[220px] w-full max-w-sm"
              />
            }
          />
        </div>
      </section>
    </main>
  );
}
