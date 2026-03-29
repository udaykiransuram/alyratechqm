"use client";

import { Sparkles } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import WorkspaceAppearanceControls from "@/components/settings/WorkspaceAppearanceControls";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWorkspaceAppearance } from "@/hooks/useWorkspaceAppearance";
import {
  type AppNavMode,
  type AppNavTone,
  type AppPalette,
  type AppTextStyle,
  getNavToneOption,
  getPaletteOption,
  getPaletteSwatches,
  getTextStyleOption,
  NAV_TONE_OPTIONS,
} from "@/lib/client/workspace-appearance";

const customizationAreas = [
  {
    title: "Accent color",
    description:
      "Changes buttons, selected states, focus rings, and soft page tints.",
  },
  {
    title: "Navigation shell",
    description:
      "Changes the header, sidebar, and shell menus only.",
  },
  {
    title: "Text feel",
    description:
      "Changes typography rhythm and spacing, not page structure.",
  },
  {
    title: "Fixed for clarity",
    description:
      "Success, warning, danger, and data meaning colors stay standard.",
  },
];

const recommendedCombos: Array<{
  id: string;
  title: string;
  description: string;
  palette: AppPalette;
  navMode: AppNavMode;
  navTone: AppNavTone;
  textStyle: AppTextStyle;
}> = [
  {
    id: "balanced-default",
    title: "Balanced default",
    description:
      "A safe school-workspace combination with calm teal highlights and softer reading rhythm.",
    palette: "ocean",
    navMode: "linked",
    navTone: "default",
    textStyle: "humanist",
  },
  {
    id: "light-operations",
    title: "Light operations",
    description:
      "A lighter shell with quieter slate accents when you want the workspace to feel bright and steady.",
    palette: "slate",
    navMode: "manual",
    navTone: "mist",
    textStyle: "straight",
  },
  {
    id: "warm-academic",
    title: "Warm academic",
    description:
      "Warm ivory shell and amber accents for a friendlier academic operations mood.",
    palette: "amber",
    navMode: "manual",
    navTone: "linen",
    textStyle: "relaxed",
  },
  {
    id: "clean-modern",
    title: "Clean modern",
    description:
      "Blue accents with a darker shell for a more software-like, compact admin feel.",
    palette: "sapphire",
    navMode: "manual",
    navTone: "midnight",
    textStyle: "compact",
  },
  {
    id: "soft-academic",
    title: "Soft academic",
    description:
      "Light green shell and emerald accents for a calmer, softer school interface.",
    palette: "evergreen",
    navMode: "manual",
    navTone: "sage",
    textStyle: "humanist",
  },
];

