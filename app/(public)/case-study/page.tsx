import Link from "next/link";
import { unstable_cache } from "next/cache";

import { InnerHero } from "@/components/InnerHero";
import { LottieAnimation } from "@/components/LottieAnimation";
import { PublicFinalCta } from "@/components/public/PublicFinalCta";
import { PublicSectionIntro } from "@/components/public/PublicSectionIntro";
import { PublicStatsGrid } from "@/components/public/PublicStatsGrid";
import { PublicTestimonialsGrid } from "@/components/public/PublicTestimonialsGrid";
import { connectDB } from "@/lib/db";
import { resolvePublicPageData } from "@/lib/server/public-page-data";
import CaseStudy from "@/models/CaseStudy";
import SiteStats from "@/models/SiteStats";
import Testimonial from "@/models/Testimonial";

export const revalidate = 60;

interface CSData {
  schoolName: string;
  location: string;
  studentCount: number;
  challenge: string;
  solution: string;
  resultsText: string;
  quote: string;
  quoteAuthor: string;
  metrics: { metric: string; label: string; sub: string }[];
}

interface HeaderStat {
  value: string;
  label: string;
  icon: string;
}

interface TestimonialData {
  quote: string;
  author: string;
  role: string;
  school: string;
  rating: number;
}

const DEFAULT_HEADER_STATS: HeaderStat[] = [
  { value: "500+", label: "Schools Served", icon: "🏫" },
  { value: "85%", label: "Avg. Improvement", icon: "📈" },
  { value: "2M+", label: "Students Impacted", icon: "👨‍🎓" },
  { value: "95%", label: "Satisfaction Rate", icon: "⭐" },
];

const CASE_STUDY_FALLBACK = {
  featured: null as CSData | null,
  otherCaseStudies: [] as CSData[],
  headerStats: DEFAULT_HEADER_STATS,
  testimonials: [] as TestimonialData[],
};

function docToCS(doc: any): CSData {
  return {
    schoolName: doc.schoolName || "School Name",
    location: doc.location || "",
    studentCount: doc.studentCount || 0,
    challenge: doc.challenge || "",
    solution: doc.solution || "",
    resultsText: doc.results?.length ? doc.results.join(" ") : "",
    quote: doc.testimonial?.quote || "",
    quoteAuthor:
      [doc.testimonial?.role, doc.testimonial?.author]
        .filter(Boolean)
        .join(", ") || "",
    metrics: doc.metrics?.length
      ? doc.metrics.map(
          (metric: {
            improvement: string;
            label: string;
            before: string | number;
            after: string | number;
          }) => ({
            metric: metric.improvement,
            label: metric.label,
            sub: `${metric.before} -> ${metric.after}`,
          }),
        )
      : [],
  };
}

function getStatsColumns(length: number): 2 | 3 | 4 {
  if (length === 3) return 3;
  if (length <= 2) return 2;
  return 4;
}

const getCaseStudyData = unstable_cache(
  async () => {
    return resolvePublicPageData(
      async () => {
        await connectDB();
        const [docs, statsDoc, testimonials]: [any[], any, any[]] =
          await Promise.all([
            CaseStudy.find({ isActive: true })
              .sort({ isFeatured: -1, displayOrder: 1 })
              .lean(),
            SiteStats.findOne({ section: "casestudy" }).lean(),
            Testimonial.find({ section: "casestudy", isActive: true })
              .sort({ displayOrder: 1 })
              .lean(),
          ]);

        const featuredDoc = docs.find((doc: any) => doc.isFeatured) || docs[0] || null;
        const featured = featuredDoc ? docToCS(featuredDoc) : null;
        const otherCaseStudies = (featuredDoc
          ? docs.filter((doc: any) => doc !== featuredDoc)
          : []
        ).map(docToCS);

        const headerStats: HeaderStat[] = statsDoc?.stats?.length
          ? statsDoc.stats.map((stat: any) => ({
              value: String(stat.value),
              label: stat.label || stat.key,
              icon: stat.icon || "📊",
            }))
          : DEFAULT_HEADER_STATS;

        const caseStudyTestimonials: TestimonialData[] = testimonials.length
          ? testimonials.map((testimonial: any) => ({
              quote: testimonial.quote,
              author: testimonial.author,
              role: testimonial.role,
              school: [testimonial.school, testimonial.location]
                .filter(Boolean)
                .join(", "),
              rating: testimonial.rating ?? 5,
            }))
          : [];

        return {
          featured,
          otherCaseStudies,
          headerStats,
          testimonials: caseStudyTestimonials,
        };
      },
      CASE_STUDY_FALLBACK,
      2000,
    );
  },
  ["public-case-study-page-data"],
  { revalidate: 60 },
);

