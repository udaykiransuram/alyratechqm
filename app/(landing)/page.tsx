import Link from 'next/link';
import Image from 'next/image';
import { unstable_cache } from 'next/cache';
import { Hero3D } from '@/components/Landing3D';
import { ProCard } from '@/components/ProCard';
import GlassPanel from '@/components/GlassPanel';
import { Reveal, Stagger } from '@/components/Reveal';
import { connectDB } from '@/lib/db';
import SiteStats from '@/models/SiteStats';
import TalentTestConfig from '@/models/TalentTestConfig';
import Testimonial from '@/models/Testimonial';
import FAQ from '@/models/FAQ';
import ContactInfo from '@/models/ContactInfo';

export const revalidate = 60;

export const metadata = {
  title: 'Alyra Tech — The Future of Education Intelligence',
  description: 'AI-driven diagnostics for K-12 education. Identify learning gaps with precision.',
};

const getHomePageData = unstable_cache(
  async () => {
    try {
      await connectDB();
      const [statsDoc, testConfig, testimonials, faqDocs, contactInfo]: [
        any,
        any,
        any[],
        any[],
        any,
      ] = await Promise.all([
        SiteStats.findOne({ section: 'homepage' }).lean(),
        TalentTestConfig.findOne().lean(),
        Testimonial.find({ section: 'homepage', isActive: true })
          .sort({ displayOrder: 1 })
          .lean(),
        FAQ.find({ page: 'homepage', isActive: true })
          .sort({ displayOrder: 1 })
          .lean(),
        ContactInfo.findOne().lean(),
      ]);

      // Mirror Contact page behavior: fallback to phone if whatsappNumber is not set
      const rawWa = (
        contactInfo?.whatsappNumber ||
        contactInfo?.phone ||
        process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
        ''
      ).toString();
      const digits = rawWa.replace(/\D+/g, '');
      const whatsappHref = digits
        ? `https://wa.me/${digits}?text=${encodeURIComponent('Hello! I’d like to know more about Alyra Tech’s diagnostics.')}`
        : '';

      return {
        stats: statsDoc?.stats ?? [],
        testConfig: testConfig ?? null,
        testimonials: testimonials.map((t: any) => ({
          quote: t.quote,
          author: t.author,
          role: [t.role, t.school, t.location].filter(Boolean).join(', '),
          rating: t.rating ?? 5,
          image: t.image || null,
        })),
        faqs: faqDocs.map((f: any) => ({
          question: f.question,
          answer: f.answer,
        })),
        whatsappHref,
      };
    } catch {
      return {
        stats: [],
        testConfig: null,
        testimonials: [],
        faqs: [],
        whatsappHref: '',
      };
    }
  },
  ["public-homepage"],
  { revalidate: 60 },
);

