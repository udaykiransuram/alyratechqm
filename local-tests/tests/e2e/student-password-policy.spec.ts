/// <reference types="@playwright/test" />
import bcrypt from "bcryptjs";
import { expect, test } from "@playwright/test";

import { getAuthErrorMessage } from "../../../lib/auth-runtime";
import {
  getDefaultStudentPassword,
  resolveStudentPasswordAdminInfo,
  validatePasswordInput,
  validateStudentDefaultPasswordSource,
} from "../../../lib/user-credentials";

test.describe("Student password policy helpers @desktop", () => {
  test("uses saved phone digits as the default student password and validates resets clearly", async () => {
    expect(getDefaultStudentPassword("+91 98765 43210")).toBe("919876543210");
    expect(validateStudentDefaultPasswordSource("")).toEqual({
      ok: false,
      message:
        "Student phone number must include digits because it becomes the default password.",
    });
    expect(
      validatePasswordInput({
        role: "student",
        mobileNumber: "+91 98765 43210",
        password: "919876543210",
      }),
    ).toEqual({ ok: true });
    expect(
      validatePasswordInput({
        role: "student",
        mobileNumber: "+91 98765 43210",
        password: "abc",
      }),
    ).toEqual({
      ok: false,
      message:
        "Password must be at least 6 characters long, unless it matches the student's saved phone number digits exactly.",
    });
    expect(
      validatePasswordInput({
        role: "student",
        mobileNumber: "+91 98765 43210",
        password: "custom42",
      }),
    ).toEqual({ ok: true });
  });

  test("describes admin support state for default, custom, and missing student passwords", async () => {
    const defaultPassword = "919876543210";

    const defaultInfo = await resolveStudentPasswordAdminInfo({
      mobileNumber: "+91 98765 43210",
      passwordHash: await bcrypt.hash(defaultPassword, 4),
    });
    expect(defaultInfo.state).toBe("default_phone");
    expect(defaultInfo.currentPassword).toBe(defaultPassword);
    expect(defaultInfo.detail).toContain("reset it back");

    const customInfo = await resolveStudentPasswordAdminInfo({
      mobileNumber: "+91 98765 43210",
      passwordHash: await bcrypt.hash("custom42", 4),
    });
    expect(customInfo.state).toBe("custom");
    expect(customInfo.defaultPasswordAvailable).toBe(true);
    expect(customInfo.detail).toContain("If it is forgotten, reset it");

    const missingInfo = await resolveStudentPasswordAdminInfo({
      mobileNumber: "+91 98765 43210",
      passwordHash: "",
    });
    expect(missingInfo.state).toBe("missing");
    expect(missingInfo.detail).toContain("Reset to the saved phone-number digits");
  });

  test("maps student sign-in failures to the admin reset guidance", async () => {
    expect(getAuthErrorMessage("StudentSignInFailed", "school")).toContain(
      "ask your school admin to reset it",
    );
    expect(getAuthErrorMessage("StudentPasswordNotProvisioned", "school")).toContain(
      "saved phone-number digits",
    );
    expect(getAuthErrorMessage("SchoolNotFound", "school")).toContain(
      "selected school is no longer available",
    );
  });
});
