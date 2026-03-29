"use client";

import { type ReactNode, useEffect, useId, useState } from "react";
import { Check, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getNavToneOption,
  getPaletteOption,
  NAV_MODE_OPTIONS,
  NAV_TONE_OPTIONS,
  normalizeAccentHex,
  resolveWorkspaceAppearanceTokens,
  TEXT_STYLE_OPTIONS,
  WORKSPACE_PALETTE_OPTIONS,
  type AppNavMode,
  type AppNavTone,
  type AppPalette,
  type AppTextStyle,
} from "@/lib/client/workspace-appearance";
import { cn } from "@/lib/utils";

type WorkspaceAppearanceControlsProps = {
  textStyle: AppTextStyle;
  navMode: AppNavMode;
  navTone: AppNavTone;
  palette: AppPalette;
  customAccentHex: string;
  onTextStyleChange: (textStyle: AppTextStyle) => void;
  onNavModeChange: (navMode: AppNavMode) => void;
  onNavToneChange: (navTone: AppNavTone) => void;
  onPaletteChange: (palette: AppPalette) => void;
  onCustomAccentChange: (customAccentHex: string) => void;
  onReset?: () => void;
  footer?: ReactNode;
  variant?: "page" | "popover";
  className?: string;
};

function getTextPreviewClasses(textStyle: AppTextStyle) {
  switch (textStyle) {
    case "humanist":
      return "tracking-[0.01em]";
    case "editorial":
      return "tracking-[-0.03em]";
    case "compact":
      return "tracking-[-0.04em]";
    case "relaxed":
      return "tracking-[0.03em]";
    default:
      return "tracking-[0em]";
  }
}

function TextStylePreview({
  textStyle,
  className,
}: {
  textStyle: AppTextStyle;
  className: string;
}) {
  return (
    <span className={cn(className, "overflow-hidden p-2")} aria-hidden="true">
      <span className="flex w-full flex-col gap-1.5">
        <span
          className={cn(
            "text-[11px] font-semibold leading-none text-current",
            getTextPreviewClasses(textStyle),
          )}
        >
          Ag
        </span>
        <span className="h-1.5 w-full rounded-full bg-current/22" />
        <span className="h-1.5 w-4/5 rounded-full bg-current/14" />
      </span>
    </span>
  );
}

function PalettePreview({
  primary,
  accent,
  surfaceTintStrong,
  className,
}: {
  primary: string;
  accent: string;
  surfaceTintStrong: string;
  className: string;
}) {
  return (
    <span className={cn(className, "overflow-hidden p-1.5")} aria-hidden="true">
      <span className="flex h-full w-full flex-col gap-1">
        <span
          className="h-2.5 w-full rounded-full"
          style={{ backgroundColor: `hsl(${primary})` }}
        />
        <span className="grid flex-1 grid-cols-[1.15fr,0.85fr] gap-1">
          <span
            className="rounded-[0.5rem] border border-black/5"
            style={{ backgroundColor: `hsl(${surfaceTintStrong})` }}
          />
          <span
            className="rounded-[0.5rem] border border-black/5"
            style={{ backgroundColor: `hsl(${accent})` }}
          />
        </span>
      </span>
    </span>
  );
}

function ShellPreview({
  surface,
  surfaceStrong,
  border,
  hover,
  accent,
  className,
}: {
  surface: string;
  surfaceStrong: string;
  border: string;
  hover: string;
  accent: string;
  className: string;
}) {
  return (
    <span className={cn(className, "overflow-hidden p-1.5")} aria-hidden="true">
      <span
        className="flex h-full w-full flex-col rounded-[0.7rem] border p-1"
        style={{
          backgroundColor: `hsl(${surface})`,
          borderColor: `hsl(${border})`,
        }}
      >
        <span
          className="h-1.5 w-full rounded-full"
          style={{ backgroundColor: `hsl(${surfaceStrong})` }}
        />
        <span className="mt-1 flex flex-1 flex-col gap-1">
          <span
            className="h-2.5 rounded-[0.45rem]"
            style={{ backgroundColor: `hsl(${accent})` }}
          />
          <span
            className="h-2 rounded-[0.45rem]"
            style={{ backgroundColor: `hsl(${hover})` }}
          />
        </span>
      </span>
    </span>
  );
}

