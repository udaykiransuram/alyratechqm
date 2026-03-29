import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BookOpenText,
  Building2,
  GraduationCap,
  Radar,
  ScanLine,
  ShieldCheck,
  Target,
  Users,
  Workflow,
} from "lucide-react";

export type HomeStat = {
  key: string;
  label: string;
  value: string;
  icon?: string;
};

export type HomeTestimonial = {
  quote: string;
  author: string;
  role: string;
  rating: number;
  image: string | null;
};

export type HomeFaq = {
  question: string;
  answer: string;
};

export type HomeRenderMode = "full3d" | "lite" | "poster";

export type HomeSceneKey = "hero" | "patterns" | "drilldown" | "platform";

export type HomeStoryBeat = {
  label: string;
  title: string;
  body: string;
};

export type HomeStoryMetric = {
  label: string;
  value: string;
};

export type HomeChapter = {
  id: HomeSceneKey;
  anchor: string;
  chapterLabel: string;
  navLabel: string;
  eyebrow: string;
  title: string;
  body: string;
  sceneLabel: string;
  sceneSummary: string;
  sceneMarkers: string[];
  highlights: string[];
  beats: HomeStoryBeat[];
  metric: HomeStoryMetric;
  support: HomeStoryMetric;
};

export type HomePlatformItem = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export type HomeProofPoint = {
  icon: LucideIcon;
  title: string;
  body: string;
};

export type HomeFounderNote = {
  eyebrow: string;
  quote: string;
  author: string;
  role: string;
};

export type HomeSceneState = {
  camera: [number, number, number];
  target: [number, number, number];
  coreScale: number;
  ringScale: number;
  ringTilt: number;
  orbitRadius: number;
  slabSpread: number;
  slabLift: number;
  slabOpacity: number;
  columnBias: number;
  columnHeights: [number, number, number, number];
  moduleArc: number;
  moduleLift: number;
  clusterScale: number;
  latticeScale: number;
  glow: number;
  warmMix: number;
};

export const HOME_NAV_LINKS = [
  { href: "#story", label: "Story" },
  { href: "#platform", label: "Solutions" },
  { href: "#proof", label: "Proof" },
  { href: "/case-study", label: "Case Studies" },
] as const;

export const HOME_TRUST_STRIP = [
  "Turn paper tests into a leadership-ready diagnostic signal.",
  "Keep school, class, and student views connected in one review flow.",
  "Carry diagnostics, reporting, OMR, and follow-through inside one system.",
] as const;

