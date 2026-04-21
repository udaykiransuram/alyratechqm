# Summer Crash Course Visual Refinement

**Date:** 2026-04-21

**Scope:** Summer Crash Course public and signed-in student surfaces

**Primary routes**

- `/summer-crash-course`
- `/summer-crash-course/register`
- `/summer-crash-course/signin`
- `/summer-crash-course/help`
- `/summer-crash-course/payment/[orderId]`
- `/summer-crash-course/welcome`
- `/student/crash-course`
- `/student/crash-course/diagnostic-submitted`

**Supporting components**

- `components/summer-crash/SummerCrashRegistrationClient.tsx`
- `components/summer-crash/SummerCrashSignInClient.tsx`
- `components/summer-crash/SummerCrashLookupClient.tsx`
- `components/summer-crash/SummerCrashDiagnosticParentReport.tsx`
- `components/summer-crash/SummerCrashPaymentCard.tsx`
- `components/InnerHero.tsx`
- `app/globals.css`

## Goal

Refine the full Summer Crash Course experience into a more polished, professional, and premium mobile-first product without changing the underlying product behavior, auth flow, registration logic, payment flow, or student portal shell.

This spec broadens the earlier register-only redesign into one cohesive summer-crash design system that covers public pages, utility flows, parent report surfaces, and signed-in student summer pages.

## Approved Direction

- Overall visual direction: `B. Warm Clinical Premium`
- Spacing rhythm: `A. Tighter Product`
- Signed-in student treatment: `2. Stronger summer identity inside the existing student shell`
- Delivery approach: `2. Cohesive Summer System`

## Desired Outcome

The Summer Crash experience should feel:

- calmer and more trustworthy for parents
- more premium and more intentional
- less generic than the current public-flow styling
- tighter and more product-like on mobile
- consistent across landing, register, sign-in, help, report, payment, and signed-in summer home

The redesign should improve perceived quality and clarity first. It should not introduce new steps, new product behavior, or a more complex flow.

## Problem Summary

The current Summer Crash experience works, but the visual language is uneven across surfaces.

- Public pages feel more marketing-led in some places and more utility-led in others.
- Mobile spacing is occasionally too loose, which makes the hierarchy feel less controlled.
- Sign-in, help, and registration share similar goals but do not yet feel like one tightly designed family.
- Signed-in student summer pages still feel closer to generic portal UI than to a distinct summer product experience.
- Cards, summary strips, and CTA areas do not yet feel strong enough for a premium education product.

## Design Principles

### 1. Trust over trend

This is a parent-facing education flow. It should feel stable, clear, and credible before it feels decorative.

### 2. Tighter mobile rhythm

The mobile experience should use less loose vertical spacing and more deliberate grouping. The visual pace should feel efficient and professional.

### 3. One summer system

Landing, register, sign-in, help, parent report, payment, and student summer home should feel clearly related, even though they serve different purposes.

### 4. Preserve shell familiarity

Signed-in student summer pages should feel upgraded and more special, but they must still sit naturally inside the current student portal shell.

## Visual System

### Color direction

Keep teal as the emotional anchor, but shift it toward a deeper, more controlled premium range.

- Deep teal for hero surfaces and high-trust blocks
- Clear action teal for primary buttons and active states
- Clean white and mint-tinted surfaces for cards and flows
- Soft warm neutrals for parent-facing support moments
- Deep ink for headings, metrics, and report emphasis

The result should feel cleaner and more premium than the current brighter marketing-leaning teal treatment.

### Spacing rhythm

Use a tighter, product-like mobile rhythm.

- Shorter gaps between stacked sections
- More compact hero copy blocks
- Tighter field-to-field spacing in form surfaces
- Stronger CTA grouping
- Less decorative breathing room around routine content

This should feel more deliberate, not cramped.

### Card and surface language

Use one stronger family of surfaces across summer-crash pages.

- Consistent radius family
- Softer but more controlled elevation
- Cleaner borders
- Better surface contrast between hero, summary, and utility content

Avoid over-layered gradients, excessive glassiness, or mixed surface styles.

### Typography

Typography should become more intentional and slightly more restrained.

- Compact, serious headlines
- Cleaner body copy with less airy vertical spread on mobile
- Better numeric emphasis in summary strips and report metrics
- More consistent label/helper/meta hierarchy

## Surface Application

### Public Summer Pages