function ScopeCard({
  title,
  items,
  variant,
  tone = "neutral",
}: {
  title: string;
  items: string[];
  variant: "page" | "popover";
  tone?: "neutral" | "accent";
}) {
  const popoverVariant = variant === "popover";

  return (
    <div
      className={cn(
        "rounded-[var(--app-radius-lg)] border p-3",
        popoverVariant
          ? tone === "accent"
            ? "border-[hsl(var(--app-nav-accent)/0.26)] bg-[hsl(var(--app-nav-accent)/0.12)]"
            : "border-[hsl(var(--app-nav-border)/0.7)] bg-[hsl(var(--app-nav-chip-surface)/0.5)]"
          : tone === "accent"
            ? "border-primary/18 bg-[linear-gradient(180deg,hsl(var(--primary)/0.1)_0%,hsl(var(--primary)/0.04)_100%)]"
            : "border-border/70 bg-[hsl(var(--app-surface-1)/0.9)]",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.08em]",
          popoverVariant
            ? tone === "accent"
              ? "text-current"
              : "text-current/70"
            : tone === "accent"
              ? "text-primary"
              : "text-muted-foreground",
        )}
      >
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={`${title}-${item}`}
            className={cn(
              "rounded-[var(--app-radius-pill)] px-2.5 py-1 text-[11px] font-medium",
              popoverVariant
                ? tone === "accent"
                  ? "bg-[hsl(var(--app-nav-accent)/0.16)] text-current"
                  : "bg-[hsl(var(--app-nav-chip-surface)/0.72)] text-current/82"
                : tone === "accent"
                  ? "bg-primary/12 text-primary"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function WorkspaceAppearanceControls({
  textStyle,
  navMode,
  navTone,
  palette,
  customAccentHex,
  onTextStyleChange,
  onNavModeChange,
  onNavToneChange,
  onPaletteChange,
  onCustomAccentChange,
  onReset,
  footer,
  variant = "page",
  className,
}: WorkspaceAppearanceControlsProps) {
  const customAccentInputId = useId();
  const customAccentHexId = useId();
  const [customAccentDraft, setCustomAccentDraft] = useState(customAccentHex);
  const popoverVariant = variant === "popover";
  const activePalette = getPaletteOption(palette);
  const activeNavTone = getNavToneOption(navTone);
  const linkedNavTokens = resolveWorkspaceAppearanceTokens({
    textStyle,
    navMode: "linked",
    navTone,
    palette,
    customAccentHex,
  }).nav;
  const shellTokens =
    navMode === "linked"
      ? linkedNavTokens
      : {
          surface: activeNavTone.surface,
          surfaceStrong: activeNavTone.surfaceStrong,
          border: activeNavTone.border,
          hover: activeNavTone.hover,
          accent: activeNavTone.accent,
          accentForeground: activeNavTone.accentForeground,
          foreground: activeNavTone.foreground,
          muted: activeNavTone.muted,
          chipSurface: activeNavTone.chipSurface,
        };
  const manualNavToneGroups = [
    {
      key: "light",
      title: "Light shell options",
      description:
        "Brighter header and sidebar styles when you want the workspace to stay airy.",
      options: NAV_TONE_OPTIONS.filter((option) => option.appearance === "light"),
    },
    {
      key: "dark",
      title: "Dark shell options",
      description:
        "Higher-contrast navigation when you want stronger separation from the content area.",
      options: NAV_TONE_OPTIONS.filter((option) => option.appearance === "dark"),
    },
  ] as const;

  useEffect(() => {
    setCustomAccentDraft(customAccentHex);
  }, [customAccentHex]);

  const commitCustomAccentDraft = () => {
    const normalizedAccent = normalizeAccentHex(customAccentDraft);
    setCustomAccentDraft(normalizedAccent);
    onCustomAccentChange(normalizedAccent);
  };

  const sectionClassName = popoverVariant
    ? "app-settings-section"
    : "rounded-[calc(var(--app-radius-xl)+0.1rem)] border border-border/76 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.66)_100%)] p-4 shadow-[0_24px_40px_-36px_hsl(var(--app-shadow-deep)/0.14),inset_0_1px_0_hsl(var(--app-surface-1)/0.8)] sm:p-5";

  const sectionTitleClassName = popoverVariant
    ? "app-settings-section-title"
    : "text-sm font-semibold tracking-[-0.02em] text-foreground";

  const sectionNoteClassName = popoverVariant
    ? "app-settings-section-note"
    : "text-xs leading-5 text-muted-foreground";

  const optionBaseClassName = popoverVariant
    ? "app-settings-option"
    : "flex w-full items-center gap-3 rounded-[var(--app-radius-lg)] border border-border/76 bg-[hsl(var(--app-surface-1)/0.94)] px-3.5 py-3 text-left text-foreground shadow-[0_16px_28px_-28px_hsl(var(--app-shadow-deep)/0.1),inset_0_1px_0_hsl(var(--app-surface-1)/0.86)] transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-primary/20 hover:bg-[hsl(var(--app-surface-2)/0.94)] hover:shadow-[0_18px_30px_-28px_hsl(var(--app-shadow-deep)/0.12)]";

  const optionActiveClassName = popoverVariant
    ? "app-settings-option-active"
    : "border-primary/28 bg-[linear-gradient(180deg,hsl(var(--primary)/0.12)_0%,hsl(var(--primary)/0.06)_100%)] shadow-[0_20px_34px_-28px_hsl(var(--primary)/0.22),inset_0_0_0_1px_hsl(var(--primary)/0.12)]";

  const previewClassName = popoverVariant
    ? "app-settings-option-preview"
    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] border border-border/74 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.99)_0%,hsl(var(--app-surface-2)/0.86)_100%)] text-foreground shadow-[inset_0_1px_0_hsl(var(--app-surface-1)/0.86)]";

  return (
    <div className={cn("space-y-4", className)}>
      <div className={sectionClassName}>
        <div className="app-settings-section-header">
          <p className={sectionTitleClassName}>Text feel</p>
          <p className={sectionNoteClassName}>
            This changes the reading rhythm only: headings, labels, and body
            spacing. Color, layout, and shell styling stay the same.
          </p>
        </div>

        {!popoverVariant ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ScopeCard
              title="This changes"
              items={["headings", "labels", "body spacing"]}
              variant={variant}
              tone="accent"
            />
            <ScopeCard
              title="Stays the same"
              items={["colors", "buttons", "layout width"]}
              variant={variant}
            />
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {TEXT_STYLE_OPTIONS.map((option) => {
            const active = option.value === textStyle;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onTextStyleChange(option.value)}
                className={cn(optionBaseClassName, active && optionActiveClassName)}
              >
                <TextStylePreview
                  textStyle={option.value}
                  className={previewClassName}
                />
                <span className="app-settings-option-meta">
                  <span className="app-settings-option-label">
                    {option.label}
                  </span>
                  <span className={sectionNoteClassName}>{option.description}</span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className={sectionClassName}>
        <div className="app-settings-section-header">
          <p className={sectionTitleClassName}>Accent color</p>
          <p className={sectionNoteClassName}>
            Accent color controls the workspace highlight family: buttons,
            selected states, focus rings, and soft page tints.
          </p>
        </div>

        {!popoverVariant ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ScopeCard
              title="This changes"
              items={["primary buttons", "focus rings", "selected filters", "soft page tint"]}
              variant={variant}
              tone="accent"
            />
            <ScopeCard
              title="Stays standard"
              items={["success", "warning", "danger", "data meaning colors"]}
              variant={variant}
            />
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {WORKSPACE_PALETTE_OPTIONS.map((option) => {
            const active = option.value === palette;
            const previewTokens = resolveWorkspaceAppearanceTokens({
              textStyle,
              navMode: "linked",
              navTone,
              palette: option.value,
              customAccentHex:
                option.value === "custom" ? customAccentDraft : customAccentHex,
            }).palette;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onPaletteChange(option.value)}
                className={cn(optionBaseClassName, active && optionActiveClassName)}
              >
                <PalettePreview
                  primary={previewTokens.primary}
                  accent={previewTokens.accent}
                  surfaceTintStrong={previewTokens.surfaceTintStrong}
                  className={previewClassName}
                />
                <span className="app-settings-option-meta">
                  <span className="app-settings-option-label">
                    {option.label}
                  </span>
                  <span className={sectionNoteClassName}>{option.description}</span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>

        {palette === "custom" ? (
          <div
            className={cn(
              "mt-3 grid gap-3 rounded-[var(--app-radius-lg)] border p-3.5 sm:grid-cols-[minmax(0,11rem),minmax(0,1fr)]",
              popoverVariant
                ? "border-[hsl(var(--app-nav-border)/0.72)] bg-[linear-gradient(180deg,hsl(var(--app-nav-chip-surface)/0.54)_0%,hsl(var(--app-nav-chip-surface)/0.26)_100%)]"
                : "border-border/72 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.72)_100%)]",
            )}
          >
            <div className="app-field-group">
              <Label
                htmlFor={customAccentInputId}
                className={popoverVariant ? "text-[12px] text-current/88" : "app-field-label"}
              >
                Accent picker
              </Label>
              <input
                id={customAccentInputId}
                type="color"
                value={normalizeAccentHex(customAccentDraft)}
                onChange={(event) => {
                  const nextAccent = normalizeAccentHex(event.target.value);
                  setCustomAccentDraft(nextAccent);
                  onCustomAccentChange(nextAccent);
                }}
                className={cn(
                  "h-11 w-full cursor-pointer rounded-[var(--app-radius-md)] border px-1.5 py-1",
                  popoverVariant
                    ? "border-[hsl(var(--app-nav-border)/0.76)] bg-[hsl(var(--app-nav-chip-surface)/0.88)]"
                    : "border-border/76 bg-[hsl(var(--app-surface-1)/0.98)]",
                )}
              />
            </div>

            <div className="app-field-group">
              <Label
                htmlFor={customAccentHexId}
                className={popoverVariant ? "text-[12px] text-current/88" : "app-field-label"}
              >
                Hex value
              </Label>
              <Input
                id={customAccentHexId}
                value={customAccentDraft}
                onChange={(event) => {
                  setCustomAccentDraft(event.target.value);
                }}
                onBlur={commitCustomAccentDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitCustomAccentDraft();
                  }
                }}
                className={cn(
                  "font-mono uppercase",
                  popoverVariant &&
                    "border-[hsl(var(--app-nav-border)/0.76)] bg-transparent text-current",
                )}
                placeholder="#0f7d87"
                spellCheck={false}
              />
              <p
                className={cn(
                  "text-xs leading-5",
                  popoverVariant ? "text-current/70" : "text-muted-foreground",
                )}
              >
                Custom accent only changes the highlight color family. Semantic
                success, warning, and danger colors stay unchanged.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className={sectionClassName}>
        <div className="app-settings-section-header">
          <p className={sectionTitleClassName}>Navigation shell</p>
          <p className={sectionNoteClassName}>
            Navigation shell controls the header, sidebar, and shell menus only.
            Page cards, tables, and form surfaces keep the main workspace styling.
          </p>
        </div>

        {!popoverVariant ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ScopeCard
              title="This changes"
              items={["header", "sidebar", "shell menus"]}
              variant={variant}
              tone="accent"
            />
            <ScopeCard
              title="Stays the same"
              items={["content panels", "tables", "form fields"]}
              variant={variant}
            />
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {NAV_MODE_OPTIONS.map((option) => {
            const active = option.value === navMode;
            const previewTokens =
              option.value === "linked"
                ? linkedNavTokens
                : {
                    surface: activeNavTone.surface,
                    surfaceStrong: activeNavTone.surfaceStrong,
                    border: activeNavTone.border,
                    hover: activeNavTone.hover,
                    accent: activeNavTone.accent,
                    accentForeground: activeNavTone.accentForeground,
                    foreground: activeNavTone.foreground,
                    muted: activeNavTone.muted,
                    chipSurface: activeNavTone.chipSurface,
                  };

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onNavModeChange(option.value)}
                className={cn(optionBaseClassName, active && optionActiveClassName)}
              >
                <ShellPreview
                  surface={previewTokens.surface}
                  surfaceStrong={previewTokens.surfaceStrong}
                  border={previewTokens.border}
                  hover={previewTokens.hover}
                  accent={previewTokens.accent}
                  className={previewClassName}
                />
                <span className="app-settings-option-meta">
                  <span className="app-settings-option-label">
                    {option.label}
                  </span>
                  <span className={sectionNoteClassName}>{option.description}</span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>

        {navMode === "linked" ? (
          <div
            className={cn(
              "mt-3 rounded-[var(--app-radius-lg)] border p-3.5",
              popoverVariant
                ? "border-[hsl(var(--app-nav-border)/0.72)] bg-[linear-gradient(180deg,hsl(var(--app-nav-chip-surface)/0.54)_0%,hsl(var(--app-nav-chip-surface)/0.26)_100%)]"
                : "border-border/72 bg-[linear-gradient(180deg,hsl(var(--app-surface-1)/0.98)_0%,hsl(var(--app-surface-2)/0.72)_100%)]",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[-0.02em] text-current">
                  Shell matched to {activePalette.label}
                </p>
                <p className={sectionNoteClassName}>
                  The header and sidebar follow the current accent family. If
                  you want a brighter shell, switch to “Choose shell
                  separately”.
                </p>
              </div>
              <ShellPreview
                surface={shellTokens.surface}
                surfaceStrong={shellTokens.surfaceStrong}
                border={shellTokens.border}
                hover={shellTokens.hover}
                accent={shellTokens.accent}
                className={cn(previewClassName, "shrink-0")}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {manualNavToneGroups.map((group) =>
              group.options.length > 0 ? (
                <div key={group.key} className="space-y-2">
                  <div className="space-y-1">
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.08em]",
                        popoverVariant ? "text-current/74" : "text-muted-foreground",
                      )}
                    >
                      {group.title}
                    </p>
                    <p className={sectionNoteClassName}>{group.description}</p>
                  </div>

                  <div className="space-y-2">
                    {group.options.map((option) => {
                      const active = option.value === navTone;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => onNavToneChange(option.value)}
                          className={cn(
                            optionBaseClassName,
                            active && optionActiveClassName,
                          )}
                        >
                          <ShellPreview
                            surface={option.surface}
                            surfaceStrong={option.surfaceStrong}
                            border={option.border}
                            hover={option.hover}
                            accent={option.accent}
                            className={previewClassName}
                          />
                          <span className="app-settings-option-meta">
                            <span className="app-settings-option-label">
                              {option.label}
                            </span>
                            <span className={sectionNoteClassName}>
                              {option.description}
                            </span>
                          </span>
                          {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {footer || onReset ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2",
            popoverVariant ? "pt-1" : "pt-2",
          )}
        >
          {onReset ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                popoverVariant ? "app-button-compact" : "app-action-button",
              )}
              onClick={onReset}
            >
              <Palette className="h-4 w-4" />
              Reset defaults
            </Button>
          ) : null}
          {footer}
        </div>
      ) : null}
    </div>
  );
}
