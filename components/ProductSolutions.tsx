"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  AcademicCapIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

import { LottieAnimation } from "@/components/LottieAnimation";

const colorMap: Record<
  string,
  {
    sidebar: string;
    iconBg: string;
    iconText: string;
    iconRing: string;
    pillBg: string;
    pillText: string;
    dot: string;
    glow: string;
    gradientFrom: string;
    gradientTo: string;
    buttonBg: string;
    buttonHover: string;
  }
> = {
  emerald: {
    sidebar: "bg-gradient-to-b from-emerald-400 to-emerald-600",
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    iconRing: "ring-emerald-100",
    pillBg: "bg-emerald-50",
    pillText: "text-emerald-700",
    dot: "bg-emerald-500",
    glow: "from-emerald-200/40 to-teal-100/30",
    gradientFrom: "from-emerald-50",
    gradientTo: "to-teal-50/50",
    buttonBg: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-500",
  },
  blue: {
    sidebar: "bg-gradient-to-b from-blue-400 to-blue-600",
    iconBg: "bg-blue-50",
    iconText: "text-blue-600",
    iconRing: "ring-blue-100",
    pillBg: "bg-blue-50",
    pillText: "text-blue-700",
    dot: "bg-blue-500",
    glow: "from-blue-200/40 to-indigo-100/30",
    gradientFrom: "from-blue-50",
    gradientTo: "to-indigo-50/50",
    buttonBg: "bg-blue-600",
    buttonHover: "hover:bg-blue-500",
  },
  indigo: {
    sidebar: "bg-gradient-to-b from-indigo-400 to-indigo-600",
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
    iconRing: "ring-indigo-100",
    pillBg: "bg-indigo-50",
    pillText: "text-indigo-700",
    dot: "bg-indigo-500",
    glow: "from-indigo-200/40 to-violet-100/30",
    gradientFrom: "from-indigo-50",
    gradientTo: "to-violet-50/50",
    buttonBg: "bg-indigo-600",
    buttonHover: "hover:bg-indigo-500",
  },
  teal: {
    sidebar: "bg-gradient-to-b from-teal-400 to-teal-600",
    iconBg: "bg-teal-50",
    iconText: "text-teal-600",
    iconRing: "ring-teal-100",
    pillBg: "bg-teal-50",
    pillText: "text-teal-700",
    dot: "bg-teal-500",
    glow: "from-teal-200/40 to-cyan-100/30",
    gradientFrom: "from-teal-50",
    gradientTo: "to-cyan-50/50",
    buttonBg: "bg-teal-600",
    buttonHover: "hover:bg-teal-500",
  },
};

interface SolutionData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  color: string;
  animation: string;
  features: string[];
}

