import { getSchoolKeyFromCookie } from "@/lib/client/school";

export const TEXT_STYLE_STORAGE_KEY = "app-text-style";
export const NAV_MODE_STORAGE_KEY = "app-nav-mode";
export const NAV_TONE_STORAGE_KEY = "app-nav-tone";
export const WORKSPACE_PALETTE_STORAGE_KEY = "app-workspace-palette";
export const WORKSPACE_CUSTOM_ACCENT_STORAGE_KEY = "app-workspace-custom-accent";
export const WORKSPACE_APPEARANCE_CACHE_STORAGE_KEY = "app-workspace-appearance-cache";
export const WORKSPACE_APPEARANCE_EVENT = "app:workspace-appearance-change";

export const TEXT_STYLE_OPTIONS = [
  {
    value: "straight",
    label: "Standard",
    description: "Balanced spacing and the safest default for everyday workspace use.",
  },
  {
    value: "humanist",
    label: "Soft",
    description: "Softer letterforms that make long admin screens easier to scan.",
  },
  {
    value: "editorial",
    label: "Sharp",
    description: "Tighter, sharper typography with a more polished premium edge.",
  },
  {
    value: "compact",
    label: "Dense",
    description: "Denser spacing for information-heavy tables, filters, and reports.",
  },
  {
    value: "relaxed",
    label: "Airy",
    description: "Looser spacing with a calmer feel and less visual pressure.",
  },
] as const;

export const NAV_MODE_OPTIONS = [
  {
    value: "linked",
    label: "Match the accent color",
    description:
      "Header, sidebar, and shell menus use the same color family as the workspace accent.",
  },
  {
    value: "manual",
    label: "Choose shell separately",
    description:
      "Pick a separate light or dark shell for the header and sidebar.",
  },
] as const;

export const NAV_TONE_OPTIONS = [
  {
    value: "default",
    label: "Ocean",
    description: "Dark teal shell with strong separation from the content area.",
    appearance: "dark",
    surface: "207 56% 19%",
    surfaceStrong: "208 58% 16%",
    border: "206 33% 31%",
    hover: "204 49% 25%",
    accent: "185 81% 29%",
    accentForeground: "0 0% 100%",
    foreground: "210 33% 96%",
    muted: "205 24% 78%",
    chipSurface: "204 36% 26%",
    swatches: ["185 81% 29%", "207 56% 19%", "40 42% 72%"],
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "Dark slate shell with crisp blue accents.",
    appearance: "dark",
    surface: "220 31% 18%",
    surfaceStrong: "223 35% 13%",
    border: "217 23% 31%",
    hover: "216 26% 24%",
    accent: "208 84% 62%",
    accentForeground: "223 35% 12%",
    foreground: "210 30% 96%",
    muted: "214 15% 78%",
    chipSurface: "217 23% 24%",
    swatches: ["208 84% 62%", "221 40% 13%", "214 28% 24%"],
  },
  {
    value: "evergreen",
    label: "Evergreen",
    description: "Deep forest shell with a brighter green action color.",
    appearance: "dark",
    surface: "157 29% 18%",
    surfaceStrong: "160 32% 14%",
    border: "156 18% 31%",
    hover: "157 20% 24%",
    accent: "148 63% 43%",
    accentForeground: "156 34% 12%",
    foreground: "150 25% 96%",
    muted: "150 11% 79%",
    chipSurface: "156 22% 24%",
    swatches: ["148 63% 43%", "156 32% 14%", "155 23% 24%"],
  },
  {
    value: "ember",
    label: "Ember",
    description: "Dark clay shell with a warmer copper accent.",
    appearance: "dark",
    surface: "18 30% 18%",
    surfaceStrong: "18 35% 14%",
    border: "18 24% 31%",
    hover: "18 25% 24%",
    accent: "24 82% 56%",
    accentForeground: "18 35% 12%",
    foreground: "28 30% 96%",
    muted: "28 14% 80%",
    chipSurface: "18 22% 24%",
    swatches: ["24 82% 56%", "20 36% 15%", "18 28% 25%"],
  },
  {
    value: "graphite",
    label: "Graphite",
    description: "Neutral charcoal shell with a quieter silver-blue accent.",
    appearance: "dark",
    surface: "220 16% 18%",
    surfaceStrong: "222 18% 14%",
    border: "218 10% 31%",
    hover: "220 11% 24%",
    accent: "214 24% 62%",
    accentForeground: "220 18% 12%",
    foreground: "210 24% 96%",
    muted: "214 10% 78%",
    chipSurface: "218 12% 24%",
    swatches: ["214 24% 62%", "220 18% 14%", "218 14% 24%"],
  },
  {
    value: "mist",
    label: "Mist",
    description: "Bright cool shell with soft blue-gray surfaces.",
    appearance: "light",
    surface: "214 35% 96%",
    surfaceStrong: "214 28% 92%",
    border: "214 24% 82%",
    hover: "214 30% 89%",
    accent: "214 74% 44%",
    accentForeground: "0 0% 100%",
    foreground: "220 27% 17%",
    muted: "217 14% 44%",
    chipSurface: "0 0% 100%",
    swatches: ["214 74% 44%", "214 35% 96%", "214 28% 92%"],
  },
  {
    value: "linen",
    label: "Linen",
    description: "Warm ivory shell with softer amber highlights.",
    appearance: "light",
    surface: "38 44% 96%",
    surfaceStrong: "37 36% 92%",
    border: "35 26% 82%",
    hover: "37 34% 88%",
    accent: "28 76% 44%",
    accentForeground: "0 0% 100%",
    foreground: "24 31% 20%",
    muted: "25 14% 45%",
    chipSurface: "0 0% 100%",
    swatches: ["28 76% 44%", "38 44% 96%", "37 36% 92%"],
  },
  {
    value: "sage",
    label: "Sage",
    description: "Light green shell with a calm academic feel.",
    appearance: "light",
    surface: "150 28% 96%",
    surfaceStrong: "150 21% 92%",
    border: "150 15% 81%",
    hover: "149 24% 88%",
    accent: "151 56% 35%",
    accentForeground: "0 0% 100%",
    foreground: "160 26% 18%",
    muted: "158 10% 43%",
    chipSurface: "0 0% 100%",
    swatches: ["151 56% 35%", "150 28% 96%", "150 21% 92%"],
  },
] as const;

