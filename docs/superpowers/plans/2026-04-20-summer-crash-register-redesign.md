# Summer Crash Register Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Summer Crash register page into a quiet-premium, single-card parent sign-up flow without changing the underlying registration logic.

**Architecture:** Keep the existing route and API flow intact, but simplify the register component markup into one continuous form surface and retune the Summer Crash public page styling in `app/globals.css`. Guard the presentation contract with one focused browser test that checks the calmer parent-facing copy and visible registration actions.

**Tech Stack:** Next.js App Router, React, Tailwind utility classes plus global CSS tokens, Playwright end-to-end tests

---

### Task 1: Add The Failing Register Page Presentation Test

**Files:**
- Create: `local-tests/tests/e2e/summer-crash-register-ui.spec.ts`
- Modify: none
- Test: `local-tests/tests/e2e/summer-crash-register-ui.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";

test.describe("Summer Crash register page @desktop", () => {
  test("renders the calmer parent-facing signup shell", async ({ page }) => {
    await navigateToAppRoute(page, "/summer-crash-course/register");

    await expect(
      page.getByRole("heading", { name: "Create parent account" }),
    ).toBeVisible();
    await expect(
      page.getByText("Use one parent sign-in for the full Summer Crash flow."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Student name")).toBeVisible();
    await expect(page.getByLabel("Class")).toBeVisible();
    await expect(page.getByLabel(/School name/i)).toBeVisible();
    await expect(page.getByLabel("Parent name")).toBeVisible();
    await expect(page.getByLabel("Phone number")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByLabel("Confirm password")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts
```

Expected:

- FAIL because the page still renders the old `Create account` heading and current summary copy

- [ ] **Step 3: Confirm the failure is correct**

Expected failure shape:

```text
Expected heading "Create parent account" to be visible
Received: page contains "Create account"
```

- [ ] **Step 4: Keep the failing spec in place**

Do not weaken the expectations. The new copy is part of the redesigned parent-facing experience.

---

### Task 2: Refactor The Register Component Into One Continuous Form Surface

**Files:**
- Modify: `components/summer-crash/SummerCrashRegistrationClient.tsx`
- Test: `local-tests/tests/e2e/summer-crash-register-ui.spec.ts`

- [ ] **Step 1: Update the page copy for the quieter parent-facing flow**

Change the direct-registration copy from the generic account wording to the approved design language.

Target values:

```typescript
const pageTitle = isDiagnosticEntry
  ? "Register & start test"
  : "Create parent account";

const pageSummary = isDiagnosticEntry
  ? "Free diagnostic opens right after signup."
  : "Use one parent sign-in for the full Summer Crash flow.";
```

- [ ] **Step 2: Replace the three boxed sections with one continuous form layout**

Remove the three internal `section` wrappers that each contain a numbered step badge.

Replace them with one shared form body that keeps the same fields but groups them through spacing only:

```tsx
<div className="public-summer-register-form">
  <div className="public-summer-register-row public-summer-register-row-paired">
    {/* Student name + Class */}
  </div>

  <div className="public-summer-register-row">
    {/* School name */}
  </div>

  <div className="public-summer-register-row public-summer-register-row-paired">
    {/* Parent name + Phone */}
  </div>

  <div className="public-summer-register-row public-summer-register-row-paired">
    {/* Password + Confirm password */}
  </div>
</div>
```

- [ ] **Step 3: Keep all current behavior intact while refactoring**

Preserve:

```tsx
onSubmit={(event) => {
  event.preventDefault();
  handleRegister();
}}
```

Preserve the same:

- field state
- password toggle
- consent checkbox
- submit button behavior
- support/help link behavior

- [ ] **Step 4: Quiet the header area**

Keep the top area simple:

```tsx
<div className="public-summer-register-header">
  <div className="space-y-2">
    <p className="public-summer-register-eyebrow">{campaignTitle}</p>
    <h1 className="public-summer-register-title">{pageTitle}</h1>
    <p className="public-summer-register-summary">{pageSummary}</p>
  </div>
  <div className="public-summer-register-signin">
    Already registered? <Link ...>Sign in</Link>
  </div>
</div>
```

