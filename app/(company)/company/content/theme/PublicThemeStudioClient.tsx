"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Globe,
  Monitor,
  Palette,
  Paintbrush2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  DEFAULT_PUBLIC_THEME_PALETTE,
  DEFAULT_PUBLIC_THEME_STYLE,
  PUBLIC_THEME_PALETTES,
  PUBLIC_THEME_STYLES,
  notifyPublicThemeChange,
  persistPublicThemeSelection,
  resolveStoredPublicTheme,
  type PublicThemePalette,
  type PublicThemeStyle,
} from "@/lib/client/public-theme";
import { cn } from "@/lib/utils";

type ThemeSelection = {
  style: PublicThemeStyle;
  palette: PublicThemePalette;
};

const STYLE_TRAITS: Record<PublicThemeStyle, string[]> = {
  cinematic: ["Deeper glow", "Higher contrast", "Flagship-first"],
  editorial: ["Warmer proof tone", "Softer drama", "Trust-heavy"],
  minimal: ["Sharper surfaces", "Cleaner rhythm", "Lower effects"],
};

const PALETTE_TRAITS: Record<PublicThemePalette, string[]> = {
  ocean: ["Teal-cyan", "Warm ivory", "Current flagship"],
  midnight: ["Deep blue", "Cool light", "Sharper contrast"],
  evergreen: ["Forest teal", "Academic calm", "Grounded warmth"],
  ember: ["Copper clay", "Distinctive tone", "Premium warmth"],
};

