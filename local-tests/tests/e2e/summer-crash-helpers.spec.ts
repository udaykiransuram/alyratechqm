/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import { isHiddenPublicSchoolKey } from "../../../lib/public-school/shared";
import {
  isSummerCrashSession,
  maskSummerCrashId,
  normalizeSummerCrashClassBandKey,
  normalizeSummerCrashNameKey,
  normalizeSummerCrashPhone,
} from "../../../lib/summer-crash/shared";
import {
  SUMMER_CRASH_DEFAULT_CLASS_BANDS,
  SUMMER_CRASH_SCHOOL_KEY,
} from "../../../lib/summer-crash/constants";
import SummerCrashCampaign from "../../../models/SummerCrashCampaign";
import SummerCrashEnrollment from "../../../models/SummerCrashEnrollment";

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
  });
});