export const WORKSPACE_PALETTE_OPTIONS = [
  {
    value: "ocean",
    label: "Teal",
    description: "Balanced teal for buttons, selection states, focus rings, and soft page tints.",
    primary: "185 81% 29%",
    primaryForeground: "0 0% 100%",
    accent: "198 31% 94%",
    accentForeground: "208 35% 22%",
    surfaceTint: "198 31% 94%",
    surfaceTintStrong: "204 22% 87%",
    swatches: ["185 81% 29%", "191 72% 43%", "40 42% 72%"],
  },
  {
    value: "sapphire",
    label: "Blue",
    description: "Crisp blue for a cleaner, classic operations feel.",
    primary: "217 79% 45%",
    primaryForeground: "0 0% 100%",
    accent: "218 58% 95%",
    accentForeground: "208 35% 22%",
    surfaceTint: "219 47% 94%",
    surfaceTintStrong: "217 35% 87%",
    swatches: ["217 79% 45%", "214 78% 58%", "217 42% 87%"],
  },
  {
    value: "evergreen",
    label: "Emerald",
    description: "Calm green accents with a softer academic feel.",
    primary: "149 63% 38%",
    primaryForeground: "0 0% 100%",
    accent: "145 29% 94%",
    accentForeground: "208 35% 22%",
    surfaceTint: "146 30% 94%",
    surfaceTintStrong: "148 22% 87%",
    swatches: ["149 63% 38%", "149 50% 50%", "145 28% 88%"],
  },
  {
    value: "amber",
    label: "Amber",
    description: "Warmer amber accents that still keep strong contrast.",
    primary: "31 88% 46%",
    primaryForeground: "0 0% 100%",
    accent: "37 42% 93%",
    accentForeground: "208 35% 22%",
    surfaceTint: "38 44% 93%",
    surfaceTintStrong: "37 36% 86%",
    swatches: ["31 88% 46%", "35 92% 58%", "37 52% 86%"],
  },
  {
    value: "rose",
    label: "Rose",
    description: "Rose-red accents for a more assertive workspace tone.",
    primary: "350 72% 52%",
    primaryForeground: "0 0% 100%",
    accent: "350 42% 94%",
    accentForeground: "208 35% 22%",
    surfaceTint: "349 34% 94%",
    surfaceTintStrong: "348 28% 87%",
    swatches: ["350 72% 52%", "344 78% 63%", "345 45% 89%"],
  },
  {
    value: "slate",
    label: "Slate",
    description: "Neutral slate accents for a quieter, steadier palette.",
    primary: "221 33% 32%",
    primaryForeground: "0 0% 100%",
    accent: "220 19% 94%",
    accentForeground: "208 35% 22%",
    surfaceTint: "218 24% 94%",
    surfaceTintStrong: "218 19% 87%",
    swatches: ["221 33% 32%", "218 28% 46%", "218 26% 87%"],
  },
  {
    value: "graphite",
    label: "Graphite",
    description: "Low-saturation graphite accents for the quietest neutral workspace.",
    primary: "220 16% 28%",
    primaryForeground: "0 0% 100%",
    accent: "220 12% 94%",
    accentForeground: "208 35% 22%",
    surfaceTint: "219 14% 94%",
    surfaceTintStrong: "219 12% 87%",
    swatches: ["220 16% 28%", "217 14% 42%", "218 14% 86%"],
  },
  {
    value: "custom",
    label: "Custom",
    description: "Pick your own accent color while keeping the rest of the workspace stable.",
    primary: "185 81% 29%",
    primaryForeground: "0 0% 100%",
    accent: "198 31% 94%",
    accentForeground: "208 35% 22%",
    surfaceTint: "198 31% 94%",
    surfaceTintStrong: "204 22% 87%",
    swatches: ["185 81% 29%", "191 72% 43%", "40 42% 72%"],
  },
] as const;

export type AppTextStyle = (typeof TEXT_STYLE_OPTIONS)[number]["value"];
export type AppNavMode = (typeof NAV_MODE_OPTIONS)[number]["value"];
export type AppNavTone = (typeof NAV_TONE_OPTIONS)[number]["value"];
export type AppPalette = (typeof WORKSPACE_PALETTE_OPTIONS)[number]["value"];

export type WorkspaceAppearanceState = {
  textStyle: AppTextStyle;
  navMode: AppNavMode;
  navTone: AppNavTone;
  palette: AppPalette;
  customAccentHex: string;
};

