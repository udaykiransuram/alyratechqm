/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import { isHiddenPublicSchoolKey } from "../../../lib/public-school/shared";
import {
  buildSummerCrashDiagnosticHref,
  buildSummerCrashStudentReportHref,
  formatSummerCrashPrice,
  isSummerCrashSession,
  maskSummerCrashId,
  normalizeSummerCrashClassBandKey,
  normalizeSummerCrashLookupMatches,
  normalizeSummerCrashNameKey,
  normalizeSummerCrashPhone,
  resolveSummerCrashPostRegistrationHref,
  resolveSummerCrashSelectedSummerId,
} from "../../../lib/summer-crash/shared";
import {
  getSummerCrashCountdownParts,
  resolveSummerCrashPricing,
} from "../../../lib/summer-crash/offer";
import {
  SUMMER_CRASH_DEFAULT_CLASS_BANDS,
  SUMMER_CRASH_SCHOOL_KEY,
} from "../../../lib/summer-crash/constants";
import { deriveSummerCrashCourseAccessState } from "../../../lib/summer-crash/course-access";
import {
  canAccessSummerCrashPortalTarget,
  getDefaultSummerCrashPortalAccessPolicy,
  isSummerCrashPortalRestricted,
} from "../../../lib/summer-crash/portal-access";
import {
  buildSummerCrashAnswerSummary,
  buildSummerCrashAreaInsights,
  buildSummerCrashParentNextSteps,
  selectSummerCrashQuestionLabels,
  stripHtmlToText,
} from "../../../lib/summer-crash/diagnostic-report";
import SummerCrashCampaign from "../../../models/SummerCrashCampaign";
import SummerCrashEnrollment from "../../../models/SummerCrashEnrollment";
import SummerCrashPayment from "../../../models/SummerCrashPayment";