export async function generateMetadata() {
  const { featured } = await getCaseStudyData();

  return {
    title: "Case Studies | Alyra Tech",
    description: featured
      ? `See how schools like ${featured.schoolName} transformed academic outcomes with Alyra Tech.`
      : "See how schools are transforming academic outcomes with Alyra Tech.",
  };
}

export default async function CaseStudyPage() {
  const { featured, otherCaseStudies, headerStats, testimonials } =
    await getCaseStudyData();

  return (
    <main className="public-page">
      <InnerHero
        title="Real school stories, measurable academic movement"
        subtitle="See how partner schools use Alyra Tech to move from broad score summaries to precise, actionable academic decisions."
        pillText="Case Studies"
        variant="story"
        lottieRight="/animations/school-building.lottie"
        lottieLeft="/animations/success-graduation.lottie"
      >
        <Link href="/contact" className="public-button-primary">
          Talk to our team
        </Link>
        <Link href="/product" className="public-button-secondary">
          See solutions
        </Link>
      </InnerHero>

      <section className="public-section">
        <div className="public-shell">
          <PublicStatsGrid
            items={headerStats.map((stat) => ({
              icon: <span>{stat.icon}</span>,
              value: stat.value,
              label: stat.label,
            }))}
            columns={getStatsColumns(headerStats.length)}
          />
        </div>
      </section>

      <section className="public-section pt-0">
        <div className="public-shell">
          {featured ? (
            <>
              <PublicSectionIntro
                eyebrow="Featured Story"
                title={featured.schoolName}
                description={`${featured.location} • ${featured.studentCount.toLocaleString()} students • A closer look at how one school moved from surface scores to sharper academic action.`}
              />

              <div className="mt-12 grid gap-8 lg:grid-cols-[1.05fr,0.95fr] lg:items-start">
                <div className="grid gap-4">
                  <article className="public-card p-6 md:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-muted))]">
                      The Challenge
                    </p>
                    <p className="mt-4 text-base leading-8 text-[hsl(var(--public-ink-soft))]">
                      {featured.challenge}
                    </p>
                  </article>

                  <article className="public-card p-6 md:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-muted))]">
                      The Solution
                    </p>
                    <p className="mt-4 text-base leading-8 text-[hsl(var(--public-ink-soft))]">
                      {featured.solution}
                    </p>
                  </article>

                  <article className="public-panel p-6 md:p-7">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-accent))]">
                      The Result
                    </p>
                    <p className="mt-4 text-base leading-8 text-[hsl(var(--public-ink-soft))]">
                      {featured.resultsText}
                    </p>
                  </article>
                </div>

                <div className="space-y-6">
                  <div className="public-panel-soft flex items-center justify-center p-6 md:p-8">
                    <LottieAnimation
                      src="/animations/online-learning-scene.lottie"
                      className="h-[260px] w-full max-w-lg md:h-[320px]"
                    />
                  </div>

                  {featured.quote ? (
                    <article className="public-card p-6 md:p-7">
                      <p className="text-base leading-8 text-[hsl(var(--public-ink-soft))]">
                        &ldquo;{featured.quote}&rdquo;
                      </p>
                      <p className="mt-5 text-sm font-medium text-[hsl(var(--public-muted))]">
                        {featured.quoteAuthor}
                      </p>
                    </article>
                  ) : null}
                </div>
              </div>

              {featured.metrics.length > 0 ? (
                <div className="mt-12">
                  <PublicSectionIntro
                    eyebrow="Key Metrics"
                    title={`What changed for ${featured.schoolName}`}
                    description="The strongest case studies make the improvement obvious in both teacher decisions and the numbers underneath them."
                  />
                  <PublicStatsGrid
                    items={featured.metrics.map((metric) => ({
                      value: metric.metric,
                      label: metric.label,
                      note: metric.sub,
                    }))}
                    columns={getStatsColumns(featured.metrics.length)}
                    className="mt-10"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <div className="public-panel mx-auto max-w-3xl p-8 text-center md:p-12">
              <div className="text-5xl">📚</div>
              <h2 className="public-heading mt-6 text-3xl font-semibold tracking-tight md:text-4xl">
                Case studies are on the way.
              </h2>
              <p className="public-copy mx-auto mt-4 max-w-2xl text-base leading-8 md:text-lg">
                We&apos;re documenting school transformation stories with the
                same level of care we bring to the reporting itself.
              </p>
              <Link href="/contact" className="public-button-primary mt-8">
                Get in touch
              </Link>
            </div>
          )}
        </div>
      </section>

      {otherCaseStudies.length > 0 ? (
        <section className="public-section pt-0">
          <div className="public-shell">
            <PublicSectionIntro
              eyebrow="More Stories"
              title="More schools using evidence to move faster"
              description="Each rollout looks a little different, but the pattern is the same: clearer diagnosis, better intervention, and more confident academic planning."
            />

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {otherCaseStudies.map((study) => (
                <article key={study.schoolName} className="public-card p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[hsl(var(--public-ink))]">
                        {study.schoolName}
                      </h3>
                      <p className="mt-2 text-sm text-[hsl(var(--public-muted))]">
                        {study.location} • {study.studentCount.toLocaleString()} students
                      </p>
                    </div>
                    <div className="public-icon-chip">
                      {study.schoolName.charAt(0)}
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-muted))]">
                        Challenge
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[hsl(var(--public-ink-soft))]">
                        {study.challenge}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[hsl(var(--public-accent))]">
                        Result
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[hsl(var(--public-ink-soft))]">
                        {study.resultsText}
                      </p>
                    </div>
                  </div>

                  {study.metrics.length > 0 ? (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {study.metrics.slice(0, 4).map((metric) => (
                        <div
                          key={`${study.schoolName}-${metric.label}`}
                          className="public-card-soft p-4 text-center"
                        >
                          <p className="text-lg font-semibold tracking-[-0.04em] text-[hsl(var(--public-ink))]">
                            {metric.metric}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[hsl(var(--public-muted))]">
                            {metric.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {study.quote ? (
                    <div className="mt-6 border-t border-[hsl(var(--public-border)/0.7)] pt-4">
                      <p className="text-sm leading-7 text-[hsl(var(--public-ink-soft))]">
                        &ldquo;{study.quote}&rdquo;
                      </p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[hsl(var(--public-muted))]">
                        {study.quoteAuthor}
                      </p>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {testimonials.length > 0 ? (
        <section className="public-section">
          <div className="public-shell">
            <PublicSectionIntro
              eyebrow="Testimonials"
              title="What educators say after implementation"
              description="Across schools, the common feedback is not just better analytics. It&apos;s better confidence in what to do next."
            />
            <PublicTestimonialsGrid
              items={testimonials.map((testimonial) => ({
                quote: testimonial.quote,
                author: testimonial.author,
                role: testimonial.role,
                school: testimonial.school,
                rating: testimonial.rating,
              }))}
              className="mt-12"
            />
          </div>
        </section>
      ) : null}

      <section className="public-section pt-0">
        <div className="public-shell">
          <PublicFinalCta
            eyebrow="Want Similar Outcomes?"
            title="Let data guide the next phase of your school&apos;s academic strategy."
            description="Start with a baseline assessment, review the report depth, and see what the school would gain before planning a broader rollout."
            primaryAction={{ href: "/contact", label: "Talk to our team" }}
            secondaryAction={{ href: "/register", label: "Register your school" }}
          />
        </div>
      </section>
    </main>
  );
}