export const DEFAULT_APP_TEXT_STYLE: AppTextStyle = "straight";
export const DEFAULT_APP_NAV_MODE: AppNavMode = "linked";
export const DEFAULT_APP_NAV_TONE: AppNavTone = "default";
export const DEFAULT_APP_PALETTE: AppPalette = "ocean";
export const DEFAULT_CUSTOM_ACCENT_HEX = "#0f7d87";
export const DEFAULT_WORKSPACE_APPEARANCE: WorkspaceAppearanceState = {
  textStyle: DEFAULT_APP_TEXT_STYLE,
  navMode: DEFAULT_APP_NAV_MODE,
  navTone: DEFAULT_APP_NAV_TONE,
  palette: DEFAULT_APP_PALETTE,
  customAccentHex: DEFAULT_CUSTOM_ACCENT_HEX,
};

type BootstrapNavTone = Pick<
  (typeof NAV_TONE_OPTIONS)[number],
  | "value"
  | "surface"
  | "surfaceStrong"
  | "border"
  | "hover"
  | "accent"
  | "accentForeground"
  | "foreground"
  | "muted"
  | "chipSurface"
>;

type BootstrapPalette = Pick<
  (typeof WORKSPACE_PALETTE_OPTIONS)[number],
  | "value"
  | "primary"
  | "primaryForeground"
  | "accent"
  | "accentForeground"
  | "surfaceTint"
  | "surfaceTintStrong"
>;

export type PaletteTokens = {
  primary: string;
  primaryForeground: string;
  ring: string;
  focus: string;
  accent: string;
  accentForeground: string;
  surfaceTint: string;
  surfaceTintStrong: string;
};

export type NavTokens = {
  surface: string;
  surfaceStrong: string;
  border: string;
  hover: string;
  accent: string;
  accentForeground: string;
  foreground: string;
  muted: string;
  chipSurface: string;
};

export type WorkspaceAppearanceTokens = {
  palette: PaletteTokens;
  nav: NavTokens;
};