- [ ] **Step 5: Keep the CTA block minimal**

Retain one primary action and one quiet help path:

```tsx
<div className="public-summer-register-submit">
  <Button type="submit" ...>
    {isPending ? "Creating account..." : submitLabel}
  </Button>
  {/* quiet help/link area below */}
</div>
```

- [ ] **Step 6: Run the focused test**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts
```

Expected:

- PASS

---

### Task 3: Retune The Register Page Styling For Quiet Premium

**Files:**
- Modify: `app/globals.css`
- Possibly modify: `app/(public)/summer-crash-course/register/page.tsx`
- Test: `local-tests/tests/e2e/summer-crash-register-ui.spec.ts`

- [ ] **Step 1: Soften the register page background**

Reduce the current layered public gradients for the Summer Crash register route and move to a warmer paper-like wash:

```css
.public-summer-register-page {
  background:
    linear-gradient(180deg, hsl(var(--public-surface)) 0%, hsl(var(--public-bg)) 100%);
}
```

Keep only subtle warmth. Avoid heavy radial accents.

- [ ] **Step 2: Simplify the main register card**

Refine:

```css
.public-flow-surface.public-summer-register-panel {
  border-radius: 1.5rem;
  border-color: hsl(var(--public-border) / 0.68);
  background: hsl(var(--public-surface) / 0.985);
  box-shadow:
    0 22px 40px -34px hsl(var(--public-shadow) / 0.12),
    0 1px 2px hsl(var(--public-shadow) / 0.04);
}
```

Reduce chrome, gloss, and extra depth.

- [ ] **Step 3: Add dedicated register-form layout classes**

Introduce lightweight layout helpers:

```css
.public-summer-register-form {
  display: grid;
  gap: 1rem;
}

.public-summer-register-row {
  display: grid;
  gap: 0.85rem;
}

.public-summer-register-row-paired {
  grid-template-columns: 1fr;
}

@media (min-width: 768px) {
  .public-summer-register-row-paired {
    grid-template-columns: 1fr 1fr;
  }
}
```

- [ ] **Step 4: Calm the field styling**

Adjust the register page field styling to be flatter and cleaner than the current glossy treatment:

```css
.public-summer-register-panel .public-flow-input {
  min-height: 2.95rem;
  background: hsl(var(--public-surface) / 0.98);
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.72);
}
```

Keep a visible focus state, but remove the more dramatic lifted feel.

- [ ] **Step 5: Refine typography and CTA tone**

Add dedicated classes for the new header language:

```css
.public-summer-register-title { /* quieter, more premium heading */ }
.public-summer-register-summary { /* one short supporting line */ }
.public-summer-register-eyebrow { /* tiny course label */ }
.public-summer-register-signin { /* quiet secondary action */ }
```

Retain one warm accent CTA using the existing Summer/public token family.

- [ ] **Step 6: Run the focused test again**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts
```

Expected:

- PASS

---

### Task 4: Verify Mobile And Regression Safety

**Files:**
- Modify if needed: `components/summer-crash/SummerCrashRegistrationClient.tsx`
- Modify if needed: `app/globals.css`
- Test: `local-tests/tests/e2e/summer-crash-register-ui.spec.ts`

- [ ] **Step 1: Run the new test on mobile**

Run:

```bash
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts
```

Expected:

- PASS

- [ ] **Step 2: Spot-check a related smoke suite**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/auth-smoke.spec.ts
```

Expected:

- PASS

- [ ] **Step 3: If mobile spacing is cramped, make only small layout corrections**

Allowed fixes:

```css
@media (max-width: 639px) {
  .public-flow-surface.public-summer-register-panel { padding: 1rem; }
  .public-summer-register-form { gap: 0.9rem; }
}
```

Do not reintroduce multiple internal cards or extra information panels.

- [ ] **Step 4: Final verification sweep**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts
```

Expected:

- PASS

