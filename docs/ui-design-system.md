# UI Design System

This repo now uses a workspace-first calm-premium UI system built around shared tokens, shared primitives, and the existing `app-*` utility layer.

## Core Direction

- Evolve the existing teal brand instead of replacing it.
- Keep the workspace calmer and denser than the public site.
- Prefer cleaner hierarchy, stronger contrast, and fewer decorative gradients.
- Light mode is the primary design target. Dark mode stays supported.

## Token Layer

Global theme tokens live in [app/globals.css](/Users/udaysuram/Downloads/talent-test-registration/app/globals.css).

Important token groups:

- Semantic Tailwind tokens: `--background`, `--foreground`, `--muted`, `--border`, `--primary`, `--accent`, `--destructive`, `--ring`
- Surface tokens: `--app-surface-0` to `--app-surface-3`
- Navigation tokens: `--app-nav-surface`, `--app-nav-border`, `--app-nav-accent`
- Radius scale: `--app-radius-xs` to `--app-radius-xl`
- Spacing scale: `--app-space-1` to `--app-space-8`
- Shadow scale: `--app-shadow-xs` to `--app-shadow-lg`
- State accents: `--app-success`, `--app-warning`, `--app-danger`

When adding new UI, prefer these tokens over raw hex values or page-local one-off colors.

## Shared Primitives

Primary shared primitives live in `components/ui/`.

Preferred usage:

- Buttons: use [components/ui/button.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/button.tsx)
- Inputs and selects: use [components/ui/input.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/input.tsx), [components/ui/textarea.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/textarea.tsx), and [components/ui/select.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/select.tsx)
- Surface primitives: use [components/ui/card.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/card.tsx), [components/ui/table.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/table.tsx), [components/ui/dialog.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/dialog.tsx), and [components/ui/alert-dialog.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/alert-dialog.tsx)
- Status and feedback: use [components/ui/badge.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/badge.tsx) and [components/ui/toast.tsx](/Users/udaysuram/Downloads/talent-test-registration/components/ui/toast.tsx)

Button guidance:

- `primary` or default: main task on the screen
- `secondary` or `outline`: secondary actions and non-destructive support actions
- `ghost` or `plain`: low-emphasis inline controls
- `destructive`: archive/delete/confirm destructive actions
- Sizes: `sm`, `md` or default, `lg`, `xl`, `icon`, `icon-sm`

## `app-*` Utilities

The fastest way to build workspace pages consistently is to compose the existing utility layer.

Most useful patterns:

- Page framing: `.app-page-shell`, `.app-page-hero`, `.app-meta-chip`
- Surfaces: `.app-surface`, `.app-section`, `.app-toolbar`, `.app-table-wrap`
- States: `.app-feedback-*`, `.app-empty-state`, `.app-state-panel-*`
- Workspace feature cards: `.app-spotlight-card`, `.app-inline-stat`, `.app-link-card`, `.app-flow-item`
- Forms: `.app-field-group`, `.app-field-label`, `.app-form-input`, `.app-form-textarea`

If a screen needs a new pattern, add it centrally in `globals.css` instead of creating a page-specific visual dialect.

## Page Composition Rules

- Start workspace pages with `PageHero`.
- Prefer one strong surface hierarchy per page: hero, filter/toolbar, main content.
- Use chips and inline stats sparingly and only when they help scanning.
- Keep dense data views readable with stronger headers, calmer rows, and obvious action hierarchy.
- Public pages can be slightly more expressive, but should still use the same palette, radius language, and button system.

## Avoid

- Raw hex colors inside components
- Mixing multiple unrelated gradients on a single page
- New one-off button styles when shared variants already fit
- Flat gray tables or muddy glass surfaces
- Emoji-based iconography in core navigation
