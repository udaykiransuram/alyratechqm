import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Building2,
  GraduationCap,
  Layers3,
  Radar,
  ScanLine,
  ShieldCheck,
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

export type HomeSceneKey =
  | "hero"
  | "signal"
  | "patterns"
  | "intervention"
  | "school"
  | "class"
  | "student";

export type HomeChapter = {
  id: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  sceneKey: HomeSceneKey;
  metricLabel: string;
  metricValue: string;
  metricNote: string;
};

export type HomeSceneTone = "teal" | "cyan" | "amber" | "emerald" | "ink";

export type HomeSceneCard = {
  level: string;
  title: string;
  footer: string;
  tone: HomeSceneTone;
  rows: Array<{
    label: string;
    value: number;
  }>;
};

export type HomeSceneState = {
  id: HomeSceneKey;
  badge: string;
  headline: string;
  supporting: string;
  imageSrc: string;
  imageAlt: string;
  glowA: string;
  glowB: string;
  chips: string[];
  cards: [HomeSceneCard, HomeSceneCard, HomeSceneCard];
};

export type HomePlatformPillar = {
  title: string;
  eyebrow: string;
  description: string;
  modules: string[];
  icon: LucideIcon;
};

export const HOME_CHAPTERS: HomeChapter[] = [
  {
    id: "hero",
    shortLabel: "Intro",
    eyebrow: "Trust-first diagnostics",
    title: "We reveal hidden thinking patterns before they become marks lost.",
    description:
      "Alyra Tech helps school leaders and teachers see what grades alone cannot: hesitation, misconception clusters, confidence gaps, and the exact interventions worth making next.",
    bullets: [
      "Leadership-ready visibility from school to student.",
      "Teacher-ready next moves instead of generic remediation.",
      "One baseline assessment powering diagnosis, action, and proof.",
    ],
    sceneKey: "hero",
    metricLabel: "View stack",
    metricValue: "School -> Class -> Student",
    metricNote: "A single diagnostic flow that stays coherent as you zoom in.",
  },
  {
    id: "signal",
    shortLabel: "Signal",
    eyebrow: "What grades miss",
    title: "The mark is the summary. The signal is in how the student got there.",
    description:
      "Two students can land on the same score and still need entirely different teaching responses. We capture the pattern behind the mark, not just the mark itself.",
    bullets: [
      "Separate conceptual gaps from slips and rushed choices.",
      "Track repeated confusion instead of one-off misses.",
      "Give teachers evidence they can act on in the next class.",
    ],
    sceneKey: "signal",
    metricLabel: "Blind spot removed",
    metricValue: "Score-only reporting",
    metricNote: "The system keeps the path to the answer visible for diagnosis.",
  },
  {
    id: "patterns",
    shortLabel: "Patterns",
    eyebrow: "Risk clarity",
    title: "Accuracy without confidence and speed without transfer create different risks.",
    description:
      "Surface-level scores compress too much. Our story layer helps schools distinguish between a student who guessed correctly, a student who hesitated, and a student who truly transferred understanding.",
    bullets: [
      "See confidence and reasoning friction alongside accuracy.",
      "Spot clusters before they grow into section-wide underperformance.",
      "Move from hindsight reporting to earlier intervention.",
    ],
    sceneKey: "patterns",
    metricLabel: "Risk lens",
    metricValue: "Confidence x transfer",
    metricNote: "The platform shows why similar marks can require different support.",
  },
  {
    id: "intervention",
    shortLabel: "Action",
    eyebrow: "Intervention logic",
    title: "Once the pattern is visible, remediation stops being generic.",
    description:
      "Schools can stop reteaching everything. Teachers get a narrower target, leadership gets cleaner evidence of what changed, and students receive support matched to the actual error pattern.",
    bullets: [
      "Turn diagnosis into a sharper reteach plan.",
      "Connect misconception clusters to specific action steps.",
      "Create calmer follow-up cycles that feel measurable.",
    ],
    sceneKey: "intervention",
    metricLabel: "Intervention style",
    metricValue: "Specific, not broad",
    metricNote: "Better diagnosis reduces noisy, low-confidence remediation cycles.",
  },
  {
    id: "school",
    shortLabel: "School",
    eyebrow: "School -> class -> student",
    title: "Start at school level. Spot the signal before it becomes a board-room problem.",
    description:
      "Leadership gets a calm overview first: where the trend sits, which grades are drifting, and where intervention capacity should go before the next assessment cycle.",
    bullets: [
      "Grade-wide and subject-wide trend visibility.",
      "Cleaner prioritization for reviews and support planning.",
      "Proof of progress that is easier to explain to stakeholders.",
    ],
    sceneKey: "school",
    metricLabel: "Leadership view",
    metricValue: "Trend before escalation",
    metricNote: "School-wide patterns appear first so teams can respond earlier.",
  },
  {
    id: "class",
    shortLabel: "Class",
    eyebrow: "Cluster drill-down",
    title: "Drop into one class and see which misconception cluster needs reteaching next.",
    description:
      "The platform narrows from leadership signal to classroom action. Teams can see whether the issue is concentrated, repeated, or spreading between groups.",
    bullets: [
      "Class clusters reveal repeated friction points quickly.",
      "Teachers can focus on the concept, not just the score drop.",
      "Support conversations become tighter and less subjective.",
    ],
    sceneKey: "class",
    metricLabel: "Teacher view",
    metricValue: "Cluster-aware",
    metricNote: "One drill-down shows which class needs the next attention window.",
  },
  {
    id: "student",
    shortLabel: "Student",
    eyebrow: "Learner detail",
    title: "Open one learner and leave with the next teaching move, not just a label.",
    description:
      "Student detail should feel practical. The final layer shows the learner, the misconception pattern, the confidence risk, and the next action worth trying in class or follow-up.",
    bullets: [
      "Concept-level diagnosis with cleaner learner context.",
      "Confidence and misconception detail in one view.",
      "Action-ready support for teacher, parent, and learner conversations.",
    ],
    sceneKey: "student",
    metricLabel: "Student view",
    metricValue: "Pattern + next step",
    metricNote: "Diagnosis closes with a clear intervention handoff instead of a label alone.",
  },
];