test.describe("Summer crash course helpers @desktop", () => {
  test("normalizes summer-specific identifiers and detects the hidden summer school", async () => {
    expect(normalizeSummerCrashPhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizeSummerCrashNameKey("  Ada   Lovelace  ")).toBe(
      "ada lovelace",
    );
    expect(normalizeSummerCrashClassBandKey("  Class   8  ")).toBe("class 8");
    expect(maskSummerCrashId("SC123456")).toBe("SC••56");
    expect(isHiddenPublicSchoolKey(SUMMER_CRASH_SCHOOL_KEY)).toBe(true);
    expect(isHiddenPublicSchoolKey("regular-school")).toBe(false);
  });

  test("normalizes summer lookup matches and resolves the selected student", async () => {
    const matches = normalizeSummerCrashLookupMatches([
      {
        studentName: "  Ada Lovelace ",
        guardianName: " Parent One ",
        classBand: " Class 8 ",
        summerId: "sc123456",
      },
      {
        studentName: " Grace Hopper ",
        guardianName: " Parent One ",
        classBand: "Class 10",
        summerId: "SC654321",
        maskedSummerId: "SC••21",
      },
    ]);

    expect(matches).toEqual([
      {
        studentName: "Ada Lovelace",
        guardianName: "Parent One",
        classBand: "Class 8",
        summerId: "SC123456",
        maskedSummerId: "SC••56",
      },
      {
        studentName: "Grace Hopper",
        guardianName: "Parent One",
        classBand: "Class 10",
        summerId: "SC654321",
        maskedSummerId: "SC••21",
      },
    ]);

    expect(resolveSummerCrashSelectedSummerId(matches, "sc654321")).toBe(
      "SC654321",
    );
    expect(
      resolveSummerCrashSelectedSummerId([
        {
          studentName: "Alan Turing",
          classBand: "Class 9",
          summerId: "sc111222",
        },
      ]),
    ).toBe("SC111222");
  });

  test("builds safe diagnostic and report routes for the summer flow", async () => {
    expect(buildSummerCrashDiagnosticHref("paper_123")).toBe(
      "/student/tests/paper_123?returnTo=%2Fstudent%2Fcrash-course%2Fdiagnostic-submitted&autoStart=1",
    );
    expect(buildSummerCrashStudentReportHref("response_123")).toBe(
      "/student/reports/response_123?returnTo=%2Fstudent%2Fcrash-course",
    );
    expect(formatSummerCrashPrice(1499, "INR")).toBe("₹1,499");
  });

  test("activates early-bird pricing before the deadline and keeps the base price after it expires", async () => {
    const activePricing = resolveSummerCrashPricing({
      basePrice: 4999,
      currency: "INR",
      earlyBirdPrice: 3999,
      earlyBirdEndsAt: "2026-05-05T18:30:00.000Z",
      earlyBirdLabel: "Early Bird Offer",
      now: "2026-04-21T04:30:00.000Z",
    });

    expect(activePricing.price).toBe(3999);
    expect(activePricing.earlyBirdOffer).toMatchObject({
      label: "Early Bird Offer",
      price: 3999,
      originalPrice: 4999,
      savingsAmount: 1000,
      endsAt: "2026-05-05T18:30:00.000Z",
    });

    const expiredPricing = resolveSummerCrashPricing({
      basePrice: 4999,
      currency: "INR",
      earlyBirdPrice: 3999,
      earlyBirdEndsAt: "2026-05-05T18:30:00.000Z",
      earlyBirdLabel: "Early Bird Offer",
      now: "2026-05-06T04:30:00.000Z",
    });

    expect(expiredPricing.price).toBe(4999);
    expect(expiredPricing.earlyBirdOffer).toBeNull();
  });

  test("falls back to a sensible early-bird discount when only the deadline is configured", async () => {
    const pricing = resolveSummerCrashPricing({
      basePrice: 1000,
      currency: "INR",
      earlyBirdPrice: "",
      earlyBirdEndsAt: "2026-05-05T18:30:00.000Z",
      now: "2026-04-21T04:30:00.000Z",
    });

    expect(pricing.price).toBe(800);
    expect(pricing.earlyBirdOffer).toMatchObject({
      price: 800,
      originalPrice: 1000,
      savingsAmount: 200,
    });
  });

  test("builds a stable countdown snapshot for the early-bird timer", async () => {
    expect(
      getSummerCrashCountdownParts({
        endsAt: "2026-04-23T10:15:30.000Z",
        now: "2026-04-21T08:10:05.000Z",
      }),
    ).toEqual({
      totalMs: 180_325_000,
      days: 2,
      hours: 2,
      minutes: 5,
      seconds: 25,
      expired: false,
    });

    expect(
      getSummerCrashCountdownParts({
        endsAt: "2026-04-21T08:10:05.000Z",
        now: "2026-04-21T08:10:05.000Z",
      }),
    ).toEqual({
      totalMs: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      expired: true,
    });
  });

  test("sends both diagnostic and direct summer registrations to the real destination", async () => {
    const diagnosticHref = buildSummerCrashDiagnosticHref("paper_123");

    expect(
      resolveSummerCrashPostRegistrationHref({
        destinationHref: diagnosticHref,
        entrySource: "diagnostic",
      }),
    ).toBe(diagnosticHref);

    expect(
      resolveSummerCrashPostRegistrationHref({
        destinationHref: "/student/crash-course",
        entrySource: "direct_registration",
        promptPayment: true,
      }),
    ).toBe("/student/crash-course?promptPayment=1&source=registration");

    expect(
      resolveSummerCrashPostRegistrationHref({
        destinationHref: diagnosticHref,
        entrySource: "diagnostic",
      }),
    ).toBe(diagnosticHref);
  });

  test("keeps the summer session check scoped to the dedicated summer school", async () => {
    expect(
      isSummerCrashSession({
        accountType: "school_user",
        role: "student",
        schoolKey: SUMMER_CRASH_SCHOOL_KEY,
      }),
    ).toBe(true);

    expect(
      isSummerCrashSession({
        accountType: "school_user",
        role: "student",
        schoolKey: "regular-school",
      }),
    ).toBe(false);

    expect(
      isSummerCrashSession({
        accountType: "school_user",
        role: "teacher",
        schoolKey: SUMMER_CRASH_SCHOOL_KEY,
      }),
    ).toBe(false);
  });

  test("ships default class bands and unique enrollment tuple indexes", async () => {
    const campaign = new SummerCrashCampaign();
    expect(
      campaign.classMappings.map((mapping) => mapping.classBand),
    ).toEqual([...SUMMER_CRASH_DEFAULT_CLASS_BANDS]);
    expect(
      campaign.classMappings.every(
        (mapping) =>
          Object.prototype.hasOwnProperty.call(mapping.toObject?.() || mapping, "diagnosticQuestionPaperId") ||
          "diagnosticQuestionPaperId" in mapping,
      ),
    ).toBe(true);

    const campaignIndexes = SummerCrashCampaign.schema.indexes();
    const enrollmentIndexes = SummerCrashEnrollment.schema.indexes();

    expect(
      campaignIndexes.some(
        ([fields, options]) =>
          fields.summerSchoolKey === 1 && Boolean(options?.unique),
      ),
    ).toBe(true);

    expect(
      enrollmentIndexes.some(
        ([fields, options]) =>
          fields.campaignId === 1 &&
          fields.phoneDigits === 1 &&
          fields.studentNameNormalized === 1 &&
          fields.classBandNormalized === 1 &&
          Boolean(options?.unique),
      ),
    ).toBe(true);

    expect(
      enrollmentIndexes.some(
        ([fields]) =>
          fields.summerSchoolKey === 1 &&
          fields.phoneDigits === 1 &&
          fields.status === 1,
      ),
    ).toBe(true);

    expect(
      enrollmentIndexes.some(
        ([fields]) =>
          fields.campaignId === 1 &&
          fields.classBandNormalized === 1 &&
          fields.diagnosticStatus === 1,
      ),
    ).toBe(true);

    const paymentIndexes = SummerCrashPayment.schema.indexes();
    expect(
      paymentIndexes.some(
        ([fields]) =>
          fields.campaignId === 1 &&
          fields.phoneDigits === 1 &&
          fields.classBandNormalized === 1 &&
          fields.studentNameNormalized === 1,
      ),
    ).toBe(true);
  });

  test("derives summer course access state from payment status snapshots", async () => {
    expect(
      deriveSummerCrashCourseAccessState({
        price: 0,
        currency: "INR",
      }),
    ).toEqual({
      requiresPayment: false,
      isUnlocked: true,
      latestPaymentStatus: "none",
      price: 0,
      currency: "INR",
      earlyBirdOffer: null,
    });

    expect(
      deriveSummerCrashCourseAccessState({
        price: 1999,
        currency: "INR",
      }),
    ).toEqual({
      requiresPayment: true,
      isUnlocked: false,
      latestPaymentStatus: "none",
      price: 1999,
      currency: "INR",
      earlyBirdOffer: null,
    });

    expect(
      deriveSummerCrashCourseAccessState({
        price: 1999,
        currency: "INR",
        paymentStatuses: ["pending"],
      }),
    ).toMatchObject({
      requiresPayment: true,
      isUnlocked: false,
      latestPaymentStatus: "pending",
    });

    expect(
      deriveSummerCrashCourseAccessState({
        price: 1999,
        currency: "INR",
        paymentStatuses: ["failed"],
      }),
    ).toMatchObject({
      requiresPayment: true,
      isUnlocked: false,
      latestPaymentStatus: "failed",
    });

    expect(
      deriveSummerCrashCourseAccessState({
        price: 1999,
        currency: "INR",
        paymentStatuses: ["failed", "paid"],
      }),
    ).toMatchObject({
      requiresPayment: true,
      isUnlocked: true,
      latestPaymentStatus: "paid",
    });
  });

  test("limits unpaid summer portal access to crash home, diagnostic, and its report only", async () => {
    const unrestrictedPolicy = getDefaultSummerCrashPortalAccessPolicy();

    expect(isSummerCrashPortalRestricted(unrestrictedPolicy)).toBe(false);
    expect(
      canAccessSummerCrashPortalTarget(unrestrictedPolicy, {
        kind: "locked-student-content",
      }),
    ).toBe(true);

    const restrictedPolicy = {
      applies: true,
      isUnlocked: false,
      requiresPayment: true,
      allowedDiagnosticPaperId: "paper_123",
      allowedDiagnosticResponseId: "response_456",
      redirectHref: "/student/crash-course",
    } as const;

    expect(isSummerCrashPortalRestricted(restrictedPolicy)).toBe(true);
    expect(
      canAccessSummerCrashPortalTarget(restrictedPolicy, {
        kind: "crash-course",
      }),
    ).toBe(true);
    expect(
      canAccessSummerCrashPortalTarget(restrictedPolicy, {
        kind: "session-heartbeat",
      }),
    ).toBe(true);
    expect(
      canAccessSummerCrashPortalTarget(restrictedPolicy, {
        kind: "diagnostic-test",
        paperId: "paper_123",
      }),
    ).toBe(true);
    expect(
      canAccessSummerCrashPortalTarget(restrictedPolicy, {
        kind: "diagnostic-report",
        responseId: "response_456",
      }),
    ).toBe(true);
    expect(
      canAccessSummerCrashPortalTarget(restrictedPolicy, {
        kind: "diagnostic-test",
        paperId: "paper_other",
      }),
    ).toBe(false);
    expect(
      canAccessSummerCrashPortalTarget(restrictedPolicy, {
        kind: "diagnostic-report",
        responseId: "response_other",
      }),
    ).toBe(false);
    expect(
      canAccessSummerCrashPortalTarget(restrictedPolicy, {
        kind: "locked-student-content",
      }),
    ).toBe(false);
  });

  test("picks parent-friendly subskill and topic labels from question metadata", async () => {
    const labels = selectSummerCrashQuestionLabels({
      question: {
        subject: { name: "Mathematics" },
        tags: [
          { name: "Fractions", type: { name: "chapter-name" } },
          { name: "Multiply decimals", type: { name: "subtopic-title" } },
          { name: "Understand", type: { name: "competency" } },
        ],
      },
      fallbackSectionName: "Section A",
    });

    expect(labels).toEqual({
      subskillLabel: "Multiply decimals",
      topicLabel: "Fractions",
      topicKind: "topic",
      weakAreaLabel: "Multiply decimals",
      subjectLabel: "Mathematics",
    });
    expect(stripHtmlToText("<p>Test <strong>value</strong></p>")).toBe(
      "Test value",
    );
  });

  test("builds weak-area insights and parent next steps from diagnostic question results", async () => {
    const questionResults = [
      {
        question: {
          subject: { name: "Mathematics" },
          tags: [
            { name: "Multiply decimals", type: { name: "subtopic-title" } },
            { name: "Fractions", type: { name: "chapter-name" } },
          ],
        },
        sectionName: "Section A",
        fallbackSubjectName: "Mathematics",
        status: "incorrect" as const,
      },
      {
        question: {
          subject: { name: "Mathematics" },
          tags: [
            { name: "Multiply decimals", type: { name: "subtopic" } },
            { name: "Fractions", type: { name: "topic" } },
          ],
        },
        sectionName: "Section A",
        fallbackSubjectName: "Mathematics",
        status: "unattempted" as const,
      },
      {
        question: {
          subject: { name: "Mathematics" },
          tags: [
            { name: "Place value", type: { name: "subtopic" } },
            { name: "Decimals", type: { name: "topic" } },
          ],
        },
        sectionName: "Section A",
        fallbackSubjectName: "Mathematics",
        status: "correct" as const,
      },
    ];

    const insights = buildSummerCrashAreaInsights({ questionResults });
    expect(insights.subskillInsights[0]).toMatchObject({
      kind: "subskill",
      label: "Multiply decimals",
      incorrect: 1,
      unattempted: 1,
      accuracyPct: 0,
    });
    expect(insights.topicInsights[0]).toMatchObject({
      label: "Fractions",
      incorrect: 1,
      unattempted: 1,
      accuracyPct: 0,
    });

    const nextSteps = buildSummerCrashParentNextSteps({
      weakSubskills: insights.subskillInsights.slice(0, 1),
      weakTopics: insights.topicInsights.slice(0, 1),
      overallAccuracyPct: 33,
      isUnlocked: false,
    });

    expect(nextSteps).toHaveLength(3);
    expect(nextSteps[0]).toContain("Multiply decimals");
    expect(nextSteps[1]).toContain("Fractions");
    expect(nextSteps[2]).toContain("short and consistent");
  });

  test("summarizes the student's answer and the correct answer for objective questions", async () => {
    const summary = buildSummerCrashAnswerSummary({
      question: {
        type: "single",
        options: [
          { content: "<p>12</p>" },
          { content: "<p>14</p>" },
          { content: "<p>16</p>" },
        ],
        answerIndexes: [1],
      },
      answer: {
        selectedOptions: [2],
      },
    });

    expect(summary).toEqual({
      studentAnswerSummary: "16",
      correctAnswerSummary: "14",
    });
  });
});