export default function WorkspaceSettingsPageClient() {
  const {
    textStyle,
    navMode,
    navTone,
    palette,
    customAccentHex,
    updateAppearance,
    setTextStyle,
    setNavMode,
    setNavTone,
    setPalette,
    setCustomAccentHex,
    resetAppearance,
  } = useWorkspaceAppearance();

  const activeTextStyle = getTextStyleOption(textStyle);
  const activeNavTone = getNavToneOption(navTone);
  const activePalette = getPaletteOption(palette);
  const paletteSwatches = getPaletteSwatches(palette, customAccentHex);
  const lightShellCount = NAV_TONE_OPTIONS.filter(
    (option) => option.appearance === "light",
  ).length;
  const darkShellCount = NAV_TONE_OPTIONS.filter(
    (option) => option.appearance === "dark",
  ).length;
  const shellSummary =
    navMode === "linked" ? `Matched to ${activePalette.label}` : activeNavTone.label;
  const activePresetId =
    recommendedCombos.find(
      (combo) =>
        combo.palette === palette &&
        combo.navMode === navMode &&
        combo.navTone === navTone &&
        combo.textStyle === textStyle,
    )?.id || null;

  const applyCombination = (comboId: string) => {
    const combo = recommendedCombos.find((entry) => entry.id === comboId);
    if (!combo) {
      return;
    }

    updateAppearance({
      palette: combo.palette,
      navMode: combo.navMode,
      navTone: combo.navTone,
      textStyle: combo.textStyle,
    });
  };

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        variant="operations"
        eyebrow="Workspace Settings"
        title="Appearance that is easy to understand"
        description="Pick an accent color, a navigation shell, and a text feel. These appearance choices are saved for the current school and follow your workspace across devices."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="app-button-page"
              onClick={resetAppearance}
            >
              Reset defaults
            </Button>
            <Button asChild variant="outline" className="app-button-page">
              <AppPrefetchLink href="/workspace">Back to workspace</AppPrefetchLink>
            </Button>
          </>
        }
        meta={
          <>
            <span className="app-meta-chip">Accent, shell, and text separated</span>
            <span className="app-meta-chip">Saved for this school</span>
            <span className="app-meta-chip">Light and dark shell options</span>
            <span className="app-meta-chip">Custom accent supported</span>
            <span className="app-meta-chip">Ready-made combinations included</span>
          </>
        }
        stats={[
          {
            label: "Current accent",
            value: activePalette.label,
            meta: activePalette.description,
          },
          {
            label: "Shell color",
            value: shellSummary,
            meta:
              navMode === "linked"
                ? `Header and sidebar follow the ${activePalette.label} accent family.`
                : activeNavTone.description,
          },
          {
            label: "Text feel",
            value: activeTextStyle.label,
            meta: activeTextStyle.description,
          },
          {
            label: "Manual shell presets",
            value: `${lightShellCount} light + ${darkShellCount} dark`,
            meta: "Choose a brighter shell or a higher-contrast shell without changing the main content area.",
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr),minmax(22rem,0.92fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden border-border/72">
            <CardHeader className="border-b border-border/70 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.56)_100%)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>Live preview</CardTitle>
                  <CardDescription>
                    Accent color, shell color, and text feel are previewed
                    separately here so it is clearer what each control affects.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 rounded-[var(--app-radius-pill)] border border-border/72 bg-[hsl(var(--app-surface-1)/0.94)] px-3 py-2 shadow-[0_14px_26px_-26px_hsl(var(--app-shadow-deep)/0.12)]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Accent
                  </span>
                  <span className="app-nav-tone-swatch-row" aria-hidden="true">
                    {paletteSwatches.map((swatch) => (
                      <span
                        key={`preview-${swatch}`}
                        className="app-nav-tone-swatch"
                        style={{ backgroundColor: `hsl(${swatch})` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-0">
              <div className="grid gap-0 lg:grid-cols-[16.5rem,minmax(0,1fr)]">
                <div className="bg-[linear-gradient(180deg,hsl(var(--app-nav-surface-strong)/0.99)_0%,hsl(var(--app-nav-surface)/0.99)_100%)] p-4 text-[hsl(var(--app-nav-foreground))]">
                  <div className="flex items-center justify-between gap-3 rounded-[var(--app-radius-lg)] border border-[hsl(var(--app-nav-border)/0.82)] bg-[hsl(var(--app-nav-chip-surface)/0.86)] px-3 py-2.5 shadow-[0_16px_28px_-28px_hsl(var(--app-shadow-deep)/0.2)]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[var(--app-radius-md)] bg-[hsl(var(--app-nav-accent))] text-[hsl(var(--app-nav-accent-foreground))] shadow-[0_14px_24px_-22px_hsl(var(--app-shadow-deep)/0.26)]">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.08em] text-[hsl(var(--app-nav-muted))]">
                          Preview shell
                        </p>
                        <p className="text-sm font-semibold text-[hsl(var(--app-nav-foreground))]">
                          {shellSummary}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {["Overview", "Questions", "Students", "Settings"].map(
                      (item) => {
                        const active = item === "Settings";

                        return (
                          <div
                            key={item}
                            className={
                              active
                                ? "rounded-[var(--app-radius-md)] bg-[linear-gradient(180deg,hsl(var(--app-nav-accent))_0%,hsl(var(--app-nav-accent)/0.92)_100%)] px-3 py-2.5 text-sm font-semibold text-[hsl(var(--app-nav-accent-foreground))] shadow-[0_18px_30px_-24px_hsl(var(--app-shadow-deep)/0.24)]"
                                : "rounded-[var(--app-radius-md)] border border-[hsl(var(--app-nav-border)/0.68)] bg-[hsl(var(--app-nav-chip-surface)/0.72)] px-3 py-2.5 text-sm font-medium text-[hsl(var(--app-nav-foreground)/0.84)]"
                            }
                          >
                            {item}
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>

                <div className="space-y-5 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.62)_100%)] p-5 sm:p-6">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="app-meta-chip">Preview content</span>
                      <span className="app-meta-chip">Accent: {activePalette.label}</span>
                      <span className="app-meta-chip">Text: {activeTextStyle.label}</span>
                      <span className="app-meta-chip">
                        Shell: {navMode === "linked" ? "Matched" : activeNavTone.label}
                      </span>
                    </div>
                    <h2 className="app-page-title-lg max-w-2xl">
                      Accent, shell, and typography can now be tuned separately.
                    </h2>
                    <p className="app-page-description max-w-2xl">
                      The workspace stays readable because the meaning colors
                      remain fixed, while the accent, shell, and text rhythm are
                      the parts you can actually personalize.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button size="sm" className="app-button-compact">
                      Create question
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="app-button-compact"
                    >
                      Apply filters
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="app-button-compact"
                    >
                      Back to list
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {customizationAreas.map((module) => (
                      <div
                        key={module.title}
                        className="rounded-[var(--app-radius-lg)] border border-border/74 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.74)_100%)] p-4 shadow-[0_18px_32px_-30px_hsl(var(--app-shadow-deep)/0.12)]"
                      >
                        <p className="app-form-section-title">{module.title}</p>
                        <p className="app-form-section-copy mt-1">
                          {module.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/72">
            <CardHeader>
              <CardTitle>Recommended combinations</CardTitle>
              <CardDescription>
                These combinations are tuned to work well together, including
                lighter shell options so you do not have to guess what matches.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {recommendedCombos.map((combo) => {
                const comboPalette = getPaletteOption(combo.palette);
                const comboTextStyle = getTextStyleOption(combo.textStyle);
                const comboSwatches = getPaletteSwatches(combo.palette, customAccentHex);
                const active = combo.id === activePresetId;

                return (
                  <div
                    key={combo.id}
                    className={`rounded-[var(--app-radius-lg)] border p-4 shadow-[0_14px_26px_-28px_hsl(var(--app-shadow-deep)/0.1)] transition-[border-color,box-shadow,background-color] ${
                      active
                        ? "border-primary/28 bg-[linear-gradient(180deg,hsl(var(--primary)/0.1)_0%,hsl(var(--primary)/0.04)_100%)] shadow-[0_20px_34px_-28px_hsl(var(--primary)/0.18)]"
                        : "border-border/72 bg-[hsl(var(--app-surface-1)/0.94)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {combo.title}
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {combo.description}
                        </p>
                      </div>
                      {active ? (
                        <span className="app-meta-chip">Current combination</span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="app-meta-chip">Accent: {comboPalette.label}</span>
                      <span className="app-meta-chip">
                        Shell:{" "}
                        {combo.navMode === "linked"
                          ? `Matched to ${comboPalette.label}`
                          : getNavToneOption(combo.navTone).label}
                      </span>
                      <span className="app-meta-chip">Text: {comboTextStyle.label}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="app-nav-tone-swatch-row" aria-hidden="true">
                        {comboSwatches.map((swatch) => (
                          <span
                            key={`${combo.id}-${swatch}`}
                            className="app-nav-tone-swatch"
                            style={{ backgroundColor: `hsl(${swatch})` }}
                          />
                        ))}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant={active ? "outline" : "default"}
                        className="app-button-compact"
                        onClick={() => applyCombination(combo.id)}
                      >
                        {active ? "Already applied" : "Use combination"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-[calc(var(--app-header-height)+1.5rem)] xl:self-start">
          <WorkspaceAppearanceControls
            textStyle={textStyle}
            navMode={navMode}
            navTone={navTone}
            palette={palette}
            customAccentHex={customAccentHex}
            onTextStyleChange={setTextStyle}
            onNavModeChange={setNavMode}
            onNavToneChange={setNavTone}
            onPaletteChange={setPalette}
            onCustomAccentChange={setCustomAccentHex}
          />
        </div>
      </div>
    </PageShell>
  );
}