export const HOME_SCENES: Record<HomeSceneKey, HomeSceneState> = {
  hero: {
    id: "hero",
    badge: "Live diagnostic scene",
    headline: "A premium story layer for diagnosis, drill-down, and intervention.",
    supporting:
      "The opening scene frames the whole product as one connected system instead of separate feature cards.",
    imageSrc: "/images/source-frontend/ttf-hero-classroom.jpg",
    imageAlt: "Students concentrating in a classroom",
    glowA: "rgba(57, 205, 190, 0.34)",
    glowB: "rgba(74, 222, 248, 0.22)",
    chips: ["Thinking pattern map", "Trust-first dashboard", "Intervention ready"],
    cards: [
      {
        level: "School view",
        title: "Hidden pattern index",
        footer: "Leadership-ready overview",
        tone: "teal",
        rows: [
          { label: "Concept transfer", value: 72 },
          { label: "Confidence stability", value: 61 },
          { label: "Intervention priority", value: 84 },
        ],
      },
      {
        level: "Class view",
        title: "Cluster watch",
        footer: "Repeated friction pockets",
        tone: "cyan",
        rows: [
          { label: "Grade 7A", value: 66 },
          { label: "Grade 7B", value: 81 },
          { label: "Grade 8A", value: 58 },
        ],
      },
      {
        level: "Student view",
        title: "Learner card",
        footer: "Pattern + next move",
        tone: "emerald",
        rows: [
          { label: "Inference clarity", value: 78 },
          { label: "Retry confidence", value: 52 },
          { label: "Follow-up urgency", value: 69 },
        ],
      },
    ],
  },
  signal: {
    id: "signal",
    badge: "What grades miss",
    headline: "Score-only reporting hides the path that produced the mark.",
    supporting:
      "This state brings the diagnostic signal forward: hesitation, recovery, and repeated misconception patterns.",
    imageSrc: "/images/source-frontend/ttf-mcq-exam.jpg",
    imageAlt: "Students working through a test sheet",
    glowA: "rgba(248, 113, 113, 0.28)",
    glowB: "rgba(45, 212, 191, 0.18)",
    chips: ["Same score, different need", "Signal before failure", "Reasoning path visible"],
    cards: [
      {
        level: "Signal card",
        title: "Same mark, different story",
        footer: "Score alone is not the diagnosis",
        tone: "amber",
        rows: [
          { label: "Recovered after hesitation", value: 67 },
          { label: "Conceptual miss", value: 83 },
          { label: "Guess corrected later", value: 44 },
        ],
      },
      {
        level: "Teacher lens",
        title: "Error pattern split",
        footer: "Concept vs carelessness",
        tone: "teal",
        rows: [
          { label: "Concept gap", value: 79 },
          { label: "Process slip", value: 36 },
          { label: "Reading miss", value: 58 },
        ],
      },
      {
        level: "Review lens",
        title: "Retest risk",
        footer: "Who needs follow-up first",
        tone: "ink",
        rows: [
          { label: "Likely to repeat", value: 74 },
          { label: "Recoverable in class", value: 52 },
          { label: "Needs parent note", value: 28 },
        ],
      },
    ],
  },
  patterns: {
    id: "patterns",
    badge: "Risk patterns",
    headline: "Confidence, transfer, and pace tell very different stories even at similar scores.",
    supporting:
      "The middle state separates students who are fragile from students who are actually secure.",
    imageSrc: "/images/source-frontend/ttf-students-laptop.jpg",
    imageAlt: "Students using laptops in class",
    glowA: "rgba(56, 189, 248, 0.3)",
    glowB: "rgba(250, 204, 21, 0.18)",
    chips: ["Confidence gap", "Transfer signal", "Reteach with precision"],
    cards: [
      {
        level: "Cluster model",
        title: "Confidence x transfer",
        footer: "Not all accuracy is equal",
        tone: "cyan",
        rows: [
          { label: "Secure and transferable", value: 76 },
          { label: "Correct but fragile", value: 49 },
          { label: "Fast but unstable", value: 58 },
        ],
      },
      {
        level: "Class signal",
        title: "Cluster spread",
        footer: "Where the friction is pooling",
        tone: "amber",
        rows: [
          { label: "High-confidence cluster", value: 63 },
          { label: "Low-confidence cluster", value: 71 },
          { label: "Mixed evidence", value: 46 },
        ],
      },
      {
        level: "Leader note",
        title: "Escalation timing",
        footer: "Intervene before it becomes visible in aggregate marks",
        tone: "teal",
        rows: [
          { label: "Now", value: 82 },
          { label: "Next review", value: 54 },
          { label: "Monitor only", value: 34 },
        ],
      },
    ],
  },
  intervention: {
    id: "intervention",
    badge: "Intervention mode",
    headline: "Good diagnosis narrows the teaching response instead of widening it.",
    supporting:
      "The scene pivots from detection to action with smaller, calmer intervention windows.",
    imageSrc: "/images/source-frontend/ttf-team-meeting.jpg",
    imageAlt: "Educators in a collaborative meeting",
    glowA: "rgba(16, 185, 129, 0.28)",
    glowB: "rgba(34, 197, 94, 0.2)",
    chips: ["Reteach narrow", "Teacher-ready", "Progress-friendly"],
    cards: [
      {
        level: "Action board",
        title: "Next teaching move",
        footer: "Specific beats generic",
        tone: "emerald",
        rows: [
          { label: "Small-group reteach", value: 84 },
          { label: "Example rebuild", value: 63 },
          { label: "Parent follow-up", value: 31 },
        ],
      },
      {
        level: "Class card",
        title: "Who needs it first",
        footer: "Intervention sequence",
        tone: "teal",
        rows: [
          { label: "Immediate", value: 78 },
          { label: "This week", value: 58 },
          { label: "Monitor", value: 37 },
        ],
      },
      {
        level: "Leadership card",
        title: "Proof loop",
        footer: "What changed after support",
        tone: "ink",
        rows: [
          { label: "Signal improved", value: 69 },
          { label: "Confidence recovered", value: 61 },
          { label: "Still unresolved", value: 28 },
        ],
      },
    ],
  },
  school: {
    id: "school",
    badge: "School layer",
    headline: "The school story comes first so leadership can allocate attention with confidence.",
    supporting:
      "From here the scene begins a premium drill-down from institution signal to classroom action.",
    imageSrc: "/images/source-frontend/ttf-analytics-dashboard.jpg",
    imageAlt: "Educational analytics dashboard",
    glowA: "rgba(20, 184, 166, 0.32)",
    glowB: "rgba(59, 130, 246, 0.18)",
    chips: ["Grade patterns", "Leadership prioritization", "Review-ready evidence"],
    cards: [
      {
        level: "School",
        title: "Trend map",
        footer: "Signal before escalation",
        tone: "teal",
        rows: [
          { label: "Grade 6 stability", value: 74 },
          { label: "Grade 7 risk", value: 82 },
          { label: "Grade 8 recovery", value: 57 },
        ],
      },
      {
        level: "Class",
        title: "Hotspot shortlist",
        footer: "Classes to review this week",
        tone: "cyan",
        rows: [
          { label: "7B mathematics", value: 86 },
          { label: "8A science", value: 62 },
          { label: "6C reading", value: 48 },
        ],
      },
      {
        level: "Student",
        title: "Representative learners",
        footer: "Open cases under the hotspot",
        tone: "ink",
        rows: [
          { label: "Needs concept rebuild", value: 72 },
          { label: "Needs confidence rebuild", value: 51 },
          { label: "Needs practice only", value: 34 },
        ],
      },
    ],
  },
  class: {
    id: "class",
    badge: "Class layer",
    headline: "The class view reveals the misconception cluster, not just the average drop.",
    supporting:
      "At this level the system turns broad concern into teacher-ready focus areas.",
    imageSrc: "/images/source-frontend/ttf-students-laptop.jpg",
    imageAlt: "Students learning on laptops",
    glowA: "rgba(45, 212, 191, 0.32)",
    glowB: "rgba(245, 158, 11, 0.16)",
    chips: ["Cluster-aware view", "Teacher action", "Less noisy follow-up"],
    cards: [
      {
        level: "Class",
        title: "Cluster 02",
        footer: "Repeated friction around proportional reasoning",
        tone: "cyan",
        rows: [
          { label: "Concept confusion", value: 87 },
          { label: "Confidence drop", value: 68 },
          { label: "Practice readiness", value: 46 },
        ],
      },
      {
        level: "Student",
        title: "Learners inside the cluster",
        footer: "Who needs reteach vs reinforcement",
        tone: "amber",
        rows: [
          { label: "Reteach now", value: 73 },
          { label: "Coach briefly", value: 58 },
          { label: "Monitor only", value: 33 },
        ],
      },
      {
        level: "Teacher",
        title: "Recommended response",
        footer: "Short intervention band",
        tone: "teal",
        rows: [
          { label: "Concept rebuild", value: 81 },
          { label: "Worked example", value: 64 },
          { label: "Parent note", value: 24 },
        ],
      },
    ],
  },
  student: {
    id: "student",
    badge: "Student layer",
    headline: "The learner card closes the loop with a pattern, a risk, and a next move.",
    supporting:
      "This is the endpoint of the drill-down: diagnosis that feels practical in the next conversation.",
    imageSrc: "/images/source-frontend/ttf-hero-classroom.jpg",
    imageAlt: "A student thinking during class",
    glowA: "rgba(34, 197, 94, 0.24)",
    glowB: "rgba(56, 189, 248, 0.18)",
    chips: ["Pattern + next step", "Learner context", "Parent-ready explanation"],
    cards: [
      {
        level: "Student",
        title: "Riya N.",
        footer: "Concept gap with low retry confidence",
        tone: "emerald",
        rows: [
          { label: "Reasoning clarity", value: 43 },
          { label: "Confidence recovery", value: 38 },
          { label: "Follow-up impact", value: 81 },
        ],
      },
      {
        level: "Teacher",
        title: "Recommended next move",
        footer: "Short reteach + worked example",
        tone: "teal",
        rows: [
          { label: "Visual rebuild", value: 82 },
          { label: "Guided practice", value: 68 },
          { label: "Independent check", value: 41 },
        ],
      },
      {
        level: "Home note",
        title: "Parent conversation cue",
        footer: "Clarity without alarm",
        tone: "ink",
        rows: [
          { label: "Explain concept gap", value: 77 },
          { label: "Show next support step", value: 71 },
          { label: "Escalate further", value: 22 },
        ],
      },
    ],
  },
};