export default async function HomePage() {
  const { stats, testConfig, testimonials, faqs, whatsappHref } =
    await getHomePageData();

  const homeStats: { key: string; label: string; value: string; icon?: string }[] =
    stats.length
      ? stats.map(
          (s: {
            key: string;
            label: string;
            value: string | number;
            icon?: string;
          }) => ({
            key: s.key,
            label: s.label,
            value: String(s.value),
            icon: s.icon,
          }),
        )
      : [
          { key: 'tested', label: 'Students Tested', value: '50K+', icon: '👨‍🎓' },
          { key: 'schools', label: 'Schools', value: '500+', icon: '🏫' },
          {
            key: 'accuracy',
            label: 'Diagnostic Accuracy',
            value: '100%',
            icon: '🎯',
          },
          { key: 'time', label: 'Teacher Time Saved', value: '40%', icon: '⏱️' },
        ];
  const testPrice = typeof testConfig?.price === 'number' ? testConfig.price : undefined;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,hsl(var(--background))_0%,hsl(var(--app-surface-2)/0.62)_100%)] text-slate-900 transition-colors duration-500 selection:bg-teal-500/30 dark:bg-slate-950 dark:text-slate-100">
      <div className="relative overflow-hidden">
        <Hero3D whatsappHref={whatsappHref} />
      </div>

      <section
        aria-labelledby="value-heading"
        className="relative border-t border-slate-200/70 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.1),transparent_34%),linear-gradient(180deg,#fcfdfd_0%,#f2f7f7_100%)] py-16 text-gray-900 dark:text-gray-100 md:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="mx-auto max-w-4xl text-center">
              <span className="inline-flex items-center rounded-full border border-teal-500/16 bg-white/88 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 shadow-[0_16px_30px_-24px_rgba(13,148,136,0.18)] sm:text-sm">
                Post-assessment command center
              </span>
              <h2
                id="value-heading"
                className="mt-4 text-3xl font-semibold leading-[1.08] tracking-[-0.05em] text-slate-950 sm:text-4xl md:text-5xl"
              >
                Clear insight. Faster action. Better outcomes.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg md:text-xl">
                Get leadership-ready analytics and teacher-ready recommendations
                from one diagnostic flow.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 md:mt-12">
            <div className="rounded-[2.2rem] border border-slate-300/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(243,249,249,0.92))] p-4 shadow-[0_30px_70px_-40px_rgba(15,23,42,0.22)] sm:p-6 md:p-10">
              <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 md:gap-10">
                <div className="lg:col-span-5">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 shadow-[0_14px_24px_-24px_rgba(15,23,42,0.16)]">
                    Decision layer
                  </span>
                  <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-3xl">
                    One diagnostic, multiple layers of decision intelligence.
                  </h3>
                  <p className="mt-4 leading-relaxed text-slate-700">
                    School leaders see trends, teachers get intervention
                    clarity, and students receive targeted support — all from
                    the same assessment cycle.
                  </p>

                  <div className="mt-6 space-y-3">
                    {[
                      'School → class → student drill-down in seconds',
                      'Topic-level error pattern tracking',
                      'Action-ready remediation guidance',
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-start gap-3 text-sm text-slate-700 sm:text-base"
                      >
                        <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border border-teal-500/14 bg-teal-500/10 text-xs font-bold text-teal-700 shadow-[0_12px_20px_-20px_rgba(13,148,136,0.22)]">
                          ✓
                        </span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link
                      href="/talent-test"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 font-semibold text-white shadow-[0_18px_34px_-22px_rgba(15,23,42,0.34)] transition-all hover:-translate-y-0.5 hover:bg-slate-900"
                    >
                      Start Baseline Test
                    </Link>
                    <Link
                      href="/contact"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 shadow-[0_14px_24px_-24px_rgba(15,23,42,0.16)] transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50"
                    >
                      Request Demo
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-7">
                  <div className="rounded-[1.8rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,250,0.94))] p-4 shadow-[0_24px_52px_-36px_rgba(15,23,42,0.22)] sm:p-5">
                    <div className="relative w-full">
                      <div className="pt-[56%]" />
                      <Image
                        src="/images/source-frontend/ttf-gemini-6cards.png"
                        alt="Diagnostic analytics dashboard preview"
                        fill
                        sizes="(max-width: 1024px) 100vw, 55vw"
                        className="object-contain"
                        priority
                      />
                    </div>
                  </div>

                  <div
                    className={`mt-4 grid grid-cols-2 gap-3 ${homeStats.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}
                  >
                    {homeStats.map((s) => (
                      <div
                        key={`top-${s.key}`}
                        className="rounded-[1.2rem] border border-slate-200/80 bg-white/86 px-3 py-3 text-center shadow-[0_12px_20px_-22px_rgba(15,23,42,0.12)]"
                      >
                        <div className="text-lg font-semibold tabular-nums text-slate-950 sm:text-xl">
                          {s.value}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 md:mt-10">
              <Stagger className="grid grid-cols-1 gap-6 items-stretch sm:grid-cols-2 sm:gap-8 md:gap-10 lg:grid-cols-4">
                {[
                  {
                    icon: '📊',
                    title: 'Performance Snapshot',
                    desc: 'Instant school → class → student intelligence in one clear view.',
                  },
                  {
                    icon: '🧭',
                    title: 'Strengths & Risks',
                    desc: 'Spot top-performing skills and early-risk areas before scores drop.',
                  },
                  {
                    icon: '🧩',
                    title: 'Misconceptions Map',
                    desc: 'Separate conceptual gaps from procedural errors by topic.',
                  },
                  {
                    icon: '✅',
                    title: 'Action Playbook',
                    desc: 'Get practical teaching moves and worksheet recommendations.',
                  },
                ].map((c) => (
                  <ProCard
                    key={c.title}
                    icon={c.icon}
                    title={c.title}
                    description={c.desc}
                    accent="teal"
                  />
                ))}
              </Stagger>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="solutions-heading"
        className="relative z-10 border-t border-slate-200/20 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.14),transparent_18%),linear-gradient(135deg,#07151a_0%,#081b20_52%,#0b2d33_100%)] py-16 md:py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center md:mb-14">
            <span className="mb-5 inline-flex items-center rounded-full border border-teal-200/30 bg-white/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-100 shadow-[0_18px_34px_-26px_rgba(45,212,191,0.22)] sm:text-sm">
              Platform Capabilities
            </span>
            <h2
              id="solutions-heading"
              className="mb-7 text-3xl font-semibold tracking-[-0.05em] text-white md:text-5xl"
            >
              From diagnostics to institution-wide execution
            </h2>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
              Every module is aligned to the same goal: faster decisions,
              better interventions, and measurable learning improvement.
            </p>
          </div>

          <div>
            <div className="mx-auto mb-8 max-w-md lg:hidden">
              <div className="rounded-[1.8rem] border border-white/14 bg-white/[0.07] p-4 shadow-[0_24px_52px_-32px_rgba(6,182,212,0.18)] backdrop-blur-md">
                <div className="relative h-64 w-full sm:h-72">
                  <Image
                    src="/images/source-frontend/ttf-gemini-6cards.png"
                    alt="Intelligent education insights illustration"
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              <div className="hidden lg:col-span-5 lg:block">
                <div className="flex items-center justify-center rounded-[2rem] border border-white/14 bg-white/[0.07] p-4 shadow-[0_28px_58px_-32px_rgba(6,182,212,0.2)] backdrop-blur-md">
                  <div className="relative w-full max-w-xl">
                    <div className="pt-[56%]" />
                    <Image
                      src="/images/source-frontend/ttf-gemini-6cards.png"
                      alt="Intelligent education insights illustration"
                      fill
                      sizes="(max-width: 1280px) 45vw, 40vw"
                      className="object-contain"
                      priority
                    />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <div className="grid grid-cols-1 items-stretch gap-7 md:grid-cols-2 md:gap-10 lg:grid-cols-2">
                  {[
                    {
                      title: 'Deep Diagnostics',
                      description:
                        'Pinpoint precise learning gaps with AI-powered analysis, enabling targeted interventions for every student.',
                      icon: '🧬',
                    },
                    {
                      title: 'Predictive ERP',
                      description:
                        'Streamline campus management with adaptive systems that forecast needs and optimize operations.',
                      icon: '⚡',
                    },
                    {
                      title: 'Alumni Network',
                      description:
                        'Build lasting connections with graduates through automated engagement tools and community platforms.',
                      icon: '🌐',
                    },
                    {
                      title: 'OMR Digitization',
                      description:
                        'Digitize assessments effortlessly with high-accuracy scanning via mobile devices.',
                      icon: '📱',
                    },
                    {
                      title: 'Growth Analytics',
                      description:
                        'Track student progress with intuitive visualizations and predictive trend analysis.',
                      icon: '📈',
                    },
                    {
                      title: 'Parent Connect',
                      description:
                        'Facilitate seamless communication between schools and families with secure, organized channels.',
                      icon: '💬',
                    },
                  ].map((f) => (
                    <ProCard
                      key={f.title}
                      icon={f.icon}
                      title={f.title}
                      description={f.description}
                      accent="teal"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Impact statistics"
        className="relative overflow-hidden border-t border-slate-200/70 bg-[linear-gradient(180deg,#f5fbfb_0%,#ffffff_100%)] py-16 md:py-20"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(20,184,166,0.12),transparent_55%)]"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center md:mb-10">
            <span className="mb-4 inline-flex items-center rounded-full border border-teal-500/14 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 shadow-[0_14px_28px_-24px_rgba(13,148,136,0.16)] sm:text-sm">
              Impact Snapshot
            </span>
            <h2 className="text-3xl font-semibold tracking-[-0.05em] text-slate-950 md:text-4xl">
              Trusted impact in numbers
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              A clear snapshot of outcomes delivered for schools, teachers, and
              learners.
            </p>
          </div>
          <div
            className={`grid grid-cols-2 gap-8 text-center md:gap-10 ${homeStats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}
          >
            {homeStats.map((stat) => (
              <div key={stat.key} className="py-2">
                <div className="flex flex-col items-center gap-2 rounded-[1.7rem] border border-slate-200/80 bg-white/86 px-4 py-6 shadow-[0_22px_52px_-36px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-1.5 hover:bg-white">
                  {stat.icon ? (
                    <div className="text-2xl text-teal-600 md:text-3xl">
                      {stat.icon}
                    </div>
                  ) : null}
                  <div className="text-4xl font-semibold leading-none tracking-[-0.05em] text-slate-950 tabular-nums md:text-6xl">
                    {stat.value}
                  </div>
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500 md:text-xs">
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {testimonials.length > 0 ? (
        <section
          aria-labelledby="testimonials-heading"
          className="relative border-t border-slate-200/60 bg-[linear-gradient(180deg,#f9fcfc_0%,#eef7f7_100%)] py-16 md:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="mb-4 text-center">
                <span className="inline-flex items-center rounded-full border border-teal-500/16 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 shadow-[0_14px_28px_-24px_rgba(13,148,136,0.16)] sm:text-sm">
                  Real Outcomes
                </span>
              </div>
              <h2
                id="testimonials-heading"
                className="mb-4 text-center text-3xl font-semibold tracking-[-0.05em] text-slate-950 md:text-4xl"
              >
                Voices from Our Community
              </h2>
              <p className="mx-auto mb-12 max-w-2xl text-center text-slate-700">
                Insights from educators and parents transforming education with
                Alyra Tech.
              </p>
            </Reveal>
            <GlassPanel
              className="rounded-[2rem] shadow-[0_28px_60px_-38px_rgba(15,23,42,0.18)] transition-shadow duration-500"
              bgClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(247,250,250,0.82))]"
              blurClassName="backdrop-blur-xl backdrop-saturate-150"
              borderClassName="border-white/70 dark:border-white/15"
              edgeHighlight
            >
              <div className="px-4 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 lg:px-10">
                <Stagger className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                  {testimonials.map(
                    (
                      t: {
                        quote: string;
                        author: string;
                        role: string;
                        rating: number;
                        image: string | null;
                      },
                      i: number,
                    ) => (
                      <div
                        key={i}
                        className="rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-7 text-slate-900 shadow-[0_22px_48px_-36px_rgba(15,23,42,0.18)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_26px_54px_-34px_rgba(15,23,42,0.22)] md:p-8"
                      >
                        <div className="mb-4 flex gap-1 text-teal-500">
                          {[...Array(t.rating)].map((_, j) => (
                            <span key={j}>⭐</span>
                          ))}
                        </div>
                        <p className="leading-relaxed text-slate-900">
                          &quot;{t.quote}&quot;
                        </p>
                        <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-4">
                          {t.image ? (
                            <Image
                              src={t.image}
                              alt={t.author}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/16 font-bold text-teal-700 dark:text-teal-300">
                              {t.author.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {t.author}
                            </p>
                            <p className="text-xs text-slate-700/80">{t.role}</p>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </Stagger>
              </div>
            </GlassPanel>
          </div>
        </section>
      ) : null}

      {faqs.length > 0 ? (
        <section
          aria-labelledby="faq-heading"
          className="relative border-t border-gray-200/70 bg-[linear-gradient(180deg,#ffffff_0%,#f5f8f8_100%)] py-16 dark:border-gray-800/60 md:py-20"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="mb-4 text-center">
                <span className="inline-flex items-center rounded-full border border-slate-300/80 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.14)] sm:text-sm">
                  Need Clarity?
                </span>
              </div>
              <h2
                id="faq-heading"
                className="mb-14 text-center text-3xl font-semibold tracking-[-0.05em] text-slate-950 md:text-4xl"
              >
                Common Questions Answered
              </h2>
            </Reveal>
            <div>
              <Stagger className="space-y-5 md:space-y-7">
                {faqs.map(
                  (faq: { question: string; answer: string }, i: number) => (
                    <div
                      key={i}
                      className="rounded-[1.7rem] border border-slate-200/80 bg-white/92 p-6 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.16)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.18)] md:p-7"
                    >
                      <div className="mb-4 h-1 w-16 rounded-full bg-[linear-gradient(90deg,#0f766e,#14b8a6)]" />
                      <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                        {faq.question}
                      </h3>
                      <p className="mt-3 leading-relaxed text-slate-700">
                        {faq.answer}
                      </p>
                    </div>
                  ),
                )}
              </Stagger>
            </div>
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="cta-heading"
        className="relative overflow-hidden border-t border-slate-200/30 bg-[radial-gradient(circle_at_top,rgba(45,212,191,0.18),transparent_24%),linear-gradient(135deg,#07161b_0%,#0b2428_55%,#0d3a3f_100%)] py-20 text-white md:py-24"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.45)_1px,transparent_1px)] [background-size:30px_30px]"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-white/12 bg-white/[0.06] px-6 py-12 text-center shadow-[0_34px_80px_-38px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-8 md:px-12">
            <span className="mb-5 inline-flex items-center rounded-full border border-white/14 bg-white/8 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-100 sm:text-sm">
              Ready to move
            </span>
            <h2
              id="cta-heading"
              className="mb-7 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl md:text-5xl"
            >
              Elevate Your Institution Today
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/86 sm:text-lg md:mb-12 md:text-xl">
              Join schools using sharper diagnostic intelligence to turn
              assessment moments into measurable improvement.
              {typeof testPrice === 'number' ? (
                <>
                  <br />
                  Pricing begins at just{' '}
                  <span className="font-semibold text-white">
                    {testPrice} INR
                  </span>{' '}
                  per assessment.
                </>
              ) : null}
            </p>
            <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
              <Link
                href="/contact"
                className="rounded-full bg-white px-8 py-4 text-base font-semibold text-slate-950 transition-all hover:-translate-y-1 hover:shadow-[0_24px_42px_-24px_rgba(255,255,255,0.35)] md:px-10 md:py-5 md:text-lg"
              >
                Book Demo
              </Link>
              <Link
                href="/register"
                className="rounded-full border border-white/24 bg-white/[0.05] px-8 py-4 text-base font-semibold text-white transition-all hover:-translate-y-1 hover:bg-white hover:text-teal-700 hover:shadow-[0_24px_42px_-24px_rgba(255,255,255,0.25)] md:px-10 md:py-5 md:text-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
