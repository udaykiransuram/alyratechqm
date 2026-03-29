"use client";

import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  BoltIcon,
  ChartBarSquareIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentMagnifyingGlassIcon,
  DocumentTextIcon,
  HandRaisedIcon,
  LightBulbIcon,
  MapIcon,
  PresentationChartLineIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { motion } from "framer-motion";
import Link from "next/link";

import { InnerHero } from "@/components/InnerHero";
import { LottieAnimation } from "@/components/LottieAnimation";
import { Reveal, Stagger } from "@/components/Reveal";

const pillars = [
  {
    icon: DocumentArrowDownIcon,
    title: "Physical Reports, Not Software",
    desc: "We deliver detailed printed reports — no logins, no dashboards, no tech headaches. Just clear, tangible insights in your hands.",
  },
  {
    icon: HandRaisedIcon,
    title: "Zero Tech Required",
    desc: "Even if your school has never used an EdTech tool, you can work with us. We integrate seamlessly with any school — tech-savvy or not.",
  },
  {
    icon: AdjustmentsHorizontalIcon,
    title: "Adapted to Your School",
    desc: "Every assessment is tailored to your school's curriculum, structure & unique requirements — never one-size-fits-all.",
  },
  {
    icon: ClockIcon,
    title: "Designed to Save Time",
    desc: "Assessments that respect teacher hours — no manual grading, no guesswork, just clear reports delivered to you.",
  },
  {
    icon: ChartBarSquareIcon,
    title: "Multi-Level Analysis",
    desc: "School → Class → Section → Individual student — every report drills into performance at every level.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Unique Question Banks",
    desc: "No two schools receive the same question paper, eliminating comparison leaks and ensuring test integrity.",
  },
];

const stakeholders = [
  {
    emoji: "🏫",
    role: "School Administration",
    tagline: "Data-driven decisions, not gut feelings.",
    color: "from-emerald-500 to-teal-600",
    lightBg: "from-emerald-50 to-teal-50",
    lottie: "/animations/school-building.lottie",
    features: [
      {
        icon: ChartBarSquareIcon,
        title: "Multi-Level Analytics",
        desc: "Performance drill-down from school-wide trends to individual student results — class, section, and student level.",
      },
      {
        icon: PresentationChartLineIcon,
        title: "Administrative Metrics Reports",
        desc: "Printed KPIs & performance metrics that empower management to make data-backed decisions on hiring, training, and resource allocation.",
      },
      {
        icon: UserGroupIcon,
        title: "Measure Teacher Performance",
        desc: "Administration gets clear, data-driven reports on how each teacher's students perform — identify teaching gaps and reward excellence objectively.",
      },
      {
        icon: AdjustmentsHorizontalIcon,
        title: "Fully Customized Assessments",
        desc: "Every test adapts to your school's curriculum, board, and pace — your requirements drive the design.",
      },
      {
        icon: ShieldCheckIcon,
        title: "Unique Question Papers",
        desc: "No two schools get the same paper. Eliminates comparison leaks and guarantees assessment integrity.",
      },
      {
        icon: SparklesIcon,
        title: "A Powerful Marketing Edge",
        desc: "Position your school as one that analyses every child — not just the toppers. Show parents you invest in understanding and uplifting every student.",
      },
    ],
  },
  {
    emoji: "👩‍🏫",
    role: "Teachers",
    tagline: "Teach smarter. Pinpoint exactly where to focus.",
    color: "from-blue-500 to-indigo-600",
    lightBg: "from-blue-50 to-indigo-50",
    lottie: "/animations/teacher-classroom.lottie",
    features: [
      {
        icon: MapIcon,
        title: "Class Heat Maps",
        desc: "Visual heat maps reveal concept-wise strengths & weaknesses across the entire class at a glance.",
      },
      {
        icon: ChartBarSquareIcon,
        title: "Student-Wise Weak Area Report",
        desc: "Get a clear list of which students are weak and exactly where — topic by topic, concept by concept. No more guessing who needs help.",
      },
      {
        icon: PresentationChartLineIcon,
        title: "Teacher Performance Index",
        desc: "A clear metric tracking instructional effectiveness, helping teachers grow alongside their students.",
      },
      {
        icon: DocumentTextIcon,
        title: "Printed Worksheets with Content",
        desc: "Ready-to-use physical worksheets with targeted content for weak areas — handed directly to teachers, ready for the classroom.",
      },
      {
        icon: LightBulbIcon,
        title: "Real-World Teaching Guides",
        desc: "Get specific strategies & real-world examples for teaching weaker concepts, making abstract ideas concrete.",
      },
      {
        icon: ClockIcon,
        title: "Zero Time Wasted",
        desc: "Reports replace hours of manual correction. No software to learn, no data entry — just open the report and teach.",
      },
    ],
  },
  {
    emoji: "🎓",
    role: "Students",
    tagline: "Every child understood. Every gap addressed.",
    color: "from-amber-500 to-orange-600",
    lightBg: "from-amber-50 to-orange-50",
    lottie: "/animations/exams-preparation.lottie",
    features: [
      {
        icon: DocumentMagnifyingGlassIcon,
        title: "Misconception Detection",
        desc: "Goes beyond right/wrong — uncovers why a student made an error, whether procedural, conceptual, or a common misconception.",
      },
      {
        icon: PuzzlePieceIcon,
        title: "Sub-Skill Level Analysis",
        desc: "Drills into the finest learning gaps, identifying weaknesses at the sub-skill level for every individual child.",
      },
      {
        icon: ArrowPathIcon,
        title: "Spaced Recall Questions",
        desc: "Questions intelligently integrate past topics with current concepts, strengthening memory through structured repetition.",
      },
      {
        icon: SparklesIcon,
        title: "Personalized Learning Path",
        desc: "Each student receives insights tailored to their unique diagnostic profile — no generic advice.",
      },
      {
        icon: DocumentTextIcon,
        title: "Targeted Practice Worksheets",
        desc: "Every student gets printed worksheets focused specifically on the topics they underperformed in — so practice is always relevant, never random.",
      },
      {
        icon: ArrowPathIcon,
        title: "Chapter Prerequisites Identified",
        desc: "Before every new chapter, we identify the foundational topics each student needs to recall — so they walk in prepared, not confused.",
      },
    ],
  },
];