export const HOME_STORY_CHAPTERS: HomeChapter[] = [
  {
    id: "hero",
    anchor: "story",
    chapterLabel: "Chapter 01",
    navLabel: "Paper to Power",
    eyebrow: "Paper to power diagnostic engine",
    title: "Turn every paper test into a live academic signal.",
    body:
      "Alyra scans ordinary OMR sheets and transforms them into a premium diagnostic story for school leaders, revealing hidden pressure, misconception patterns, and fragile understanding before they vanish inside score summaries.",
    sceneLabel: "Paper -> Power scan",
    sceneSummary:
      "A floating answer sheet is scanned, the marked bubbles lift off, and the paper transforms into an academic intelligence signal leadership teams can act on immediately.",
    sceneMarkers: [
      "OMR scan",
      "Signal lift",
      "Leadership view",
    ],
    highlights: [
      "Leadership sees the shift from paper capture to diagnostic clarity in one motion.",
      "Teachers get a signal they can act on, not just a score they have to interpret later.",
      "The platform carries that same truth from diagnosis into reporting and intervention.",
    ],
    beats: [
      {
        label: "Scan",
        title: "Standard testing becomes premium signal capture.",
        body:
          "The opening moment reframes OMR and answer sheets as the starting point for a clearer academic operating system, not the end of assessment.",
      },
      {
        label: "Leadership effect",
        title: "Marks are only the surface. The real value is what rises out of them.",
        body:
          "Alyra helps schools act on the patterns behind the marks, so review meetings begin with insight instead of guesswork.",
      },
    ],
    metric: {
      label: "Transformation",
      value: "Paper -> Signal -> Action",
    },
    support: {
      label: "Leadership promise",
      value: "See pressure before performance slips",
    },
  },
  {
    id: "patterns",
    anchor: "patterns",
    chapterLabel: "Chapter 02",
    navLabel: "What Grades Miss",
    eyebrow: "Beyond score-only reporting",
    title: "The same score can hide entirely different learning risk.",
    body:
      "Alyra reveals hesitation, confidence drift, and misconception clusters that grade summaries hide, so schools can stop treating every low-scoring learner as the same problem.",
    sceneLabel: "Valley zoom",
    sceneSummary:
      "A weak region of the terrain opens into hesitation, confidence drift, and misconception clusters so similar marks stop looking like the same problem.",
    sceneMarkers: [
      "Valley focus",
      "Confidence drift",
      "Cluster trace",
    ],
    highlights: [
      "Separate fragile guessing from secure reasoning.",
      "Make hesitation visible before it turns into concept loss.",
      "Turn a broad score dip into a reteachable concept cluster.",
    ],
    beats: [
      {
        label: "Beat 01",
        title: "Marks dissolve into hesitation traces.",
        body:
          "The first scroll beat reframes the score as a delayed-response pattern, not a stable understanding signal.",
      },
      {
        label: "Beat 02",
        title: "Confidence drift becomes visible.",
        body:
          "Students with similar marks split apart once pace, consistency, and confidence are mapped over time.",
      },
      {
        label: "Beat 03",
        title: "Misconception clusters emerge.",
        body:
          "The problem becomes a concept map the school can act on, not a generic low-performance bucket.",
      },
    ],
    metric: {
      label: "Blind spot removed",
      value: "Score-only reporting",
    },
    support: {
      label: "Diagnostic mode",
      value: "Confidence + pace + misconception cluster",
    },
  },
  {
    id: "drilldown",
    anchor: "drilldown",
    chapterLabel: "Chapter 03",
    navLabel: "Drill-Down",
    eyebrow: "School -> Class -> Student",
    title: "Move from school signal to the exact class and learner who need the next move.",
    body:
      "Alyra begins with the school-wide map, narrows to the class cluster under pressure, and lands on the student and concept that need action next.",
    sceneLabel: "Prerequisite constellation",
    sceneSummary:
      "A flagged concept lights up and the prerequisite path behind it glows warm, helping teachers trace where the comprehension breakdown likely began.",
    sceneMarkers: [
      "Target concept",
      "Prerequisite path",
      "Teacher next move",
    ],
    highlights: [
      "Leadership starts with the whole-school picture.",
      "Teachers narrow the problem to a real cluster, not vague concern.",
      "Student-level detail closes with a clear reteach or follow-up move.",
    ],
    beats: [
      {
        label: "School",
        title: "Find the grade or stream carrying hidden pressure.",
        body:
          "The first drill-down step shows where pressure is building before it becomes a larger leadership problem.",
      },
      {
        label: "Class",
        title: "Pinpoint the class cluster behind the signal.",
        body:
          "The second step turns a school trend into a teacher-owned reteach cluster that can actually be addressed.",
      },
      {
        label: "Student",
        title: "Close with the learner who needs the next move most.",
        body:
          "The final step surfaces diagnosis, confidence context, and the concept-level action path together.",
      },
    ],
    metric: {
      label: "Decision style",
      value: "Wide first, precise next",
    },
    support: {
      label: "Intervention path",
      value: "School -> Class -> Student",
    },
  },
  {
    id: "platform",
    anchor: "platform",
    chapterLabel: "Chapter 04",
    navLabel: "Operating System",
    eyebrow: "One platform, one operating layer",
    title: "Diagnostics prove the value. The platform carries that truth across the whole school.",
    body:
      "Alyra connects diagnostics, reports, OMR, ERP, and school engagement into one system so the same academic signal can move cleanly through operations, reporting, and follow-through.",
    sceneLabel: "Connected operating layer",
    sceneSummary:
      "Once the academic signal is trusted, diagnostics, reports, OMR, and school workflows can arrange around the same source of truth.",
    sceneMarkers: [
      "Diagnostics core",
      "Connected modules",
      "Action layer",
    ],
    highlights: [
      "One shared view across diagnosis, review, capture, and follow-through.",
      "Fewer disconnected tools and fewer context resets for teams.",
      "A coherent system that stays trustworthy during real school use, not just demos.",
    ],
    beats: [
      {
        label: "Connected layer",
        title: "Diagnostics anchor the academic truth.",
        body:
          "The platform starts from diagnosis, then carries that truth across review, reporting, and intervention workflows.",
      },
      {
        label: "Operational flow",
        title: "Reports, OMR, ERP, and engagement stay connected.",
        body:
          "School teams move between modules without rebuilding context or trust from scratch.",
      },
    ],
    metric: {
      label: "Platform promise",
      value: "One connected operating system",
    },
    support: {
      label: "Workflow effect",
      value: "Fewer tools. Clearer action.",
    },
  },
];

