/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import {
  isPublicPathname,
  resolveAppChromeKind,
} from "../../../lib/navigation/canonical-paths";

test.describe("App chrome path resolution", () => {
  test("keeps platform home in the public route family", async () => {
    expect(isPublicPathname("/")).toBe(true);
    expect(isPublicPathname("/platform-home")).toBe(true);
    expect(isPublicPathname("/platform-home/story")).toBe(true);
  });

  test("selects the expected chrome kind for major route groups", async () => {
    expect(resolveAppChromeKind("/platform-home")).toBe("home");
    expect(resolveAppChromeKind("/about")).toBe("public");
    expect(resolveAppChromeKind("/auth/signin")).toBe("auth");
    expect(resolveAppChromeKind("/student/tests")).toBe("student");
    expect(resolveAppChromeKind("/workspace")).toBe("product");
    expect(resolveAppChromeKind("/company/schools")).toBe("product");
  });
});
