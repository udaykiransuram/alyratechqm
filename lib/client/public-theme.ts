export const PUBLIC_THEME_STYLE_STORAGE_KEY = "public-site-style";
export const PUBLIC_THEME_PALETTE_STORAGE_KEY = "public-site-palette";
export const PUBLIC_THEME_CHANGE_EVENT = "app-public-theme-change";

export const PUBLIC_THEME_STYLES = [
  {
    value: "cinematic",
    label: "Cinematic",
    description: "High-contrast, luminous, and more dramatic for the flagship homepage.",
  },
  {
    value: "editorial",
    label: "Editorial",
    description: "Calmer, softer, and more premium with cleaner cool neutrals.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Cleaner surfaces, lower effects, and a sharper modern product feel.",
  },
] as const;

export const PUBLIC_THEME_PALETTES = [
  {
    value: "ocean",
    label: "Ocean",
    description: "Teal and cyan with clean slate neutrals.",
    swatches: ["183 71% 42%", "196 86% 66%", "192 78% 68%"],
  },
  {
    value: "midnight",
    label: "Midnight",
    description: "Deep blue with cooler premium contrast.",
    swatches: ["216 82% 58%", "198 92% 70%", "202 86% 72%"],
  },
  {
    value: "evergreen",
    label: "Evergreen",
    description: "Forest-teal tones on cooler academic surfaces.",
    swatches: ["154 58% 40%", "176 64% 58%", "187 70% 66%"],
  },
  {
    value: "ember",
    label: "Ember",
    description: "Copper highlights with cleaner graphite contrast.",
    swatches: ["20 82% 56%", "31 90% 68%", "9 88% 74%"],
  },
] as const;

export type PublicThemeStyle = (typeof PUBLIC_THEME_STYLES)[number]["value"];
export type PublicThemePalette = (typeof PUBLIC_THEME_PALETTES)[number]["value"];

export const DEFAULT_PUBLIC_THEME_STYLE: PublicThemeStyle = "cinematic";
export const DEFAULT_PUBLIC_THEME_PALETTE: PublicThemePalette = "ocean";

export function isPublicThemeStyle(value: string): value is PublicThemeStyle {
  return PUBLIC_THEME_STYLES.some((style) => style.value === value);
}

export function isPublicThemePalette(
  value: string,
): value is PublicThemePalette {
  return PUBLIC_THEME_PALETTES.some((palette) => palette.value === value);
}

export function readStoredPublicThemeStyle(): PublicThemeStyle {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_THEME_STYLE;

  try {
    const storedValue =
      window.localStorage.getItem(PUBLIC_THEME_STYLE_STORAGE_KEY) || "";
    return isPublicThemeStyle(storedValue)
      ? storedValue
      : DEFAULT_PUBLIC_THEME_STYLE;
  } catch {
    return DEFAULT_PUBLIC_THEME_STYLE;
  }
}

export function readStoredPublicThemePalette(): PublicThemePalette {
  if (typeof window === "undefined") return DEFAULT_PUBLIC_THEME_PALETTE;

  try {
    const storedValue =
      window.localStorage.getItem(PUBLIC_THEME_PALETTE_STORAGE_KEY) || "";
    return isPublicThemePalette(storedValue)
      ? storedValue
      : DEFAULT_PUBLIC_THEME_PALETTE;
  } catch {
    return DEFAULT_PUBLIC_THEME_PALETTE;
  }
}

export function applyPublicThemeToElement(
  element: HTMLElement,
  style: PublicThemeStyle,
  palette: PublicThemePalette,
) {
  element.setAttribute("data-public-style", style);
  element.setAttribute("data-public-palette", palette);
}

export function clearPublicThemeFromElement(element: HTMLElement) {
  element.removeAttribute("data-public-style");
  element.removeAttribute("data-public-palette");
}

export function persistPublicThemeSelection(
  style: PublicThemeStyle,
  palette: PublicThemePalette,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PUBLIC_THEME_STYLE_STORAGE_KEY, style);
    window.localStorage.setItem(PUBLIC_THEME_PALETTE_STORAGE_KEY, palette);
  } catch {
    // Ignore storage errors and keep the in-memory selection.
  }
}

export function notifyPublicThemeChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PUBLIC_THEME_CHANGE_EVENT));
}

export function resolveStoredPublicTheme() {
  return {
    style: readStoredPublicThemeStyle(),
    palette: readStoredPublicThemePalette(),
  };
}