#### Landing page

The landing page keeps its role as the public top-of-funnel page, but should become more controlled and more mobile-efficient.

- Tighten hero height and reduce unnecessary mobile vertical length
- Bring proof and CTA clusters earlier on mobile
- Keep the page expressive, but reduce decorative space between sections
- Make trust and action hierarchy stronger than ambient styling

#### Register page

The register page should feel like a premium guided utility flow rather than a generic public form.

- Keep the existing route and registration logic
- Use a denser and cleaner shell
- Strengthen form grouping and CTA clarity
- Keep support and sign-in paths visible but subordinate

#### Sign-in and help pages

These should feel like siblings of the register page.

- Use the same summer flow shell language
- Tighten spacing and reduce visual drift
- Emphasize the next action more clearly
- Make lookup and account-selection states easier to scan on mobile

#### Parent report surfaces

The diagnostic parent report remains content-rich, but the presentation should improve.

- Strengthen summary and performance interpretation at the top
- Improve weak-area emphasis
- Clarify the “what next” path
- Tighten mobile spacing and card rhythm

### Signed-In Student Summer Pages

#### Student summer home

The student summer home keeps the existing student header and shell, but the summer-specific content inside should feel more distinct and premium.

- Redesign the summer hero area
- Strengthen the summary strip
- Improve lesson card presentation
- Make locked/payment panels feel more considered and less generic
- Clarify the primary next step in the first screenful on mobile

#### Diagnostic submitted page

This should feel like a milestone page rather than a plain status state.

- Stronger value framing
- Better summary hierarchy
- Clearer action path into report, diagnostic continuation, or course unlock

## Component and Styling Scope

### Files in scope

- `app/(public)/summer-crash-course/page.tsx`
- `app/(public)/summer-crash-course/register/page.tsx`
- `app/(public)/summer-crash-course/signin/page.tsx`
- `app/(public)/summer-crash-course/help/page.tsx`
- `app/(public)/summer-crash-course/payment/[orderId]/page.tsx`
- `app/(public)/summer-crash-course/welcome/page.tsx`
- `app/(student)/student/crash-course/page.tsx`
- `app/(student)/student/crash-course/diagnostic-submitted/page.tsx`
- `components/summer-crash/SummerCrashRegistrationClient.tsx`
- `components/summer-crash/SummerCrashSignInClient.tsx`
- `components/summer-crash/SummerCrashLookupClient.tsx`
- `components/summer-crash/SummerCrashDiagnosticParentReport.tsx`
- `components/summer-crash/SummerCrashPaymentCard.tsx`
- `components/InnerHero.tsx`
- `app/globals.css`

### Shared implementation intent

- Establish one tighter summer flow language for form shells
- Retune summer-specific globals and tokens in `app/globals.css`
- Improve CTA hierarchy, chip styling, cards, summary strips, and hero density
- Keep shared summer surfaces visually related across pages

## Error Handling and States

Presentation changes must also cover non-happy states.

- validation errors must remain obvious and easy to recover from
- support/help links must stay easy to find
- loading, pending, locked, and empty states should feel visually related to the new system
- payment retry and pending states should feel deliberate, not visually secondary

## Accessibility and UX Constraints

- Preserve visible labels for inputs
- Keep mobile tap targets comfortable even with tighter spacing
- Preserve support for password visibility toggles
- Preserve readable contrast and focus states
- Keep the hierarchy clear for first-time parents and repeat visitors

## Technical Boundaries

### Must not change

- routes
- registration API behavior
- sign-in behavior
- account lookup behavior
- payment flow behavior
- Summer Crash config loading
- student portal shell architecture
- business logic for diagnostic, course unlock, or reporting

### May change

- JSX structure
- page-level visual composition
- local copy where needed for clarity
- class structure
- summer-specific CSS and token usage
- card, hero, and summary layouts

## Testing Expectations

- verify all summer-crash routes on mobile first, then desktop
- verify CTA hierarchy and spacing on register, sign-in, help, parent report, student home, and diagnostic-submitted pages
- verify error, pending, locked, and support states
- verify signed-in summer surfaces still feel compatible with the existing student shell
- run visual/browser verification across the full summer-crash flow after implementation

## Non-Goals

- no backend flow changes
- no route changes
- no new multi-step wizard
- no student shell replacement
- no new auth flow
- no redesign of unrelated non-summer pages