export const HOME_PLATFORM_PILLARS: HomePlatformPillar[] = [
  {
    eyebrow: "Intelligence layer",
    title: "Diagnostics that make thinking visible",
    description:
      "Baseline assessments, misconception mapping, confidence signals, and leadership dashboards aligned into one diagnostic operating layer.",
    modules: ["Baseline assessment", "Pattern analysis", "Leadership dashboard", "Growth tracking"],
    icon: Radar,
  },
  {
    eyebrow: "Execution layer",
    title: "Teacher and school workflows that feel connected",
    description:
      "The platform turns diagnosis into coordinated next actions for classrooms, reviews, interventions, and follow-up loops without fragmenting the experience.",
    modules: ["Teacher action plans", "Class reviews", "OMR digitization", "Progress checkpoints"],
    icon: Workflow,
  },
  {
    eyebrow: "Institution layer",
    title: "A calmer operating system for the broader school",
    description:
      "Assessment intelligence connects cleanly with operational modules so the product feels like one premium system rather than a loose collection of tools.",
    modules: ["School ERP", "Parent communication", "Alumni engagement", "Administrative control"],
    icon: Building2,
  },
];

export const HOME_PLATFORM_RIBBON: Array<{
  label: string;
  icon: LucideIcon;
}> = [
  { label: "Diagnostics", icon: Layers3 },
  { label: "Reports", icon: BarChart3 },
  { label: "Teachers", icon: Users },
  { label: "Students", icon: GraduationCap },
  { label: "Question banks", icon: BookOpen },
  { label: "OMR capture", icon: ScanLine },
  { label: "Governance", icon: ShieldCheck },
];