function SolutionCard({
  sol,
  index,
}: {
  sol: SolutionData;
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const c = colorMap[sol.color] || colorMap.emerald;
  const isEven = index % 2 === 0;
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"],
  });
  const animY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const animScale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    [0.9, 1.05, 1.05, 0.95],
  );

  return (
    <motion.div
      ref={cardRef}
      id={sol.id}
      className="scroll-mt-32"
      initial={{ opacity: 0, x: isEven ? -80 : 80, y: 30 }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`public-panel group relative flex flex-col overflow-hidden transition-shadow duration-500 hover:shadow-2xl lg:rounded-[2.5rem] ${
          isEven ? "lg:flex-row" : "lg:flex-row-reverse"
        }`}
      >
        <div
          className={`absolute -z-10 h-[400px] w-[500px] rounded-full bg-gradient-to-br ${c.glow} opacity-0 blur-[100px] transition-opacity duration-700 group-hover:opacity-100 ${
            isEven ? "-right-20 -top-20" : "-left-20 -top-20"
          }`}
        />

        <motion.div
          style={{
            y: prefersReduced ? 0 : animY,
            scale: prefersReduced ? 1 : animScale,
          }}
          className={`relative flex flex-none items-center justify-center overflow-hidden bg-gradient-to-br p-6 sm:p-8 lg:w-[42%] lg:p-12 ${c.gradientFrom} ${c.gradientTo}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.8),transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEuNSIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==')] opacity-[0.03]" />

          <motion.div
            animate={prefersReduced ? undefined : { y: [0, -8, 0] }}
            transition={
              prefersReduced
                ? undefined
                : { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }
            className="relative z-10 w-full"
          >
            <LottieAnimation
              src={sol.animation}
              className="h-[260px] w-full sm:h-[320px] lg:h-[380px]"
            />
          </motion.div>

          <div className="pointer-events-none absolute bottom-4 right-6 select-none text-[8rem] font-black leading-none opacity-[0.04] lg:text-[10rem]">
            0{index + 1}
          </div>
        </motion.div>

        <div className="relative z-10 flex-1 p-6 sm:p-8 lg:p-12">
          <div
            className={`absolute left-0 top-0 h-1 w-full lg:h-full lg:w-1.5 ${c.sidebar}`}
          />

          <div className="lg:pl-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="mb-5 flex items-center gap-4">
                <div
                  className={`flex h-14 w-14 flex-none items-center justify-center rounded-2xl ${c.iconBg} ${c.iconText} ring-1 ${c.iconRing} shadow-sm`}
                >
                  <sol.icon className="h-7 w-7" />
                </div>
                <div>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${c.pillBg} ${c.pillText}`}
                  >
                    {sol.subtitle}
                  </span>
                </div>
              </div>

              <h3 className="mb-3 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                {sol.title}
              </h3>
              <p className="mb-8 max-w-2xl text-base leading-relaxed text-slate-600 lg:text-lg">
                {sol.description}
              </p>
            </motion.div>

            <div className="mb-8 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {sol.features.map((feature, featureIndex) => (
                <motion.div
                  key={feature}
                  className="flex items-start gap-3 py-1"
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.35,
                    delay: 0.3 + featureIndex * 0.05,
                  }}
                >
                  <div className={`mt-2 h-1.5 w-1.5 flex-none rounded-full ${c.dot}`} />
                  <span className="text-sm font-medium leading-snug text-slate-700 lg:text-base">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <Link
                href="/contact"
                className={`group/btn inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg ${c.buttonBg} ${c.buttonHover}`}
              >
                Get Started
                <svg
                  className="h-4 w-4 transition-transform group-hover/btn:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const solutions: SolutionData[] = [
  {
    id: "diagnostics",
    title: "Precision Diagnostic Testing",
    subtitle: "Our flagship engine.",
    description:
      "Transform teaching with deep diagnostic insights that go beyond marks to reveal true understanding. Our system breaks down performance to the sub-skill level.",
    icon: ChartBarIcon,
    color: "emerald",
    animation: "/animations/seo-isometric-team.lottie",
    features: [
      "Topic → Skill → Subskill breakdown",
      "Identify conceptual, procedural & prerequisite gaps",
      "Baseline testing in Math, Science & more",
      "AI-powered personalized learning paths",
      "Track growth, not just grades",
      "Error-type classification (procedural vs conceptual)",
      "National & state-level benchmarking",
      "Detailed heatmaps for every student",
    ],
  },
  {
    id: "erp",
    title: "School ERP System",
    subtitle: "Streamline operations.",
    description:
      "Comprehensive management system to run your school efficiently — from admissions to alumni. Replace 10 tools with one unified platform.",
    icon: BuildingLibraryIcon,
    color: "blue",
    animation: "/animations/appointment-booking.lottie",
    features: [
      "Student & Staff Management",
      "Attendance & Timetable Scheduling",
      "Fee Management & Accounting",
      "Parent Communication Portal",
      "Library & Inventory Management",
      "Exam & Result Processing",
      "Transport & Hostel Management",
      "Multi-branch Support",
    ],
  },
  {
    id: "alumni",
    title: "Alumni Management",
    subtitle: "Build your legacy.",
    description:
      "Build lasting relationships with your alumni network. Engage, fundraise, and showcase success stories to strengthen your institution's brand.",
    icon: AcademicCapIcon,
    color: "indigo",
    animation: "/animations/success-graduation.lottie",
    features: [
      "Alumni Database & Profiles",
      "Events & Reunions Management",
      "Fundraising & Donation Campaigns",
      "Job Portal & Professional Networking",
      "Success Stories Showcase",
      "Batch-wise Communication",
      "Mentorship Program Matching",
      "Annual Giving Analytics",
    ],
  },
  {
    id: "omr",
    title: "OMR Scanning & Analysis",
    subtitle: "Instant results.",
    description:
      "Fast, accurate answer sheet scanning with instant analytics. No expensive hardware needed — works with any smartphone camera.",
    icon: DocumentTextIcon,
    color: "teal",
    animation: "/animations/data-scanning.lottie",
    features: [
      "Mobile & Scanner Compatible",
      "Instant Result Processing",
      "Detailed Analytics Dashboard",
      "Custom OMR Sheet Design Tool",
      "Cloud-Based & Secure Storage",
      "99.9% Scanning Accuracy",
      "Batch Processing (1000+ sheets)",
      "Export to Excel / PDF Reports",
    ],
  },
];

export function ProductSolutions() {
  return (
    <section className="cards-section relative mx-auto max-w-7xl overflow-hidden px-4 pb-12 pt-16 sm:px-6 md:pt-24 lg:px-8">
      <motion.div
        className="mb-20 flex flex-col items-center gap-10 lg:flex-row"
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex-1 text-center lg:text-left">
          <motion.span
            className="mb-4 inline-block rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-500"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            Our Products
          </motion.span>
          <h2 className="mb-4 text-2xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-3xl md:text-4xl lg:text-5xl">
            Powerful Tools for{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Modern Schools
            </span>
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
            From precision diagnostics to full-stack school management,
            everything your institution needs to thrive, delivered through our
            reports and process.
          </p>
        </div>
        <motion.div
          className="hidden w-full max-w-xs flex-none md:block sm:max-w-sm lg:max-w-md"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <LottieAnimation
            src="/animations/business-analyst.lottie"
            className="h-[320px] w-full"
          />
        </motion.div>
      </motion.div>

      <div className="relative z-10 flex flex-col gap-10 md:gap-20 lg:gap-24">
        {solutions.map((sol, index) => (
          <SolutionCard key={sol.id} sol={sol} index={index} />
        ))}
      </div>
    </section>
  );
}