export function getWorkspaceAppearanceBootstrapScript() {
  const bootstrapData = {
    storageKeys: {
      textStyle: TEXT_STYLE_STORAGE_KEY,
      navMode: NAV_MODE_STORAGE_KEY,
      navTone: NAV_TONE_STORAGE_KEY,
      palette: WORKSPACE_PALETTE_STORAGE_KEY,
      customAccentHex: WORKSPACE_CUSTOM_ACCENT_STORAGE_KEY,
    },
    defaults: {
      textStyle: DEFAULT_APP_TEXT_STYLE,
      navMode: DEFAULT_APP_NAV_MODE,
      navTone: DEFAULT_APP_NAV_TONE,
      palette: DEFAULT_APP_PALETTE,
      customAccentHex: DEFAULT_CUSTOM_ACCENT_HEX,
    },
    textStyles: TEXT_STYLE_OPTIONS.map((option) => option.value),
    navModes: NAV_MODE_OPTIONS.map((option) => option.value),
    navTones: NAV_TONE_OPTIONS.map(
      ({
        value,
        surface,
        surfaceStrong,
        border,
        hover,
        accent,
        accentForeground,
        foreground,
        muted,
        chipSurface,
      }): BootstrapNavTone => ({
        value,
        surface,
        surfaceStrong,
        border,
        hover,
        accent,
        accentForeground,
        foreground,
        muted,
        chipSurface,
      }),
    ),
    palettes: WORKSPACE_PALETTE_OPTIONS.map(
      ({
        value,
        primary,
        primaryForeground,
        accent,
        accentForeground,
        surfaceTint,
        surfaceTintStrong,
      }): BootstrapPalette => ({
        value,
        primary,
        primaryForeground,
        accent,
        accentForeground,
        surfaceTint,
        surfaceTintStrong,
      }),
    ),
  };

  return `(() => {
    try {
      const root = document.documentElement;
      const data = ${JSON.stringify(bootstrapData)};

      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
      const isAllowed = (values, value) => values.includes(value);
      const hslToTriplet = (h, s, l) =>
        \`\${Math.round(h)} \${Math.round(s)}% \${Math.round(l)}%\`;
      const parseTriplet = (triplet) => {
        const [h = "0", s = "0%", l = "0%"] = String(triplet || "")
          .trim()
          .split(/\\s+/);

        return {
          h: Number.parseFloat(h) || 0,
          s: Number.parseFloat(String(s).replace("%", "")) || 0,
          l: Number.parseFloat(String(l).replace("%", "")) || 0,
        };
      };
      const normalizeAccentHex = (value) => {
        const trimmed = String(value || "").trim();
        const withHash = trimmed.startsWith("#") ? trimmed : \`#\${trimmed}\`;
        const normalized =
          withHash.length === 4
            ? \`#\${withHash[1]}\${withHash[1]}\${withHash[2]}\${withHash[2]}\${withHash[3]}\${withHash[3]}\`
            : withHash;

        return /^#[0-9a-fA-F]{6}$/.test(normalized)
          ? normalized.toLowerCase()
          : data.defaults.customAccentHex;
      };
      const hexToRgb = (hex) => {
        const normalized = normalizeAccentHex(hex);
        return {
          r: Number.parseInt(normalized.slice(1, 3), 16),
          g: Number.parseInt(normalized.slice(3, 5), 16),
          b: Number.parseInt(normalized.slice(5, 7), 16),
        };
      };
      const rgbToHsl = (r, g, b) => {
        const red = r / 255;
        const green = g / 255;
        const blue = b / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const delta = max - min;
        const lightness = (max + min) / 2;

        if (delta === 0) {
          return { h: 0, s: 0, l: Math.round(lightness * 100) };
        }

        const saturation =
          lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

        let hue = 0;
        switch (max) {
          case red:
            hue = (green - blue) / delta + (green < blue ? 6 : 0);
            break;
          case green:
            hue = (blue - red) / delta + 2;
            break;
          default:
            hue = (red - green) / delta + 4;
            break;
        }

        return {
          h: Math.round((hue / 6) * 360),
          s: Math.round(saturation * 100),
          l: Math.round(lightness * 100),
        };
      };
      const getForegroundForLightness = (lightness) =>
        lightness >= 60 ? "222 28% 9%" : "0 0% 100%";
      const getPaletteTokens = (palette, customAccentHex) => {
        if (palette === "custom") {
          const normalizedHex = normalizeAccentHex(customAccentHex);
          const { r, g, b } = hexToRgb(normalizedHex);
          const hsl = rgbToHsl(r, g, b);
          const primary = hslToTriplet(hsl.h, hsl.s, hsl.l);

          return {
            primary,
            primaryForeground: getForegroundForLightness(hsl.l),
            ring: primary,
            focus: primary,
            accent: hslToTriplet(
              hsl.h,
              clamp(Math.round(hsl.s * 0.28), 10, 26),
              95,
            ),
            accentForeground: getForegroundForLightness(95),
            surfaceTint: hslToTriplet(
              hsl.h,
              clamp(Math.round(hsl.s * 0.38), 12, 34),
              94,
            ),
            surfaceTintStrong: hslToTriplet(
              hsl.h,
              clamp(Math.round(hsl.s * 0.48), 14, 40),
              88,
            ),
          };
        }

        const option =
          data.palettes.find((entry) => entry.value === palette) || data.palettes[0];

        return {
          primary: option.primary,
          primaryForeground: option.primaryForeground,
          ring: option.primary,
          focus: option.primary,
          accent: option.accent,
          accentForeground: option.accentForeground,
          surfaceTint: option.surfaceTint,
          surfaceTintStrong: option.surfaceTintStrong,
        };
      };
      const getLinkedNavTokens = (primaryTriplet) => {
        const { h, s, l } = parseTriplet(primaryTriplet);
        const accentLightness = clamp(Math.max(l + 10, 42), 38, 62);
        const accentSaturation = clamp(Math.max(s, 34), 24, 78);

        return {
          surface: hslToTriplet(h, clamp(Math.round(s * 0.38), 10, 34), 18),
          surfaceStrong: hslToTriplet(h, clamp(Math.round(s * 0.42), 10, 36), 14),
          border: hslToTriplet(h, clamp(Math.round(s * 0.26), 8, 24), 31),
          hover: hslToTriplet(h, clamp(Math.round(s * 0.34), 10, 28), 24),
          accent: hslToTriplet(h, accentSaturation, accentLightness),
          accentForeground: getForegroundForLightness(accentLightness),
          foreground: hslToTriplet(h, clamp(Math.round(s * 0.18), 8, 24), 96),
          muted: hslToTriplet(h, clamp(Math.round(s * 0.14), 6, 16), 79),
          chipSurface: hslToTriplet(h, clamp(Math.round(s * 0.28), 10, 24), 24),
        };
      };
      const getManualNavTokens = (navTone) => {
        const option =
          data.navTones.find((entry) => entry.value === navTone) || data.navTones[0];

        return {
          surface: option.surface,
          surfaceStrong: option.surfaceStrong,
          border: option.border,
          hover: option.hover,
          accent: option.accent,
          accentForeground: option.accentForeground,
          foreground: option.foreground,
          muted: option.muted,
          chipSurface: option.chipSurface,
        };
      };

      const storedTextStyle =
        window.localStorage.getItem(data.storageKeys.textStyle) || "";
      const storedNavMode =
        window.localStorage.getItem(data.storageKeys.navMode) || "";
      const storedNavTone =
        window.localStorage.getItem(data.storageKeys.navTone) || "";
      const storedPalette =
        window.localStorage.getItem(data.storageKeys.palette) || "";
      const storedCustomAccentHex =
        window.localStorage.getItem(data.storageKeys.customAccentHex) || "";

      const textStyle = isAllowed(data.textStyles, storedTextStyle)
        ? storedTextStyle
        : data.defaults.textStyle;
      const navTone = data.navTones.some((entry) => entry.value === storedNavTone)
        ? storedNavTone
        : data.defaults.navTone;
      const navMode = isAllowed(data.navModes, storedNavMode)
        ? storedNavMode
        : navTone !== data.defaults.navTone
          ? "manual"
          : data.defaults.navMode;
      const palette = data.palettes.some((entry) => entry.value === storedPalette)
        ? storedPalette
        : data.defaults.palette;
      const customAccentHex = normalizeAccentHex(storedCustomAccentHex);

      const paletteTokens = getPaletteTokens(palette, customAccentHex);
      const navTokens =
        navMode === "manual"
          ? getManualNavTokens(navTone)
          : getLinkedNavTokens(paletteTokens.primary);

      if (textStyle === data.defaults.textStyle) {
        root.removeAttribute("data-app-text-style");
      } else {
        root.setAttribute("data-app-text-style", textStyle);
      }

      root.setAttribute("data-app-nav-mode", navMode);

      if (navMode === "manual") {
        root.setAttribute("data-app-nav-tone", navTone);
      } else {
        root.removeAttribute("data-app-nav-tone");
      }

      root.setAttribute("data-app-palette", palette);

      root.style.setProperty("--primary", paletteTokens.primary);
      root.style.setProperty("--primary-foreground", paletteTokens.primaryForeground);
      root.style.setProperty("--ring", paletteTokens.ring);
      root.style.setProperty("--app-focus", paletteTokens.focus);
      root.style.setProperty("--accent", paletteTokens.accent);
      root.style.setProperty(
        "--accent-foreground",
        paletteTokens.accentForeground,
      );
      root.style.setProperty("--app-surface-soft", paletteTokens.surfaceTint);
      root.style.setProperty("--app-surface-tint", paletteTokens.surfaceTint);
      root.style.setProperty(
        "--app-surface-tint-strong",
        paletteTokens.surfaceTintStrong,
      );

      root.style.setProperty("--app-nav-surface", navTokens.surface);
      root.style.setProperty("--app-nav-surface-strong", navTokens.surfaceStrong);
      root.style.setProperty("--app-nav-border", navTokens.border);
      root.style.setProperty("--app-nav-hover", navTokens.hover);
      root.style.setProperty("--app-nav-accent", navTokens.accent);
      root.style.setProperty(
        "--app-nav-accent-foreground",
        navTokens.accentForeground,
      );
      root.style.setProperty("--app-nav-foreground", navTokens.foreground);
      root.style.setProperty("--app-nav-muted", navTokens.muted);
      root.style.setProperty("--app-nav-chip-surface", navTokens.chipSurface);

      if (palette === "custom") {
        root.style.setProperty("--app-custom-primary", paletteTokens.primary);
        root.style.setProperty(
          "--app-custom-primary-foreground",
          paletteTokens.primaryForeground,
        );
        root.style.setProperty("--app-custom-ring", paletteTokens.ring);
        root.style.setProperty("--app-custom-focus", paletteTokens.focus);
      } else {
        root.style.removeProperty("--app-custom-primary");
        root.style.removeProperty("--app-custom-primary-foreground");
        root.style.removeProperty("--app-custom-ring");
        root.style.removeProperty("--app-custom-focus");
      }
    } catch {}
  })();`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseHexChannel(channel: string) {
  return Number.parseInt(channel, 16);
}

export function isAppTextStyle(value: string): value is AppTextStyle {
  return TEXT_STYLE_OPTIONS.some((option) => option.value === value);
}

export function isAppNavMode(value: string): value is AppNavMode {
  return NAV_MODE_OPTIONS.some((option) => option.value === value);
}

export function isAppNavTone(value: string): value is AppNavTone {
  return NAV_TONE_OPTIONS.some((option) => option.value === value);
}

export function isAppPalette(value: string): value is AppPalette {
  return WORKSPACE_PALETTE_OPTIONS.some((option) => option.value === value);
}

export function normalizeAccentHex(value: string) {
  const trimmed = String(value || "").trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const normalized =
    withHash.length === 4
      ? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`
      : withHash;

  return /^#[0-9a-fA-F]{6}$/.test(normalized)
    ? normalized.toLowerCase()
    : DEFAULT_CUSTOM_ACCENT_HEX;
}

function hexToRgb(hex: string) {
  const normalized = normalizeAccentHex(hex);
  return {
    r: parseHexChannel(normalized.slice(1, 3)),
    g: parseHexChannel(normalized.slice(3, 5)),
    b: parseHexChannel(normalized.slice(5, 7)),
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  return {
    h: Math.round((hue / 6) * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
}

function hslToTriplet(h: number, s: number, l: number) {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function parseTriplet(triplet: string) {
  const [h = "0", s = "0%", l = "0%"] = String(triplet).trim().split(/\s+/);
  return {
    h: Number.parseFloat(h) || 0,
    s: Number.parseFloat(s.replace("%", "")) || 0,
    l: Number.parseFloat(l.replace("%", "")) || 0,
  };
}

function shiftTripletLightness(triplet: string, delta: number) {
  const { h, s, l } = parseTriplet(triplet);
  return hslToTriplet(h, s, clamp(l + delta, 8, 92));
}

function getForegroundForLightness(lightness: number) {
  return lightness >= 60 ? "222 28% 9%" : "0 0% 100%";
}

export function getPaletteOption(palette: AppPalette) {
  return (
    WORKSPACE_PALETTE_OPTIONS.find((option) => option.value === palette) ||
    WORKSPACE_PALETTE_OPTIONS[0]
  );
}

export function getTextStyleOption(textStyle: AppTextStyle) {
  return (
    TEXT_STYLE_OPTIONS.find((option) => option.value === textStyle) ||
    TEXT_STYLE_OPTIONS[0]
  );
}

export function getNavModeOption(navMode: AppNavMode) {
  return (
    NAV_MODE_OPTIONS.find((option) => option.value === navMode) ||
    NAV_MODE_OPTIONS[0]
  );
}

export function getNavToneOption(navTone: AppNavTone) {
  return (
    NAV_TONE_OPTIONS.find((option) => option.value === navTone) ||
    NAV_TONE_OPTIONS[0]
  );
}

function getPaletteTokens(
  palette: AppPalette,
  customAccentHex: string,
): PaletteTokens {
  if (palette === "custom") {
    const normalizedHex = normalizeAccentHex(customAccentHex);
    const { r, g, b } = hexToRgb(normalizedHex);
    const hsl = rgbToHsl(r, g, b);
    const primary = hslToTriplet(hsl.h, hsl.s, hsl.l);
    const primaryForeground = getForegroundForLightness(hsl.l);
    const accent = hslToTriplet(
      hsl.h,
      clamp(Math.round(hsl.s * 0.28), 10, 26),
      95,
    );
    const surfaceTint = hslToTriplet(
      hsl.h,
      clamp(Math.round(hsl.s * 0.38), 12, 34),
      94,
    );
    const surfaceTintStrong = hslToTriplet(
      hsl.h,
      clamp(Math.round(hsl.s * 0.48), 14, 40),
      88,
    );

    return {
      primary,
      primaryForeground,
      ring: primary,
      focus: primary,
      accent,
      accentForeground: getForegroundForLightness(95),
      surfaceTint,
      surfaceTintStrong,
    };
  }

  const option = getPaletteOption(palette);
  return {
    primary: option.primary,
    primaryForeground: option.primaryForeground,
    ring: option.primary,
    focus: option.primary,
    accent: option.accent,
    accentForeground: option.accentForeground,
    surfaceTint: option.surfaceTint,
    surfaceTintStrong: option.surfaceTintStrong,
  };
}

function getLinkedNavTokens(primaryTriplet: string): NavTokens {
  const { h, s, l } = parseTriplet(primaryTriplet);
  const accentLightness = clamp(Math.max(l + 10, 42), 38, 62);
  const accentSaturation = clamp(Math.max(s, 34), 24, 78);

  return {
    surface: hslToTriplet(h, clamp(Math.round(s * 0.38), 10, 34), 18),
    surfaceStrong: hslToTriplet(h, clamp(Math.round(s * 0.42), 10, 36), 14),
    border: hslToTriplet(h, clamp(Math.round(s * 0.26), 8, 24), 31),
    hover: hslToTriplet(h, clamp(Math.round(s * 0.34), 10, 28), 24),
    accent: hslToTriplet(h, accentSaturation, accentLightness),
    accentForeground: getForegroundForLightness(accentLightness),
    foreground: hslToTriplet(h, clamp(Math.round(s * 0.18), 8, 24), 96),
    muted: hslToTriplet(h, clamp(Math.round(s * 0.14), 6, 16), 79),
    chipSurface: hslToTriplet(h, clamp(Math.round(s * 0.28), 10, 24), 24),
  };
}

function getManualNavTokens(navTone: AppNavTone): NavTokens {
  const option = getNavToneOption(navTone);

  return {
    surface: option.surface,
    surfaceStrong: option.surfaceStrong,
    border: option.border,
    hover: option.hover,
    accent: option.accent,
    accentForeground: option.accentForeground,
    foreground: option.foreground,
    muted: option.muted,
    chipSurface: option.chipSurface,
  };
}

export function resolveWorkspaceAppearanceTokens(
  appearance: WorkspaceAppearanceState,
): WorkspaceAppearanceTokens {
  const palette = getPaletteTokens(
    appearance.palette,
    normalizeAccentHex(appearance.customAccentHex),
  );
  const nav =
    appearance.navMode === "manual"
      ? getManualNavTokens(appearance.navTone)
      : getLinkedNavTokens(palette.primary);

  return { palette, nav };
}

export function getPaletteSwatches(
  palette: AppPalette,
  customAccentHex: string,
) {
  if (palette !== "custom") {
    return getPaletteOption(palette).swatches;
  }

  const triplet = getPaletteTokens("custom", customAccentHex).primary;
  return [
    shiftTripletLightness(triplet, -8),
    triplet,
    shiftTripletLightness(triplet, 14),
  ];
}

type StoredWorkspaceAppearanceMap = Record<
  string,
  Partial<WorkspaceAppearanceState>
>;

const DEFAULT_WORKSPACE_APPEARANCE_SCOPE = "__default__";

function normalizeAppearanceStorageScope(schoolKey?: string | null) {
  const resolvedSchoolKey = String(
    schoolKey ?? getSchoolKeyFromCookie() ?? "",
  )
    .trim()
    .toLowerCase();

  return resolvedSchoolKey || DEFAULT_WORKSPACE_APPEARANCE_SCOPE;
}

function normalizeStoredWorkspaceAppearance(
  appearance?: Partial<WorkspaceAppearanceState> | null,
): WorkspaceAppearanceState {
  const candidate = appearance || {};
  const textStyle = String(candidate.textStyle || "").trim();
  const navMode = String(candidate.navMode || "").trim();
  const navTone = String(candidate.navTone || "").trim();
  const palette = String(candidate.palette || "").trim();

  return {
    textStyle: isAppTextStyle(textStyle)
      ? textStyle
      : DEFAULT_APP_TEXT_STYLE,
    navMode: isAppNavMode(navMode)
      ? navMode
      : resolveStoredNavMode(undefined, navTone),
    navTone: isAppNavTone(navTone) ? navTone : DEFAULT_APP_NAV_TONE,
    palette: isAppPalette(palette) ? palette : DEFAULT_APP_PALETTE,
    customAccentHex: normalizeAccentHex(
      String(candidate.customAccentHex || ""),
    ),
  };
}

function readLegacyStoredWorkspaceAppearance(): WorkspaceAppearanceState {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE_APPEARANCE;
  }

  try {
    const storedStyle = window.localStorage.getItem(TEXT_STYLE_STORAGE_KEY) || "";
    const storedTone = window.localStorage.getItem(NAV_TONE_STORAGE_KEY) || "";
    const storedMode = window.localStorage.getItem(NAV_MODE_STORAGE_KEY);
    const storedPalette =
      window.localStorage.getItem(WORKSPACE_PALETTE_STORAGE_KEY) || "";
    const storedCustomAccentHex =
      window.localStorage.getItem(WORKSPACE_CUSTOM_ACCENT_STORAGE_KEY) || "";

    return {
      textStyle: isAppTextStyle(storedStyle)
        ? storedStyle
        : DEFAULT_APP_TEXT_STYLE,
      navMode: resolveStoredNavMode(storedMode, storedTone),
      navTone: isAppNavTone(storedTone) ? storedTone : DEFAULT_APP_NAV_TONE,
      palette: isAppPalette(storedPalette) ? storedPalette : DEFAULT_APP_PALETTE,
      customAccentHex: normalizeAccentHex(storedCustomAccentHex),
    };
  } catch {
    return DEFAULT_WORKSPACE_APPEARANCE;
  }
}

function readStoredWorkspaceAppearanceCache(): StoredWorkspaceAppearanceMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(
      WORKSPACE_APPEARANCE_CACHE_STORAGE_KEY,
    );
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as StoredWorkspaceAppearanceMap;
  } catch {
    return {};
  }
}

function writeStoredWorkspaceAppearanceCache(
  entries: StoredWorkspaceAppearanceMap,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    WORKSPACE_APPEARANCE_CACHE_STORAGE_KEY,
    JSON.stringify(entries),
  );
}

function readStoredWorkspaceAppearanceEntry(
  schoolKey?: string | null,
): Partial<WorkspaceAppearanceState> | null {
  if (typeof window === "undefined") {
    return null;
  }

  const entries = readStoredWorkspaceAppearanceCache();
  const scopedEntry = entries[normalizeAppearanceStorageScope(schoolKey)];
  if (scopedEntry && typeof scopedEntry === "object") {
    return scopedEntry;
  }

  return null;
}

function cacheWorkspaceAppearanceLocally(
  appearance: WorkspaceAppearanceState,
  schoolKey?: string | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedAppearance = normalizeStoredWorkspaceAppearance(appearance);
  const entries = readStoredWorkspaceAppearanceCache();
  entries[normalizeAppearanceStorageScope(schoolKey)] = normalizedAppearance;
  writeStoredWorkspaceAppearanceCache(entries);

  // Keep the legacy keys warm so existing sessions still start with the
  // latest-applied appearance while scoped cache rolls out.
  window.localStorage.setItem(TEXT_STYLE_STORAGE_KEY, normalizedAppearance.textStyle);
  window.localStorage.setItem(NAV_MODE_STORAGE_KEY, normalizedAppearance.navMode);
  window.localStorage.setItem(NAV_TONE_STORAGE_KEY, normalizedAppearance.navTone);
  window.localStorage.setItem(
    WORKSPACE_PALETTE_STORAGE_KEY,
    normalizedAppearance.palette,
  );
  window.localStorage.setItem(
    WORKSPACE_CUSTOM_ACCENT_STORAGE_KEY,
    normalizedAppearance.customAccentHex,
  );
}

export function readStoredTextStyle(schoolKey?: string | null): AppTextStyle {
  return readStoredWorkspaceAppearance(schoolKey).textStyle;
}

export function resolveStoredNavMode(
  storedNavMode: string | null | undefined,
  storedNavTone: string | null | undefined,
): AppNavMode {
  if (isAppNavMode(String(storedNavMode || "").trim())) {
    return String(storedNavMode || "").trim() as AppNavMode;
  }

  const normalizedTone = String(storedNavTone || "").trim();
  return isAppNavTone(normalizedTone) && normalizedTone !== DEFAULT_APP_NAV_TONE
    ? "manual"
    : DEFAULT_APP_NAV_MODE;
}

export function readStoredNavMode(schoolKey?: string | null): AppNavMode {
  return readStoredWorkspaceAppearance(schoolKey).navMode;
}

export function readStoredNavTone(schoolKey?: string | null): AppNavTone {
  return readStoredWorkspaceAppearance(schoolKey).navTone;
}

export function readStoredPalette(schoolKey?: string | null): AppPalette {
  return readStoredWorkspaceAppearance(schoolKey).palette;
}

export function readStoredCustomAccentHex(schoolKey?: string | null) {
  return readStoredWorkspaceAppearance(schoolKey).customAccentHex;
}

export function readStoredWorkspaceAppearance(
  schoolKey?: string | null,
): WorkspaceAppearanceState {
  if (typeof window === "undefined") {
    return DEFAULT_WORKSPACE_APPEARANCE;
  }

  const cachedAppearance = readStoredWorkspaceAppearanceEntry(schoolKey);
  if (cachedAppearance) {
    return normalizeStoredWorkspaceAppearance(cachedAppearance);
  }

  return readLegacyStoredWorkspaceAppearance();
}

export function applyWorkspaceAppearanceToDocument(
  appearance: WorkspaceAppearanceState,
) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  const normalizedAppearance = {
    ...appearance,
    customAccentHex: normalizeAccentHex(appearance.customAccentHex),
  };
  const tokens = resolveWorkspaceAppearanceTokens(normalizedAppearance);

  if (normalizedAppearance.textStyle === DEFAULT_APP_TEXT_STYLE) {
    root.removeAttribute("data-app-text-style");
  } else {
    root.setAttribute("data-app-text-style", normalizedAppearance.textStyle);
  }

  root.setAttribute("data-app-nav-mode", normalizedAppearance.navMode);

  if (normalizedAppearance.navMode === "manual") {
    root.setAttribute("data-app-nav-tone", normalizedAppearance.navTone);
  } else {
    root.removeAttribute("data-app-nav-tone");
  }

  root.setAttribute("data-app-palette", normalizedAppearance.palette);

  root.style.setProperty("--primary", tokens.palette.primary);
  root.style.setProperty("--primary-foreground", tokens.palette.primaryForeground);
  root.style.setProperty("--ring", tokens.palette.ring);
  root.style.setProperty("--app-focus", tokens.palette.focus);
  root.style.setProperty("--accent", tokens.palette.accent);
  root.style.setProperty("--accent-foreground", tokens.palette.accentForeground);
  root.style.setProperty("--app-surface-soft", tokens.palette.surfaceTint);
  root.style.setProperty("--app-surface-tint", tokens.palette.surfaceTint);
  root.style.setProperty(
    "--app-surface-tint-strong",
    tokens.palette.surfaceTintStrong,
  );

  root.style.setProperty("--app-nav-surface", tokens.nav.surface);
  root.style.setProperty("--app-nav-surface-strong", tokens.nav.surfaceStrong);
  root.style.setProperty("--app-nav-border", tokens.nav.border);
  root.style.setProperty("--app-nav-hover", tokens.nav.hover);
  root.style.setProperty("--app-nav-accent", tokens.nav.accent);
  root.style.setProperty(
    "--app-nav-accent-foreground",
    tokens.nav.accentForeground,
  );
  root.style.setProperty("--app-nav-foreground", tokens.nav.foreground);
  root.style.setProperty("--app-nav-muted", tokens.nav.muted);
  root.style.setProperty("--app-nav-chip-surface", tokens.nav.chipSurface);

  if (normalizedAppearance.palette === "custom") {
    root.style.setProperty("--app-custom-primary", tokens.palette.primary);
    root.style.setProperty(
      "--app-custom-primary-foreground",
      tokens.palette.primaryForeground,
    );
    root.style.setProperty("--app-custom-ring", tokens.palette.ring);
    root.style.setProperty("--app-custom-focus", tokens.palette.focus);
  } else {
    root.style.removeProperty("--app-custom-primary");
    root.style.removeProperty("--app-custom-primary-foreground");
    root.style.removeProperty("--app-custom-ring");
    root.style.removeProperty("--app-custom-focus");
  }
}

const WORKSPACE_APPEARANCE_ROOT_ATTRIBUTES = [
  "data-app-text-style",
  "data-app-nav-mode",
  "data-app-nav-tone",
  "data-app-palette",
] as const;

const WORKSPACE_APPEARANCE_ROOT_STYLE_PROPERTIES = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--app-focus",
  "--accent",
  "--accent-foreground",
  "--app-surface-soft",
  "--app-surface-tint",
  "--app-surface-tint-strong",
  "--app-nav-surface",
  "--app-nav-surface-strong",
  "--app-nav-border",
  "--app-nav-hover",
  "--app-nav-accent",
  "--app-nav-accent-foreground",
  "--app-nav-foreground",
  "--app-nav-muted",
  "--app-nav-chip-surface",
  "--app-custom-primary",
  "--app-custom-primary-foreground",
  "--app-custom-ring",
  "--app-custom-focus",
] as const;

export function clearWorkspaceAppearanceFromDocument() {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  for (const attributeName of WORKSPACE_APPEARANCE_ROOT_ATTRIBUTES) {
    root.removeAttribute(attributeName);
  }

  for (const propertyName of WORKSPACE_APPEARANCE_ROOT_STYLE_PROPERTIES) {
    root.style.removeProperty(propertyName);
  }
}

export function persistWorkspaceAppearance(
  appearance: WorkspaceAppearanceState,
  schoolKey?: string | null,
) {
  if (typeof window !== "undefined") {
    try {
      cacheWorkspaceAppearanceLocally(appearance, schoolKey);
    } catch {
      // Ignore localStorage quota and serialization errors.
    }
  }

  applyWorkspaceAppearanceToDocument(appearance);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<WorkspaceAppearanceState>(WORKSPACE_APPEARANCE_EVENT, {
        detail: {
          ...appearance,
          customAccentHex: normalizeAccentHex(appearance.customAccentHex),
        },
      }),
    );
  }
}

export function updateWorkspaceAppearance(
  updates: Partial<WorkspaceAppearanceState>,
  schoolKey?: string | null,
) {
  const nextAppearance = {
    ...readStoredWorkspaceAppearance(schoolKey),
    ...updates,
  };

  persistWorkspaceAppearance(nextAppearance, schoolKey);
  return nextAppearance;
}

export function subscribeWorkspaceAppearance(
  callback: (appearance: WorkspaceAppearanceState) => void,
  schoolKey?: string | null,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleAppearanceEvent = (event: Event) => {
    const detail = (event as CustomEvent<WorkspaceAppearanceState>).detail;
    callback(detail || readStoredWorkspaceAppearance());
  };

  const handleStorage = (event: StorageEvent) => {
    if (
      event.key &&
      ![
        WORKSPACE_APPEARANCE_CACHE_STORAGE_KEY,
        TEXT_STYLE_STORAGE_KEY,
        NAV_MODE_STORAGE_KEY,
        NAV_TONE_STORAGE_KEY,
        WORKSPACE_PALETTE_STORAGE_KEY,
        WORKSPACE_CUSTOM_ACCENT_STORAGE_KEY,
      ].includes(event.key)
    ) {
      return;
    }

    callback(readStoredWorkspaceAppearance(schoolKey));
  };

  window.addEventListener(
    WORKSPACE_APPEARANCE_EVENT,
    handleAppearanceEvent as EventListener,
  );
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(
      WORKSPACE_APPEARANCE_EVENT,
      handleAppearanceEvent as EventListener,
    );
    window.removeEventListener("storage", handleStorage);
  };
}
