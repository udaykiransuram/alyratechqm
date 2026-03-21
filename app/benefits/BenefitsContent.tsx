"use client";

import { InnerHero } from "@/components/InnerHero";
import { Reveal, Stagger } from "@/components/Reveal";
import { LottieAnimation } from "@/components/LottieAnimation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AdjustmentsHorizontalIcon,
  ClockIcon,
  ChartBarSquareIcon,
  ShieldCheckIcon,
  DocumentMagnifyingGlassIcon,
  ArrowPathIcon,
  PresentationChartLineIcon,
  DocumentTextIcon,
  LightBulbIcon,
  MapIcon,
  UserGroupIcon,
  PuzzlePieceIcon,
  SparklesIcon,
  BoltIcon,
  DocumentArrowDownIcon,
  HandRaisedIcon,
} from "@heroicons/react/24/outline";

/* ──────────────── Data ──────────────── */

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

/* ──────────────── Page ──────────────── */

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

export default function BenefitsContent({ roiStats, testimonials }: BenefitsContentProps) {
  return (
    <main className="bg-slate-50/50 min-h-screen">
      <InnerHero
        title="Why Choose Alyra Tech?"
        subtitle="Physical reports with precision diagnostics — no software needed. Any school can get started."
        pillText="Benefits"
        lottieRight="/animations/online-learning.lottie"
        lottieLeft="/animations/financial-charts.lottie"
      />

      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28 lg:px-8 relative">

        {/* ───── ROI Stats from Admin ───── */}
        {roiStats.length > 0 && (
          <div className="mb-20">
            <Reveal>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 mb-6">
                  <span className="text-emerald-700 font-semibold text-xs uppercase tracking-wider">Proven Results</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">The Numbers Speak</h2>
              </div>
            </Reveal>
            <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {roiStats.map((stat) => (
                <div
                  key={stat.label || stat.value}
                  className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] text-center transition-colors duration-300 hover:shadow-md"
                >
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 text-lg">
                    {stat.icon}
                  </div>
                  <div className="tabular-nums text-4xl md:text-5xl font-semibold tracking-tight text-slate-900">
                    {stat.value}
                  </div>
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-500/80 mt-2">
                    {stat.label}
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
        )}

        {/* ───── 1. Core Pillars ───── */}
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 mx-auto mb-6" style={{ display: 'flex', width: 'fit-content', margin: '0 auto 1.5rem' }}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-700 font-semibold text-xs uppercase tracking-wider">What Sets Us Apart</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-center mb-5 tracking-tight">Reports You Can Hold.<br className="hidden sm:block" /> Insights You Can Act On.</h2>
          <p className="text-slate-500 text-lg text-center max-w-2xl mx-auto mb-16 leading-relaxed">
            We don&apos;t sell software. We deliver physical, detailed diagnostic reports to your school — no tech setup, no training, no friction.
          </p>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="relative flex flex-col items-start bg-white p-7 rounded-2xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:shadow-md overflow-hidden"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-200 to-teal-200" />
              <div className="relative z-10 mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <p.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="relative z-10 text-base font-semibold text-slate-900 tracking-tight">{p.title}</h3>
              <p className="relative z-10 mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
            </div>
          ))}
        </Stagger>

        {/* ───── 2. Stakeholder Deep-Dives ───── */}
        <div className="mt-28 md:mt-36">
          <Reveal>
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-4 py-1.5 mb-6">
                <span className="text-blue-700 font-semibold text-xs uppercase tracking-wider">For Every Stakeholder</span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
                One Assessment. Three Tailored Reports.
              </h2>
              <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                From the principal&apos;s desk to the student&apos;s report card — everyone receives a physical, actionable document.
              </p>
            </div>
          </Reveal>

          <div className="space-y-24 md:space-y-36">
            {stakeholders.map((s, idx) => {
              const isReversed = idx % 2 !== 0;
              return (
                <div key={s.role}>
                  {/* Stakeholder Header */}
                  <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-10"
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center text-3xl shadow-lg`}>
                        {s.emoji}
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">{s.role}</h3>
                        <p className="text-slate-400 text-sm mt-0.5 font-medium">{s.tagline}</p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Features Grid + Lottie */}
                  <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-start ${isReversed ? "lg:direction-rtl" : ""}`}>
                    {/* Lottie side */}
                    <motion.div
                      initial={{ opacity: 0, x: isReversed ? 40 : -40 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className={`lg:col-span-4 hidden lg:block sticky top-28 ${isReversed ? "lg:order-last" : ""}`}
                    >
                      <div className={`bg-gradient-to-br ${s.lightBg} rounded-3xl p-6 shadow-md ring-1 ring-black/[0.03]`}>
                        <LottieAnimation src={s.lottie} className="w-full h-[280px]" />
                      </div>
                    </motion.div>
                    <Stagger className={`lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4 ${isReversed ? "lg:order-first" : ""}`}>
                      {s.features.map((f) => (
                        <div
                          key={f.title}
                          className="group relative overflow-hidden bg-white p-5 rounded-xl border border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-lg hover:shadow-slate-200/50 hover:-translate-y-0.5 transition-all duration-300"
                        >
                          {/* Decorative top accent matching stakeholder color */}
                          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.color}`} />
                          <div className="flex items-start gap-3.5">
                            <div className={`flex-none h-9 w-9 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-sm`}>
                              <f.icon className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-slate-900 text-sm leading-tight">{f.title}</h4>
                              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{f.desc}</p>
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

        {/* ───── 3. Comparison Table ───── */}
        <div className="mt-24 md:mt-36 flow-root">
          <Reveal>
            <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 w-[80%] h-[300px] bg-emerald-100/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="relative z-10 overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200/80 bg-white shadow-xl shadow-slate-200/30">
              <div className="px-6 py-6 md:px-8 md:py-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h3 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">The Alyra Tech Advantage</h3>
                <p className="text-slate-400 mt-1 text-sm">How we compare to traditional school assessments.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 tracking-wider">
                    <tr>
                      <th className="px-4 py-4 md:px-8 md:py-6 font-semibold">Feature</th>
                      <th className="px-4 py-4 md:px-8 md:py-6 font-semibold">Traditional Reports</th>
                      <th className="px-4 py-4 md:px-8 md:py-6 font-semibold text-emerald-700 bg-emerald-50/50 border-b-2 border-emerald-500">Alyra Tech</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ["Analysis Depth", "Subject Level (\"Math: 60%\")", "Sub-skill Level (\"Ratio – Part-to-Whole: Weak\")"],
                      ["Question Papers", "Same paper across schools", "Unique question bank per school"],
                      ["Error Diagnosis", "Not available", "Misconception, procedural & conceptual classification"],
                      ["Teacher Support", "None", "Heat maps, worksheets, real-world teaching guides"],
                      ["Recall Integration", "None", "Past topics woven into current assessments"],
                      ["Teacher Metrics", "Subjective feedback", "Teacher Performance Index with data"],
                      ["Tech Dependency", "Requires software & logins", "Zero tech — physical reports delivered to you"],
                      ["Admin Visibility", "End-of-term summary", "Detailed printed reports with drill-down metrics"],
                      ["Parent Reports", "PTM once a quarter", "WhatsApp updates + printed report cards"],
                    ].map(([feature, traditional, beyondMarks]) => (
                      <tr key={feature} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 md:px-8 md:py-5 font-medium text-slate-900 text-sm md:text-base">{feature}</td>
                        <td className="px-4 py-4 md:px-8 md:py-5 text-slate-500 text-sm">{traditional}</td>
                        <td className="px-4 py-4 md:px-8 md:py-5 font-medium text-emerald-700 bg-emerald-50/10 text-sm md:text-base">{beyondMarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ───── 4. How It All Connects ───── */}
        <div className="mt-24 md:mt-36">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 mb-6">
                <BoltIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold text-xs uppercase tracking-wider">The Big Picture</span>
              </div>
              <h3 className="text-3xl md:text-4xl font-bold text-slate-900 mb-5 tracking-tight">One assessment.<br />Physical reports for everyone.</h3>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                A single diagnostic generates a set of tailored physical reports — administration gets printed metrics, teachers get teaching plans with heat maps and worksheets, and every student gets a personalised sub-skill breakdown.
              </p>
              <ul className="space-y-3.5">
                {[
                  "Printed school-level benchmarking & administrative KPIs",
                  "Class & section heat maps delivered to teachers",
                  "Individual misconception & sub-skill reports for every student",
                  "Teaching strategies with real-world examples — printed and ready",
                  "Works with any school — zero tech infrastructure needed",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-600 text-sm">
                    <span className="mt-1 flex-none h-5 w-5 rounded-full bg-emerald-50 flex items-center justify-center ring-1 ring-emerald-100">
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
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/40 to-teal-50/40 rounded-3xl blur-2xl scale-95 pointer-events-none" />
              <div className="relative bg-gradient-to-br from-emerald-50/80 to-teal-50/60 rounded-3xl p-6 ring-1 ring-black/[0.03] shadow-md">
                <LottieAnimation src="/animations/isometric-data-analysis.lottie" className="w-full max-w-md mx-auto h-[300px] lg:h-[340px]" />
              </div>
            </motion.div>
          </div>
        </div>

        {/* ───── Testimonials from Admin ───── */}
        {testimonials.length > 0 && (
          <div className="mt-24 md:mt-36">
            <Reveal>
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-100 px-4 py-1.5 mb-6">
                  <span className="text-amber-700 font-semibold text-xs uppercase tracking-wider">Testimonials</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">What Educators & Parents Say</h2>
              </div>
            </Reveal>
            <Stagger className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <div key={`${t.author}-${t.quote.slice(0,20)}`} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow duration-300">
                  <div className="mb-4 flex gap-1">
                    {[...Array(t.rating)].map((_, j) => (
                      <span key={j} className="text-lg text-amber-500">⭐</span>
                    ))}
                  </div>
                  <p className="italic text-slate-600 leading-relaxed">&quot;{t.quote}&quot;</p>
                  <div className="mt-5 pt-4 border-t border-slate-100">
                    <p className="font-bold text-slate-900">{t.author}</p>
                    <p className="text-sm text-slate-500">{t.role}{t.school ? ` • ${t.school}` : ''}</p>
                  </div>
                </div>
              ))}
            </Stagger>
          </div>
        )}

        {/* ───── 5. Bottom CTA ───── */}
        <div className="mt-24 md:mt-36 rounded-2xl md:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 sm:p-12 lg:p-16 text-white relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/15 rounded-full blur-[120px] pointer-events-none -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[200px] bg-teal-500/10 rounded-full blur-[100px] pointer-events-none translate-y-1/2" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="hidden lg:flex items-center justify-center">
              <div className="bg-white/[0.04] rounded-2xl p-6 ring-1 ring-white/[0.06] backdrop-blur-sm">
                <LottieAnimation src="/animations/data-analysis.lottie" className="w-[280px] h-[240px]" />
              </div>
            </div>
            <Reveal>
              <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">See the difference for yourself</h3>
              <p className="text-base text-slate-400 max-w-lg mb-8 leading-relaxed">
                Take the Talent Test and experience reports that put traditional report cards to shame.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
                <Link href="/talent-test" className="rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-7 py-3.5 text-base font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_-8px_rgba(16,185,129,0.5)]">
                  Take the Talent Test
                </Link>
                <Link href="/contact" className="rounded-full border-2 border-white/30 hover:bg-white hover:text-slate-900 text-white px-7 py-3.5 text-base font-medium transition-all duration-300 hover:scale-105">
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
