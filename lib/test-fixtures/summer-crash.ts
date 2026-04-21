import type { StudentCourseSummary } from "@/lib/courses/types";
import type { SummerCrashCourseAccessState } from "@/lib/summer-crash/course-access";
import type { SummerCrashEarlyBirdOffer } from "@/lib/summer-crash/offer";
import {
  buildSummerCrashDiagnosticHref,
  buildSummerCrashStudentReportHref,
} from "@/lib/summer-crash/shared";
import type {
  SummerCrashDiagnosticState,
  SummerCrashStudentState,
} from "@/lib/server/summer-crash";

function cloneForTransport<T>(value: T): T {
  // Mirror the other test fixtures: strip undefined + ensure the object is JSON-serializable.
  return JSON.parse(JSON.stringify(value)) as T;
}

export const MOCK_SUMMER_COURSE: StudentCourseSummary = {
  _id: "666666666666666666666666",
  title: "Numbers & Foundations",
  summary: "Repair core number sense before term starts.",
  class: { _id: "111111111111111111111111", name: "Class 7" },
  subjects: [],
  assignedAcademicSections: [],
  status: "in_progress",
  availabilityStatus: "active",
  publishedAt: "2026-04-21T09:00:00.000Z",
  updatedAt: "2026-04-21T09:00:00.000Z",
  blockCount: 6,
  assessmentCount: 1,
  requiredAssessmentCount: 1,
  completedAssessmentCount: 0,
  completionPercent: 42,
  lastViewedBlockId: null,
  metadata: {
    coverImageUrl: undefined,
    coverImageAltText: undefined,
    startsAt: null,
    dueAt: null,
    completionBadgeLabel: undefined,
    enforceSequentialProgress: false,
    allowNotes: true,
    allowBookmarks: true,
    isTemplate: false,
  },
};

const MOCK_EARLY_BIRD_OFFER: SummerCrashEarlyBirdOffer = {
  label: "Early Bird Offer",
  price: 3999,
  originalPrice: 4999,
  currency: "INR",
  savingsAmount: 1000,
  endsAt: "2026-05-05T18:30:00.000Z",
};

const MOCK_COURSE_ACCESS: SummerCrashCourseAccessState = {
  isUnlocked: true,
  requiresPayment: true,
  latestPaymentStatus: "paid",
  price: 3999,
  currency: "INR",
  earlyBirdOffer: MOCK_EARLY_BIRD_OFFER,
};

const MOCK_LOCKED_COURSE_ACCESS: SummerCrashCourseAccessState = {
  isUnlocked: false,
  requiresPayment: true,
  latestPaymentStatus: "none",
  price: 3999,
  currency: "INR",
  earlyBirdOffer: MOCK_EARLY_BIRD_OFFER,
};

const MOCK_DIAGNOSTIC: SummerCrashDiagnosticState = {
  questionPaperId: "777777777777777777777777",
  title: "Summer Crash Diagnostic",
  duration: 30,
  totalMarks: 40,
  status: "submitted",
  launchHref: buildSummerCrashDiagnosticHref("777777777777777777777777"),
  reportHref: buildSummerCrashStudentReportHref("888888888888888888888888"),
  score: 28,
  percent: 70,
  available: true,
};

export const MOCK_SUMMER_CRASH_LOCKED_STUDENT_ID = "student-e2e-payment-locked";

export function getMockSummerCrashStudentState(params?: {
  includeCourses?: boolean;
  paymentUnlocked?: boolean;
}): SummerCrashStudentState {
  const includeCourses = params?.includeCourses !== false;
  const paymentUnlocked = params?.paymentUnlocked !== false;

  return cloneForTransport({
    title: "Summer Crash Course",
    supportContact: "9876543210",
    supportHref: "https://wa.me/919876543210",
    studentName: "Aarav",
    guardianName: "Parent One",
    classBand: "Class 7",
    summerId: "SC123456",
    requiresPasswordSetup: false,
    courseAccess: paymentUnlocked
      ? MOCK_COURSE_ACCESS
      : MOCK_LOCKED_COURSE_ACCESS,
    courses: includeCourses ? [MOCK_SUMMER_COURSE] : [],
    destinationHref: "/student/crash-course",
    diagnostic: MOCK_DIAGNOSTIC,
  });
}
