/// <reference types="@playwright/test" />
import { expect, test } from "@playwright/test";

import {
  DEFAULT_CUSTOM_ACCENT_HEX,
  resolveStoredNavMode,
  resolveWorkspaceAppearanceTokens,
  type AppPalette,
} from "../../../lib/client/workspace-appearance";

const presetPalettes: AppPalette[] = [
  "ocean",
  "sapphire",
  "evergreen",
  "amber",
  "rose",
  "slate",
  "graphite",
];

function getHue(triplet: string) {
  return Number.parseFloat(String(triplet || "").split(" ")[0] || "0");
}

test.describe("Workspace appearance theme resolution @desktop", () => {
  test("derives linked shell tokens for every preset palette", async () => {
    const navAccents = new Set<string>();
    const navSurfaces = new Set<string>();

    for (const palette of presetPalettes) {
      const resolved = resolveWorkspaceAppearanceTokens({
        textStyle: "straight",
        navMode: "linked",
        navTone: "default",
        palette,
        customAccentHex: DEFAULT_CUSTOM_ACCENT_HEX,
      });

      navAccents.add(resolved.nav.accent);
      navSurfaces.add(resolved.nav.surface);

      expect(resolved.nav.surface).toMatch(/^\d+ \d+% \d+%$/);
      expect(resolved.nav.surfaceStrong).toMatch(/^\d+ \d+% \d+%$/);
      expect(resolved.nav.border).toMatch(/^\d+ \d+% \d+%$/);
      expect(resolved.nav.hover).toMatch(/^\d+ \d+% \d+%$/);
      expect(resolved.nav.accent).toMatch(/^\d+ \d+% \d+%$/);
      expect(resolved.nav.chipSurface).toMatch(/^\d+ \d+% \d+%$/);
      expect(resolved.nav.accent).not.toBe(resolved.palette.primary);
    }

    expect(navAccents.size).toBe(presetPalettes.length);
    expect(navSurfaces.size).toBe(presetPalettes.length);
  });

  test("derives linked shell tokens from a custom accent", async () => {
    const resolved = resolveWorkspaceAppearanceTokens({
      textStyle: "straight",
      navMode: "linked",
      navTone: "default",
      palette: "custom",
      customAccentHex: "#b3471f",
    });

    const customHue = getHue(resolved.palette.primary);
    expect(customHue).toBe(getHue(resolved.nav.accent));
    expect(customHue).toBe(getHue(resolved.nav.surface));
    expect(resolved.nav.accent).not.toBe("185 81% 29%");
  });

  test("keeps manual shell colors stable when the content palette changes", async () => {
    const baseAppearance = {
      textStyle: "straight" as const,
      navMode: "manual" as const,
      navTone: "midnight" as const,
      customAccentHex: DEFAULT_CUSTOM_ACCENT_HEX,
    };

    const oceanResolved = resolveWorkspaceAppearanceTokens({
      ...baseAppearance,
      palette: "ocean",
    });
    const roseResolved = resolveWorkspaceAppearanceTokens({
      ...baseAppearance,
      palette: "rose",
    });

    expect(oceanResolved.nav).toEqual(roseResolved.nav);
    expect(oceanResolved.palette.primary).not.toBe(roseResolved.palette.primary);
  });

  test("migrates legacy stored shell preferences into linked or manual mode", async () => {
    expect(resolveStoredNavMode(null, null)).toBe("linked");
    expect(resolveStoredNavMode("", "default")).toBe("linked");
    expect(resolveStoredNavMode("", "ember")).toBe("manual");
    expect(resolveStoredNavMode("manual", "default")).toBe("manual");
    expect(resolveStoredNavMode("linked", "ember")).toBe("linked");
    expect(resolveStoredNavMode("bogus", "bogus")).toBe("linked");
  });
});
