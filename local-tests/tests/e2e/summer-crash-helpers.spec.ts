/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import { isHiddenPublicSchoolKey } from "../../../lib/public-school/shared";
import {
  buildSummerCrashDiagnosticHref,
  buildSummerCrashStudentReportHref,
  buildSummerCrashWelcomeHref,
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

  test("builds safe diagnostic, welcome, and report routes for the summer flow", async () => {
    expect(buildSummerCrashDiagnosticHref("paper_123")).toBe(
      "/student/tests/paper_123?returnTo=%2Fstudent%2Fcrash-course%2Fdiagnostic-submitted&autoStart=1",
    );
    expect(buildSummerCrashWelcomeHref("/student/crash-course")).toBe(
      "/summer-crash-course/welcome?next=%2Fstudent%2Fcrash-course",
    );
    expect(buildSummerCrashWelcomeHref("https://example.com")).toBe(
      "/summer-crash-course/welcome",
    );
    expect(buildSummerCrashStudentReportHref("response_123")).toBe(
      "/student/reports/response_123?returnTo=%2Fstudent%2Fcrash-course",
    );
    expect(formatSummerCrashPrice(1499, "INR")).toBe("₹1,499");
  });

  test("sends diagnostic registrations straight into the test while keeping course-first registration on setup", async () => {
    const diagnosticHref = buildSummerCrashDiagnosticHref("paper_123");

    expect(
      resolveSummerCrashPostRegistrationHref({
        destinationHref: diagnosticHref,
        entrySource: "diagnostic",
        requiresPasswordSetup: true,
      }),
    ).toBe(diagnosticHref);

    expect(
      resolveSummerCrashPostRegistrationHref({
        destinationHref: "/student/crash-course",
        entrySource: "direct_registration",
        requiresPasswordSetup: true,
      }),
    ).toBe("/summer-crash-course/welcome?next=%2Fstudent%2Fcrash-course");

    expect(
      resolveSummerCrashPostRegistrationHref({
        destinationHref: diagnosticHref,
        entrySource: "diagnostic",
        requiresPasswordSetup: false,
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