function PublicThemePreview({
  style,
  palette,
}: {
  style: PublicThemeStyle;
  palette: PublicThemePalette;
}) {
  const styleMeta = PUBLIC_THEME_STYLES.find((item) => item.value === style);
  const paletteMeta = PUBLIC_THEME_PALETTES.find((item) => item.value === palette);

  return (
    <div
      data-public-theme-root
      data-public-style={style}
      data-public-palette={palette}
      className="public-site-shell overflow-hidden rounded-[calc(var(--app-radius-xl)+0.45rem)]"
    >
      <div className="public-theme-preview-shell relative overflow-hidden px-5 pb-6 pt-5 text-white sm:px-6">
        <div className="home-story-grid absolute inset-0 opacity-40" />
        <div className="home-story-noise absolute inset-0" />

        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="public-brand-mark flex h-10 w-10 items-center justify-center rounded-[1rem] text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-[-0.03em] text-white">
                  Alyra Tech
                </p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/48">
                  {styleMeta?.label} / {paletteMeta?.label}
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <span className="public-story-chip rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/68">
                Home
              </span>
              <span className="public-story-chip rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/68">
                Platform
              </span>
              <span className="public-story-chip rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/68">
                Case Studies
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="public-story-surface-dark rounded-[var(--public-panel-radius)] p-5 sm:p-6">
              <Badge className="public-story-chip px-3 py-1.5 text-white/76">
                Live homepage preview
              </Badge>
              <h3 className="home-display-title mt-5 max-w-[12ch] text-3xl font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[2.8rem]">
                Reveal the hidden thinking patterns.
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/70">
                This preview mirrors the public navbar, hero, proof blocks, and
                footer tone so you can tune the site without leaving the CMS.
              </p>

              <div className="mt-5 flex flex-wrap gap-2.5">
                <div
                  className="inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold text-white shadow-[0_22px_42px_-28px_hsl(var(--public-shadow)/0.4)]"
                  style={{
                    borderColor: "hsl(var(--public-accent-strong) / 0.26)",
                    background:
                      "linear-gradient(135deg, hsl(var(--public-accent-strong)) 0%, hsl(var(--public-accent)) 100%)",
                  }}
                >
                  Request Demo
                </div>
                <div className="public-story-chip inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold text-white/74">
                  Start Baseline Test
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {(STYLE_TRAITS[style] || []).map((trait) => (
                  <span
                    key={`preview-style-${trait}`}
                    className="public-story-chip rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/62"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {["School view", "Class drill-down", "Student action"].map(
                (label, index) => (
                  <div
                    key={label}
                    className="public-story-card rounded-[1.35rem] px-4 py-4"
                  >
                    <div
                      className="mb-3 h-1.5 rounded-full"
                      style={{
                        width: `${70 - index * 12}%`,
                        background:
                          index === 0
                            ? "linear-gradient(90deg, hsl(var(--public-accent-strong)), rgba(255,255,255,0.88))"
                            : index === 1
                              ? "linear-gradient(90deg, hsl(var(--public-accent)), rgba(255,255,255,0.78))"
                              : "linear-gradient(90deg, hsl(var(--public-warm)), rgba(255,255,255,0.72))",
                      }}
                    />
                    <p className="text-[10px] uppercase tracking-[0.22em] text-white/44">
                      Preview state
                    </p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {label}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="public-theme-preview-proof border-t border-[hsl(var(--public-border)/0.24)] px-5 py-5 sm:px-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,0.8fr)]">
          <div>
            <Badge className="border-[hsl(var(--public-border)/0.76)] bg-[hsl(var(--public-surface)/0.86)] px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--public-ink-soft))]">
              Proof chapter
            </Badge>
            <h4 className="home-display-title mt-4 text-2xl font-semibold tracking-[-0.05em] text-[hsl(var(--public-ink))]">
              Dark opening, calmer proof, stronger finish.
            </h4>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[hsl(var(--public-muted))]">
              The palette controls the public shell while the style controls how
              dramatic, warm, or clean the presentation feels.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["Trust", "Clarity", "Action"].map((label, index) => (
                <div
                  key={label}
                  className="home-proof-panel px-4 py-4 text-center"
                >
                  <p className="text-2xl font-semibold tracking-[-0.05em] text-[hsl(var(--public-ink))]">
                    {index === 0 ? "01" : index === 1 ? "02" : "03"}
                  </p>
                  <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--public-muted))]">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="home-final-band overflow-hidden rounded-[calc(var(--public-panel-radius)-0.25rem)] p-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-white/46">
              Final band
            </p>
            <h5 className="home-display-title mt-3 text-2xl font-semibold tracking-[-0.05em] text-white">
              Carry the premium tone into conversion.
            </h5>
            <div className="mt-4 flex flex-wrap gap-2">
              <div
                className="inline-flex min-h-10 items-center rounded-full border px-4 py-2 text-sm font-semibold text-white"
                style={{
                  borderColor: "hsl(var(--public-accent-strong) / 0.26)",
                  background:
                    "linear-gradient(135deg, hsl(var(--public-accent-strong)) 0%, hsl(var(--public-accent)) 100%)",
                }}
              >
                Request Demo
              </div>
              <div className="public-story-chip inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-semibold text-white/72">
                WhatsApp
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicThemeStudioClient() {
  const { toast } = useToast();
  const [savedTheme, setSavedTheme] = useState<ThemeSelection>({
    style: DEFAULT_PUBLIC_THEME_STYLE,
    palette: DEFAULT_PUBLIC_THEME_PALETTE,
  });
  const [draftTheme, setDraftTheme] = useState<ThemeSelection>({
    style: DEFAULT_PUBLIC_THEME_STYLE,
    palette: DEFAULT_PUBLIC_THEME_PALETTE,
  });

  useEffect(() => {
    const storedTheme = resolveStoredPublicTheme();
    setSavedTheme(storedTheme);
    setDraftTheme(storedTheme);
  }, []);

  const styleMeta = useMemo(
    () => PUBLIC_THEME_STYLES.find((item) => item.value === draftTheme.style),
    [draftTheme.style],
  );
  const paletteMeta = useMemo(
    () => PUBLIC_THEME_PALETTES.find((item) => item.value === draftTheme.palette),
    [draftTheme.palette],
  );

  const dirty =
    draftTheme.style !== savedTheme.style ||
    draftTheme.palette !== savedTheme.palette;
  const atDefault =
    draftTheme.style === DEFAULT_PUBLIC_THEME_STYLE &&
    draftTheme.palette === DEFAULT_PUBLIC_THEME_PALETTE;

  const applyTheme = () => {
    persistPublicThemeSelection(draftTheme.style, draftTheme.palette);
    notifyPublicThemeChange();
    setSavedTheme(draftTheme);
    toast({
      title: "Public theme updated",
      description: `${styleMeta?.label || "Selected style"} with ${paletteMeta?.label || "selected palette"} is now live on public routes in this browser.`,
    });
  };

  const resetTheme = () => {
    const defaultTheme = {
      style: DEFAULT_PUBLIC_THEME_STYLE,
      palette: DEFAULT_PUBLIC_THEME_PALETTE,
    } satisfies ThemeSelection;

    setDraftTheme(defaultTheme);
    persistPublicThemeSelection(defaultTheme.style, defaultTheme.palette);
    notifyPublicThemeChange();
    setSavedTheme(defaultTheme);
    toast({
      title: "Theme reset",
      description: "The public site theme has been reset to the Alyra default in this browser.",
    });
  };

  return (
    <div className="company-admin-page">
      <div className="company-admin-banner flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            <Paintbrush2 className="h-4 w-4" />
            Public Theme Studio
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Pick the public-site style direction and palette, preview the result
            live, then apply it to the homepage, navbar, and footer.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={dirty ? "warning" : "success"}>
            {dirty ? "Preview only" : "Live on public routes"}
          </Badge>
          <Badge variant="secondary">Browser-local for now</Badge>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.78fr)_minmax(24rem,1fr)]">
        <div className="space-y-6">
          <section className="company-admin-surface space-y-5">
            <div className="company-admin-header">
              <div className="company-admin-header-block">
                <h2 className="company-admin-title">Choose the overall style</h2>
                <p className="company-admin-description">
                  Style changes the mood and surface treatment. Palette changes
                  the public-site colors inside that system.
                </p>
              </div>
              <Badge variant="secondary">{styleMeta?.label || "Style"}</Badge>
            </div>

            <div className="grid gap-4">
              {PUBLIC_THEME_STYLES.map((style) => {
                const active = draftTheme.style === style.value;

                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() =>
                      setDraftTheme((current) => ({
                        ...current,
                        style: style.value,
                      }))
                    }
                    className={cn(
                      "public-theme-option rounded-[calc(var(--app-radius-lg)+0.2rem)] p-5 text-left",
                      active && "public-theme-option-active",
                    )}
                    aria-pressed={active}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                            {style.label}
                          </p>
                          {active ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                          {style.description}
                        </p>
                      </div>

                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Monitor className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {STYLE_TRAITS[style.value].map((trait) => (
                        <span
                          key={`${style.value}-${trait}`}
                          className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="company-admin-surface space-y-5">
            <div className="company-admin-header">
              <div className="company-admin-header-block">
                <h2 className="company-admin-title">Choose the palette</h2>
                <p className="company-admin-description">
                  Palettes drive the public accent, brand mark, hero glow,
                  proof-surface temperature, and footer finish.
                </p>
              </div>
              <Badge variant="secondary">{paletteMeta?.label || "Palette"}</Badge>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {PUBLIC_THEME_PALETTES.map((palette) => {
                const active = draftTheme.palette === palette.value;

                return (
                  <button
                    key={palette.value}
                    type="button"
                    onClick={() =>
                      setDraftTheme((current) => ({
                        ...current,
                        palette: palette.value,
                      }))
                    }
                    className={cn(
                      "public-theme-option rounded-[calc(var(--app-radius-lg)+0.2rem)] p-5 text-left",
                      active && "public-theme-option-active",
                    )}
                    aria-pressed={active}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                            {palette.label}
                          </p>
                          {active ? (
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {palette.description}
                        </p>
                      </div>

                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Palette className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      {palette.swatches.map((swatch, index) => (
                        <span
                          key={`${palette.value}-${index}`}
                          className="public-theme-swatch h-10 w-10 rounded-full border border-white/40"
                          style={{ backgroundColor: `hsl(${swatch})` }}
                          aria-hidden="true"
                        />
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {PALETTE_TRAITS[palette.value].map((trait) => (
                        <span
                          key={`${palette.value}-${trait}`}
                          className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                        >
                          {trait}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="company-admin-surface space-y-4">
            <div className="company-admin-header">
              <div className="company-admin-header-block">
                <h2 className="company-admin-title">Apply or reset</h2>
                <p className="company-admin-description">
                  Save the selected look to this browser, then open the public
                  site to review the live version in context.
                </p>
              </div>
            </div>

            <div className="company-admin-section">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  <Globe className="mr-1 h-3.5 w-3.5" />
                  {styleMeta?.label || "Style"}
                </Badge>
                <Badge variant="outline">
                  <Palette className="mr-1 h-3.5 w-3.5" />
                  {paletteMeta?.label || "Palette"}
                </Badge>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">
                This first version stores theme choices locally, which is great
                for rapid visual iteration. If you want, we can make it
                company-wide in a later pass by adding a backend-backed setting.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={applyTheme} disabled={!dirty}>
                <Paintbrush2 className="h-4 w-4" />
                Apply To Public Site
              </Button>

              <Button
                variant="outline"
                onClick={() => setDraftTheme(savedTheme)}
                disabled={!dirty}
              >
                Revert Preview
              </Button>

              <Button
                variant="secondary"
                onClick={resetTheme}
                disabled={!dirty && atDefault}
              >
                <RefreshCw className="h-4 w-4" />
                Reset To Default
              </Button>

              <Button asChild variant="outline">
                <Link href="/" target="_blank" rel="noreferrer">
                  Open Homepage
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] self-start">
          <div className="company-admin-surface overflow-hidden p-0">
            <div className="border-b border-border/70 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-[-0.02em] text-foreground">
                    Live preview
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Preview the public shell before applying it.
                  </p>
                </div>
                <Badge variant={dirty ? "warning" : "success"}>
                  {dirty ? "Draft" : "Applied"}
                </Badge>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <PublicThemePreview
                style={draftTheme.style}
                palette={draftTheme.palette}
              />
            </div>
          </div>

          <div className="company-admin-section">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe className="h-4 w-4 text-primary" />
              What updates now
            </div>
            <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
              <li>Homepage hero, proof panels, and final CTA band.</li>
              <li>Public navbar, dropdown shell, mobile sheet, and footer.</li>
              <li>Palette-sensitive brand mark, ambient gradients, and chips.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