export const HOME_SCENE_STATES: Record<HomeSceneKey, HomeSceneState> = {
  hero: {
    camera: [0.15, 0.3, 7.6],
    target: [0, 0.1, 0],
    coreScale: 1.28,
    ringScale: 1.22,
    ringTilt: 0.24,
    orbitRadius: 2.75,
    slabSpread: 3.9,
    slabLift: 0.55,
    slabOpacity: 0.2,
    columnBias: 0.15,
    columnHeights: [1.5, 2.2, 2.8, 1.9],
    moduleArc: 3.6,
    moduleLift: 1.6,
    clusterScale: 0.82,
    latticeScale: 1,
    glow: 1.02,
    warmMix: 0.2,
  },
  patterns: {
    camera: [1.1, 0.82, 6.35],
    target: [0.45, 0.22, 0],
    coreScale: 0.92,
    ringScale: 1.46,
    ringTilt: 0.64,
    orbitRadius: 2.25,
    slabSpread: 2.45,
    slabLift: 0.95,
    slabOpacity: 0.28,
    columnBias: 0.4,
    columnHeights: [2.8, 1.8, 3.15, 2.25],
    moduleArc: 2.4,
    moduleLift: 1.2,
    clusterScale: 1.28,
    latticeScale: 0.86,
    glow: 1.12,
    warmMix: 0.16,
  },
  drilldown: {
    camera: [-1.05, 0.42, 5.95],
    target: [0.85, -0.18, 0],
    coreScale: 0.84,
    ringScale: 0.98,
    ringTilt: -0.18,
    orbitRadius: 1.65,
    slabSpread: 1.8,
    slabLift: 1.8,
    slabOpacity: 0.18,
    columnBias: -0.38,
    columnHeights: [2.9, 2.2, 1.45, 0.9],
    moduleArc: 1.7,
    moduleLift: 0.25,
    clusterScale: 0.96,
    latticeScale: 0.72,
    glow: 0.86,
    warmMix: 0.28,
  },
  platform: {
    camera: [0, 0.95, 8.15],
    target: [0, 0.2, 0],
    coreScale: 1.04,
    ringScale: 1.3,
    ringTilt: 0.14,
    orbitRadius: 2.8,
    slabSpread: 4.1,
    slabLift: 0.8,
    slabOpacity: 0.24,
    columnBias: 0.08,
    columnHeights: [1.9, 2.8, 3, 2.05],
    moduleArc: 4.3,
    moduleLift: 1.48,
    clusterScale: 0.88,
    latticeScale: 1.08,
    glow: 1.04,
    warmMix: 0.42,
  },
};

