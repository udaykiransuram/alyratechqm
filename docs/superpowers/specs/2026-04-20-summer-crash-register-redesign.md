# Summer Crash Register Redesign

**Date:** 2026-04-20

**Surface:** `/summer-crash-course/register`

**Goal:** Revamp the Summer Crash Course registration page into a simple, modern, elegant parent-facing signup flow that feels calm and trustworthy without changing the existing registration behavior.

## Approved Direction

- Visual direction: `A. Quiet Premium`
- Tone: warm academic, but closer to a modern parent sign-up flow than a school admission form
- Structure: one elegant form card with minimal extra copy
- Reassurance density: one short reassurance line only
- Fields: keep all current fields visible up front

## Problem Summary

The current register page is functional, but it feels denser than the actual amount of information being collected. The experience is visually broken into three internal step cards inside one larger card, which makes a straightforward form feel longer and more procedural than necessary. The layered gradients, stronger shadows, and multiple internal containers also make the page feel busier than it needs to for a parent-focused sign-up flow.

## Outcome

The redesigned page should feel:

- simpler to scan within the first few seconds
- calmer and more premium
- easier for parents to trust
- modern and polished without looking like a marketing landing page
- lighter on mobile while keeping all current information visible

## Layout

The page remains a single centered registration surface on a soft warm background.

### Page shell

- Keep the existing route and public page wrapper
- Keep the card centered within a narrow public shell
- Use a softer page background with less visual noise than the current version
- Avoid extra hero sections, side panels, or stacked supporting cards

### Main registration card

- Replace the current “card within card within step-card” feel with one cohesive form card
- Keep a small course eyebrow at the top
- Keep a single main heading
- Keep one short reassurance line below the heading
- Keep a quiet “Sign in” path for already registered families

### Form flow

The current fields remain visible and in the same logical order:

1. Student name
2. Class
3. School name (optional)
4. Parent name
5. Phone number
6. Password
7. Confirm password
8. Consent checkbox

The form should read as one continuous flow, using spacing and typographic hierarchy instead of three boxed sections labeled Student, Parent, and Password.

### Responsive layout

- Mobile: fully single-column
- Tablet and desktop: gentle paired layout only where it reduces height without hurting clarity
- Preferred paired rows:
  - Student name + Class
  - Parent name + Phone number
  - Password + Confirm password
- Keep School name full width
- Keep consent and CTA full width

## Content

### Heading

The new heading should feel more parent-facing and polished than the current generic “Create account”.

Recommended heading:

`Create parent account`

### Reassurance line

Keep exactly one short reassurance line under the heading.

It may vary by entry source, but should stay short and calm:

- Diagnostic entry: `Free diagnostic opens right after signup.`
- Direct registration entry: `Use one parent sign-in for the full Summer Crash flow.`

### Secondary actions

- Keep `Sign in` visible near the header for existing families
- Keep support/help visible below the CTA, not competing with the main action
- The help path should remain available via WhatsApp support or the help route, depending on config

## Visual Direction

### Background

- Use a warm off-white / paper-like page background
- Remove heavy or busy public-flow gradients from the register page
- Keep only subtle warmth and a faint tonal wash

### Card

- Use one refined light card
- Softer border
- Gentler shadow
- More breathing room
- Fewer glossy or layered effects

### Typography

- Heading should feel slightly elevated and more refined
- Labels and helper text should remain highly legible and modern
- Avoid heavy uppercase treatment except possibly for a tiny eyebrow label
- Reduce the sense of “UI chrome” and let the page feel more editorial and calm

### Inputs

- Cleaner and flatter than the current gradient-heavy fields
- Maintain strong visible focus states
- Increase vertical breathing room between groups
- Keep the form easy to scan and easy to tap on mobile

### CTA

- One strong warm accent primary button
- Elegant rather than loud
- Supporting copy underneath only if needed
- Help link should remain subtle

## Interaction and Accessibility

- Preserve the current password visibility toggle behavior
- Preserve current submit behavior and redirect logic
- Preserve consent requirement
- Keep visible labels for all inputs
- Improve recoverability when validation fails by making the first invalid field easier to notice
- Keep tap targets comfortable on mobile
- Ensure support and sign-in links remain easy to reach and easy to identify

## Technical Boundaries

This redesign is presentation-focused.

### Must keep unchanged

- route: `/summer-crash-course/register`
- registration API call
- sign-in and redirect behavior
- Summer Crash config loading
- existing field set
- support link behavior
- password toggle behavior

### May change

- JSX structure inside the registration client
- wording for the main heading and short summary copy
- page-level register styling in `app/globals.css`
- class usage and spacing
- local semantics used to support the quieter single-card layout

## Files In Scope

- `components/summer-crash/SummerCrashRegistrationClient.tsx`
- `app/(public)/summer-crash-course/register/page.tsx`
- `app/globals.css`
- `local-tests/tests/e2e/` for a focused regression test covering the new presentation contract

## Testing Expectations

- Page renders cleanly on desktop and mobile
- Required fields remain required
- Consent still blocks submission
- Password show/hide still works
- Header copy and sign-in path remain visible
- Support path remains visible
- The redesigned page still submits into the same flow

## Non-Goals

- No new multi-step wizard
- No new side information panel
- No new modal or onboarding overlay
- No change to backend registration logic
- No expansion of required fields
- No redesign of the Summer Crash landing page in this task
