/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

test.describe("Summer Crash registration API @desktop", () => {
  test("does not fail closed when Redis is unavailable in mocked local mode", async ({
    request,
  }) => {
    const response = await request.post("/api/summer-crash/register", {
      data: {
        studentName: "Ada Lovelace",
        guardianName: "Parent One",
        phone: "9876543210",
        classBand: "Class 7",
        sourceSchoolName: "Local Test School",
        password: "SummerCrash#2026",
        entrySource: "diagnostic",
      },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      registration: {
        studentName: "Ada Lovelace",
        guardianName: "Parent One",
        classBand: "Class 7",
        entrySource: "diagnostic",
      },
    });
  });
});
