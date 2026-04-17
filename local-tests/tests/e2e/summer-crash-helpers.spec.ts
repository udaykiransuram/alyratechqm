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
      "/student/tests/paper_123?returnTo=%2Fstudent%2Fcrash-course%3Fsubmitted%3D1%26mode%3Ddiagnostic",
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
});