export interface BenefitsStat {
  value: string;
  label: string;
  icon: string;
}

export interface BenefitsTestimonial {
  quote: string;
  author: string;
  role: string;
  school: string;
  rating: number;
}

interface BenefitsContentProps {
  roiStats: BenefitsStat[];
  testimonials: BenefitsTestimonial[];
}

export default function BenefitsContent({
  roiStats,
  testimonials,
}: BenefitsContentProps) {
  return (
    <main className="min-h-screen bg-slate-50/50">
      <InnerHero
        title="Why Choose Alyra Tech?"
        subtitle="Physical reports with precision diagnostics — no software needed. Any school can get started."
        pillText="Benefits"
        lottieRight="/animations/online-learning.lottie"
        lottieLeft="/animations/financial-charts.lottie"
      />

      <section className="relative mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28">
        {roiStats.length > 0 && (
          <div className="mb-20">
            <Reveal>
              <div className="mb-10 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Proven Results
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  The Numbers Speak
                </h2>
              </div>
            </Reveal>
            <Stagger className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {roiStats.map((stat) => (
                <div
                  key={stat.label || stat.value}
                  className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors duration-300 hover:shadow-md md:p-8"
                >
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-lg text-emerald-700 ring-1 ring-emerald-100">
                    {stat.icon}
                  </div>
                  <div className="tabular-nums text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500/80">
                    {stat.label}
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
        )}

        <Reveal>
          <div
            className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5"
            style={{ display: "flex", width: "fit-content", margin: "0 auto 1.5rem" }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              What Sets Us Apart
            </span>
          </div>
          <h2 className="mb-5 text-center text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-5xl">
            Reports You Can Hold.
            <br className="hidden sm:block" /> Insights You Can Act On.
          </h2>
          <p className="mx-auto mb-16 max-w-2xl text-center text-lg leading-relaxed text-slate-500">
            We don&apos;t sell software. We deliver physical, detailed diagnostic
            reports to your school — no tech setup, no training, no friction.
          </p>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="relative flex flex-col items-start overflow-hidden rounded-2xl border border-slate-100 bg-white p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-md"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-200 to-teal-200" />
              <div className="relative z-10 mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <pillar.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="relative z-10 text-base font-semibold tracking-tight text-slate-900">
                {pillar.title}
              </h3>
              <p className="relative z-10 mt-2 text-sm leading-relaxed text-slate-600">
                {pillar.desc}
              </p>
            </div>
          ))}
        </Stagger>

        <div className="mt-28 md:mt-36">
          <Reveal>
            <div className="mb-20 text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                  For Every Stakeholder
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl lg:text-5xl">
                One Assessment. Three Tailored Reports.
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-500">
                From the principal&apos;s desk to the student&apos;s report card
                — everyone receives a physical, actionable document.
              </p>
            </div>
          </Reveal>

          <div className="space-y-24 md:space-y-36">
            {stakeholders.map((stakeholder, index) => {
              const isReversed = index % 2 !== 0;

              return (
                <div key={stakeholder.role}>
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-10"
                  >
                    <div className="mb-3 flex items-center gap-4">
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${stakeholder.color} text-3xl shadow-lg`}
                      >
                        {stakeholder.emoji}
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                          {stakeholder.role}
                        </h3>
                        <p className="mt-0.5 text-sm font-medium text-slate-400">
                          {stakeholder.tagline}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <div
                    className={`grid grid-cols-1 items-start gap-8 lg:grid-cols-12 ${isReversed ? "lg:direction-rtl" : ""}`}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: isReversed ? 40 : -40 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className={`sticky top-28 hidden lg:col-span-4 lg:block ${isReversed ? "lg:order-last" : ""}`}
                    >
                      <div
                        className={`rounded-3xl bg-gradient-to-br ${stakeholder.lightBg} p-6 shadow-md ring-1 ring-black/[0.03]`}
                      >
                        <LottieAnimation
                          src={stakeholder.lottie}
                          className="h-[280px] w-full"
                        />
                      </div>
                    </motion.div>
                    <Stagger
                      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8 ${isReversed ? "lg:order-first" : ""}`}
                    >
                      {stakeholder.features.map((feature) => (
                        <div
                          key={feature.title}
                          className="group relative overflow-hidden rounded-xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/50"
                        >
                          <div
                            className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stakeholder.color}`}
                          />
                          <div className="flex items-start gap-3.5">
                            <div
                              className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gradient-to-br ${stakeholder.color} text-white shadow-sm`}
                            >
                              <feature.icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold leading-tight text-slate-900">
                                {feature.title}
                              </h4>
                              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                                {feature.desc}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </Stagger>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flow-root mt-24 md:mt-36">
          <Reveal>
            <div className="pointer-events-none absolute left-1/2 top-[-50px] h-[300px] w-[80%] -translate-x-1/2 rounded-full bg-emerald-100/20 blur-[120px]" />
            <div className="relative z-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/30 md:rounded-3xl">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-6 md:px-8 md:py-8">
                <h3 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                  The Alyra Tech Advantage
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  How we compare to traditional school assessments.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-4 font-semibold md:px-8 md:py-6">
                        Feature
                      </th>
                      <th className="px-4 py-4 font-semibold md:px-8 md:py-6">
                        Traditional Reports
                      </th>
                      <th className="border-b-2 border-emerald-500 bg-emerald-50/50 px-4 py-4 font-semibold text-emerald-700 md:px-8 md:py-6">
                        Alyra Tech
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      [
                        "Analysis Depth",
                        'Subject Level ("Math: 60%")',
                        'Sub-skill Level ("Ratio – Part-to-Whole: Weak")',
                      ],
                      [
                        "Question Papers",
                        "Same paper across schools",
                        "Unique question bank per school",
                      ],
                      [
                        "Error Diagnosis",
                        "Not available",
                        "Misconception, procedural & conceptual classification",
                      ],
                      [
                        "Teacher Support",
                        "None",
                        "Heat maps, worksheets, real-world teaching guides",
                      ],
                      [
                        "Recall Integration",
                        "None",
                        "Past topics woven into current assessments",
                      ],
                      [
                        "Teacher Metrics",
                        "Subjective feedback",
                        "Teacher Performance Index with data",
                      ],
                      [
                        "Tech Dependency",
                        "Requires software & logins",
                        "Zero tech — physical reports delivered to you",
                      ],
                      [
                        "Admin Visibility",
                        "End-of-term summary",
                        "Detailed printed reports with drill-down metrics",
                      ],
                      [
                        "Parent Reports",
                        "PTM once a quarter",
                        "WhatsApp updates + printed report cards",
                      ],
                    ].map(([feature, traditional, alyra]) => (
                      <tr
                        key={feature}
                        className="transition-colors hover:bg-slate-50"
                      >
                        <td className="px-4 py-4 text-sm font-medium text-slate-900 md:px-8 md:py-5 md:text-base">
                          {feature}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-500 md:px-8 md:py-5">
                          {traditional}
                        </td>
                        <td className="bg-emerald-50/10 px-4 py-4 text-sm font-medium text-emerald-700 md:px-8 md:py-5 md:text-base">
                          {alyra}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="mt-24 md:mt-36">
          <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5">
                <BoltIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  The Big Picture
                </span>
              </div>
              <h3 className="mb-5 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                One assessment.
                <br />
                Physical reports for everyone.
              </h3>
              <p className="mb-8 text-base leading-relaxed text-slate-500">
                A single diagnostic generates a set of tailored physical reports
                — administration gets printed metrics, teachers get teaching plans
                with heat maps and worksheets, and every student gets a
                personalised sub-skill breakdown.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Printed school-level benchmarking & administrative KPIs",
                  "Class & section heat maps delivered to teachers",
                  "Individual misconception & sub-skill reports for every student",
                  "Teaching strategies with real-world examples — printed and ready",
                  "Works with any school — zero tech infrastructure needed",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-slate-600"
                  >
                    <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
                      <BoltIcon className="h-3 w-3 text-emerald-600" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.15,
              }}
              className="relative"
            >
              <div className="pointer-events-none absolute inset-0 scale-95 rounded-3xl bg-gradient-to-br from-emerald-100/40 to-teal-50/40 blur-2xl" />
              <div className="relative rounded-3xl bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-6 shadow-md ring-1 ring-black/[0.03]">
                <LottieAnimation
                  src="/animations/isometric-data-analysis.lottie"
                  className="mx-auto h-[300px] w-full max-w-md lg:h-[340px]"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {testimonials.length > 0 && (
          <div className="mt-24 md:mt-36">
            <Reveal>
              <div className="mb-12 text-center">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-4 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Testimonials
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                  What Educators & Parents Say
                </h2>
              </div>
            </Reveal>
            <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <div
                  key={`${testimonial.author}-${testimonial.quote.slice(0, 20)}`}
                  className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-lg md:p-8"
                >
                  <div className="mb-4 flex gap-1">
                    {[...Array(testimonial.rating)].map((_, index) => (
                      <span key={index} className="text-lg text-amber-500">
                        ⭐
                      </span>
                    ))}
                  </div>
                  <p className="leading-relaxed text-slate-600">
                    &quot;{testimonial.quote}&quot;
                  </p>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="font-bold text-slate-900">
                      {testimonial.author}
                    </p>
                    <p className="text-sm text-slate-500">
                      {testimonial.role}
                      {testimonial.school ? ` • ${testimonial.school}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
        )}

        <div className="relative mt-24 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 text-white md:mt-36 md:rounded-3xl sm:p-12 lg:p-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-[200px] w-[400px] translate-y-1/2 rounded-full bg-teal-500/10 blur-[100px]" />
          <div className="relative z-10 grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="hidden items-center justify-center lg:flex">
              <div className="rounded-2xl bg-white/[0.04] p-6 backdrop-blur-sm ring-1 ring-white/[0.06]">
                <LottieAnimation
                  src="/animations/data-analysis.lottie"
                  className="h-[240px] w-[280px]"
                />
              </div>
            </div>
            <Reveal>
              <h3 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
                See the difference for yourself
              </h3>
              <p className="mb-8 max-w-lg text-base leading-relaxed text-slate-400">
                Take the Talent Test and experience reports that put traditional
                report cards to shame.
              </p>
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/talent-test"
                  className="rounded-full bg-emerald-500 px-7 py-3.5 text-base font-bold text-slate-950 transition-all duration-300 hover:scale-105 hover:bg-emerald-400 hover:shadow-[0_0_40px_-8px_rgba(16,185,129,0.5)]"
                >
                  Take the Talent Test
                </Link>
                <Link
                  href="/contact"
                  className="rounded-full border-2 border-white/30 px-7 py-3.5 text-base font-medium text-white transition-all duration-300 hover:scale-105 hover:bg-white hover:text-slate-900"
                >
                  Contact Sales
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}