export const HOME_PLATFORM_ITEMS: HomePlatformItem[] = [
  {
    icon: Radar,
    title: "Precision Diagnostics",
    body:
      "Reveal hesitation, misconception clusters, and fragile understanding before review conversations turn reactive.",
  },
  {
    icon: BarChart3,
    title: "Leadership Reporting",
    body:
      "Give school leaders one clear view from whole-school signal to concept-level pressure points.",
  },
  {
    icon: ScanLine,
    title: "OMR Intelligence",
    body:
      "Capture and digitize assessment evidence quickly without losing diagnostic fidelity.",
  },
  {
    icon: Workflow,
    title: "School Workflow Layer",
    body:
      "Move diagnosis into intervention, reporting, and daily follow-through from one connected system.",
  },
  {
    icon: Building2,
    title: "ERP And Operations",
    body:
      "Keep academic and operational context aligned instead of splitting them across disconnected tools.",
  },
  {
    icon: GraduationCap,
    title: "Engagement Extensions",
    body:
      "Extend the platform beyond one exam cycle into broader school quality and relationship workflows.",
  },
];

export const HOME_PROOF_POINTS: HomeProofPoint[] = [
  {
    icon: ShieldCheck,
    title: "Built for leadership reviews",
    body:
      "The platform is designed for calm, evidence-led academic conversations rather than noisy dashboard theater.",
  },
  {
    icon: Target,
    title: "Diagnosis to intervention",
    body:
      "Alyra keeps the academic signal intact from the first diagnosis through reteach, reporting, and next action.",
  },
  {
    icon: Users,
    title: "One shared view for teams",
    body:
      "Principals, academic heads, teachers, and coordinators work from the same truth instead of competing versions of performance.",
  },
];

export const HOME_FOUNDER_NOTE: HomeFounderNote = {
  eyebrow: "Founder note",
  quote:
    "Schools do not need another decorative dashboard. They need a system that reveals academic truth early, makes decisions calmer, and helps teams act with confidence.",
  author: "Alyra Tech",
  role: "School Intelligence Platform",
};

export const HOME_DEFAULT_TESTIMONIALS: HomeTestimonial[] = [
  {
    quote:
      "Alyra changed how our leadership team reads assessment reviews. We can see the pressure signal much earlier now.",
    author: "Academic Director",
    role: "Senior Secondary School",
    rating: 5,
    image: null,
  },
  {
    quote:
      "The school-to-class-to-student view gives teachers a much clearer action path than score summaries ever did.",
    author: "Principal",
    role: "Integrated School Group",
    rating: 5,
    image: null,
  },
];

export const HOME_DEFAULT_FAQS: HomeFaq[] = [
  {
    question: "Who is Alyra built for first?",
    answer:
      "Alyra is designed first for school leadership and academic quality teams who need a clearer view of hidden learning risk across the school.",
  },
  {
    question: "Is diagnostics the whole product?",
    answer:
      "Diagnostics is the sharpest proof point, but Alyra connects that academic signal to reporting, OMR, workflow, and wider school operations.",
  },
  {
    question: "Can schools start with a baseline assessment first?",
    answer:
      "Yes. Schools can begin with a baseline test to establish academic signal quickly, then expand into broader diagnostics and platform workflows.",
  },
];

export function resolveSceneBlend(progress: number) {
  const chapters = HOME_STORY_CHAPTERS;
  const clamped = Math.min(1, Math.max(0, progress));

  if (chapters.length === 1) {
    return {
      current: chapters[0],
      next: chapters[0],
      blend: 0,
      index: 0,
    };
  }

  const scaled = clamped * (chapters.length - 1);
  const index = Math.min(chapters.length - 1, Math.floor(scaled));
  const nextIndex = Math.min(chapters.length - 1, index + 1);

  return {
    current: chapters[index],
    next: chapters[nextIndex],
    blend: nextIndex === index ? 0 : scaled - index,
    index,
  };
}
