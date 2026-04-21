# Summer Crash Course Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the full Summer Crash Course experience into a more polished, professional, premium mobile-first flow across public pages and signed-in student summer surfaces without changing behavior.

**Architecture:** Keep all existing Summer Crash routes, business logic, and auth/payment flows intact. Implement the redesign as a presentation-layer pass centered on a shared summer visual system in `app/globals.css`, then apply it in three slices: public landing/payment, public utility flows, and signed-in summer student surfaces. Use focused Playwright UI-contract coverage to guard the route surfaces and their key actions while relying on visual/browser verification for the final polish pass.

**Tech Stack:** Next.js App Router, React, Tailwind utility classes, route-level global CSS in `app/globals.css`, Playwright end-to-end tests

---

### Task 1: Add The Failing Visual-Refinement UI Contract Test

**Files:**
- Create: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`
- Modify: none
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Write the failing public + signed-in UI contract test**

```typescript
/// <reference types="@playwright/test" />
import { expect, test } from "./helpers/strict-browser-test";
import { navigateToAppRoute } from "./helpers/navigation";
import { setStudentSession } from "./helpers/session";

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

test.describe("Summer Crash visual refinement contract", () => {
  test("keeps the public utility flow shells and premium CTAs visible on mobile @mobile", async ({
    page,
  }) => {
    await navigateToAppRoute(page, "/summer-crash-course/register");
    await expect(
      page.getByRole("heading", { name: "Create parent account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i }),
    ).toBeVisible();

    await navigateToAppRoute(page, "/summer-crash-course/signin");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue|sign in/i }).first(),
    ).toBeVisible();

    await navigateToAppRoute(page, "/summer-crash-course/help");
    await expect(
      page.getByRole("heading", { name: "Find your child account" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /find account/i }),
    ).toBeVisible();
  });

  test("keeps the signed-in summer home summary and lesson actions visible @desktop", async ({
    page,
  }) => {
    await setStudentSession(page, {
      schoolKey: "summer-crash",
      schoolDisplayName: "Summer Crash Course",
      id: "111111111111111111111111",
      studentSessionId: "summer-student-session-1",
      studentClassId: "111111111111111111111111",
      studentAcademicSectionId: "222222222222222222222222",
    });

    await navigateToAppRoute(page, "/student/crash-course");
    await expect(
      page.getByRole("heading", { name: "Your Summer Home" }),
    ).toBeVisible();
    await expect(page.getByText("Class Band")).toBeVisible();
    await expect(page.getByText("Course Access")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /numbers & foundations/i }),
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails before the UI changes**

Run:

```bash
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- FAIL because the new signed-in route assertion will not yet match the current UI contract
- FAIL or expose route rendering gaps in at least one of the refined utility shells

- [ ] **Step 3: Keep the failing test in place**

Do not weaken the assertions. This spec is the route-level UI contract for the redesign.

- [ ] **Step 4: Commit the failing test**

```bash
git add local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
git commit -m "test: add summer crash visual refinement contract"
```

---

### Task 2: Establish The Shared Summer Visual System In Global CSS

**Files:**
- Modify: `app/globals.css`
- Modify: `components/InnerHero.tsx`
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Add a dedicated tighter summer token layer in `app/globals.css`**

Add a small summer-specific token cluster near the existing summer/public variables:

```css
:root {
  --summer-premium-ink: 214 46% 12%;
  --summer-premium-teal: 178 74% 28%;
  --summer-premium-teal-strong: 174 78% 34%;
  --summer-premium-mint: 168 46% 95%;
  --summer-premium-warm: 36 42% 95%;
  --summer-premium-border: 170 20% 82%;
  --summer-premium-shadow: 210 42% 12%;
  --summer-premium-radius: 1.4rem;
  --summer-premium-gap: 0.85rem;
  --summer-premium-gap-lg: 1.1rem;
}
```

- [ ] **Step 2: Add the shared summer public-flow shell classes**

Add reusable classes instead of styling each component with one-off values:

```css
.public-summer-shell {
  display: grid;
  gap: var(--summer-premium-gap-lg);
}

.public-summer-flow-surface {
  border-radius: 1.55rem;
  border: 1px solid hsl(var(--summer-premium-border) / 0.68);
  background:
    linear-gradient(
      180deg,
      hsl(var(--public-surface) / 0.985) 0%,
      hsl(var(--summer-premium-mint) / 0.55) 100%
    );
  box-shadow:
    0 24px 48px -40px hsl(var(--summer-premium-shadow) / 0.18),
    inset 0 1px 0 hsl(0 0% 100% / 0.66);
}

.public-summer-flow-stack {
  display: grid;
  gap: 0.85rem;
}

.public-summer-flow-grid {
  display: grid;
  gap: 0.85rem;
}

@media (min-width: 768px) {
  .public-summer-flow-grid-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 3: Retune the summer student-surface classes**

Replace the current looser summer strip/card rhythm with a tighter, more premium version:

```css
.app-summer-crash-hero {
  border-radius: calc(var(--app-radius-xl) + 0.1rem);
  border: 1px solid hsl(var(--border) / 0.6);
  box-shadow:
    0 22px 44px -42px hsl(var(--app-shadow-deep) / 0.22),
    inset 0 1px 0 hsl(var(--app-surface-1) / 0.78);
}

.app-summer-crash-strip {
  gap: 0.65rem;
  padding: 0.9rem 1rem;
}

.app-summer-crash-grid {
  gap: 0.9rem;
}

.app-summer-crash-course-card {
  padding: 0.9rem 1rem;
  border-radius: 1.2rem;
}
```

- [ ] **Step 4: Tighten the shared summer hero spacing in `components/InnerHero.tsx`**

Update the `flagship` and `conversion` variant spacing so the summer landing hero becomes shorter and less floaty on mobile:

```tsx
const heroVariantClasses = {
  flagship: {
    shell: "pt-7 pb-8 sm:pt-9 sm:pb-10 lg:pt-12 lg:pb-12",
    content: "max-w-[52rem]",
    title: "text-[clamp(2rem,4.6vw,3.75rem)]",
    subtitle: "mx-auto max-w-[42rem]",
    actions: "mt-5 flex flex-wrap items-center justify-center gap-3",
  },
  conversion: {
    shell: "pt-7 pb-7 sm:pt-8 sm:pb-8 lg:pt-9 lg:pb-9",
    content: "max-w-[40rem]",
    title: "text-[clamp(1.8rem,3.9vw,2.9rem)]",
    subtitle: "mx-auto max-w-[34rem]",
    actions: "mt-4 flex flex-wrap items-center justify-center gap-2.5",
  },
} as const;
```

- [ ] **Step 5: Run the UI contract test again**

Run:

```bash
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- still FAIL, but only because the page/component-specific redesign tasks are not implemented yet

- [ ] **Step 6: Commit the shared summer-system CSS changes**

```bash
git add app/globals.css components/InnerHero.tsx
git commit -m "feat: add shared summer premium visual system"
```

---

### Task 3: Add A Summer Crash E2E Mock Fixture For Server-Rendered Student Surfaces

**Files:**
- Create: `lib/test-fixtures/summer-crash.ts`
- Modify: `lib/server/summer-crash.ts`
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Create the summer-crash mock fixture helper**

Add a focused fixture file that returns a transport-safe `SummerCrashStudentState`:

```typescript
import type { StudentCourseSummary } from "@/lib/courses/types";
import type { SummerCrashStudentState } from "@/lib/server/summer-crash";

const MOCK_SUMMER_COURSE: StudentCourseSummary = {
  _id: "666666666666666666666666",
  title: "Numbers & Foundations",
  summary: "Repair core number sense before term starts.",
  class: { _id: "111111111111111111111111", name: "Class 7" },
  subjects: [],
  assignedAcademicSections: [],
  status: "in_progress",
  availabilityStatus: "active",
  publishedAt: "2026-04-21T09:00:00.000Z",
  updatedAt: "2026-04-21T09:00:00.000Z",
  blockCount: 6,
  assessmentCount: 1,
  requiredAssessmentCount: 1,
  completedAssessmentCount: 0,
  completionPercent: 42,
  lastViewedBlockId: null,
  metadata: {
    coverImageUrl: undefined,
    coverImageAltText: undefined,
    startsAt: null,
    dueAt: null,
    completionBadgeLabel: undefined,
    enforceSequentialProgress: false,
    allowNotes: true,
    allowBookmarks: true,
    isTemplate: false,
  },
};

export function getMockSummerCrashStudentState(): SummerCrashStudentState {
  return {
    title: "Summer Crash Course",
    supportContact: "9876543210",
    supportHref: "https://wa.me/919876543210",
    studentName: "Aarav",
    guardianName: "Parent One",
    classBand: "Class 7",
    summerId: "SC123456",
    requiresPasswordSetup: false,
    courseAccess: {
      isUnlocked: true,
      requiresPayment: true,
      latestPaymentStatus: "paid",
      price: 4999,
      currency: "INR",
    },
    courses: [MOCK_SUMMER_COURSE],
    destinationHref: "/student/crash-course",
    diagnostic: {
      questionPaperId: "777777777777777777777777",
      title: "Diagnostic Test",
      duration: 45,
      totalMarks: 40,
      status: "submitted",
      launchHref:
        "/student/tests/777777777777777777777777?returnTo=%2Fstudent%2Fcrash-course&mode=diagnostic",
      reportHref:
        "/student/reports/888888888888888888888888?returnTo=%2Fstudent%2Fcrash-course",
      score: 28,
      percent: 70,
      available: true,
    },
  };
}
```

- [ ] **Step 2: Use the mock fixture in `getSummerCrashStudentState`**

Add the same test-mode guard used elsewhere in the codebase:

```typescript
import { getMockSummerCrashStudentState } from "@/lib/test-fixtures/summer-crash";
import { isMockedE2ETestMode } from "@/lib/test-mode";

export async function getSummerCrashStudentState(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement: {
    classId?: string | null;
    academicSectionId?: string | null;
  };
  includeCourses?: boolean;
}) {
  if (isMockedE2ETestMode()) {
    const state = getMockSummerCrashStudentState();
    return params.includeCourses === false
      ? { ...state, courses: [] }
      : state;
  }
```

Place this before the DB work begins so Playwright can render the route without a seeded summer dataset.

- [ ] **Step 3: Run the new visual-refinement spec again**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- public route assertions may still fail
- the signed-in student route should now render instead of failing at the server boundary

- [ ] **Step 4: Commit the mock fixture task**

```bash
git add lib/test-fixtures/summer-crash.ts lib/server/summer-crash.ts
git commit -m "test: add summer crash mock state for e2e"
```

---

### Task 4: Refine The Public Landing And Payment Pages

**Files:**
- Modify: `app/(public)/summer-crash-course/page.tsx`
- Modify: `app/(public)/summer-crash-course/payment/[orderId]/page.tsx`
- Test: `local-tests/tests/e2e/summer-crash-performance.spec.ts`
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Tighten the landing hero composition**

Update the landing page shell so the hero is shorter and proof content moves up sooner on mobile:

```tsx
<main className="public-page public-summer-shell">
  <Suspense fallback={null}>
    <SummerCrashSessionRedirect />
  </Suspense>
  <InnerHero
    title={...}
    subtitle="A simpler Summer maths recovery program that helps families find weak foundations and start the right next step faster."
    pillText="Summer Crash Course"
    variant="flagship"
    lottieLeft="/animations/teacher-classroom.lottie"
    whatsappHref={supportWhatsappHref || undefined}
  >
```

- [ ] **Step 2: Compress the public landing section cadence**

Adjust the section wrappers in `page.tsx` so the first two section blocks use smaller mobile top-padding:

```tsx
<section className="public-section pt-6 md:pt-10">
...
<section className="public-section pt-8 md:pt-12">
```

Keep content order unchanged. This is a density change, not a restructuring.

- [ ] **Step 3: Upgrade the payment status shell**

Retune the payment route to use the new premium flow shell classes:

```tsx
<div className="public-flow-page flex items-center justify-center">
  <div className="public-flow-shell-narrow public-summer-shell">
    <div className="public-flow-surface public-summer-flow-surface mx-auto max-w-xl text-center">
      ...
      <div className="public-flow-card-soft mt-5 space-y-2 text-left sm:text-center">
```

Also make the main heading slightly more compact:

```tsx
<h1 className="text-[clamp(1.95rem,4vw,2.7rem)] font-extrabold tracking-tight text-foreground">
```

- [ ] **Step 4: Run the existing performance guardrail**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-performance.spec.ts
```

Expected:

- PASS
- no new public session fetch regressions introduced by the visual work

- [ ] **Step 5: Run the visual refinement contract**

Run:

```bash
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- public route assertions PASS
- signed-in route assertion may still FAIL until Task 7

- [ ] **Step 6: Commit the landing/payment slice**

```bash
git add 'app/(public)/summer-crash-course/page.tsx' 'app/(public)/summer-crash-course/payment/[orderId]/page.tsx'
git commit -m "feat: refine summer crash landing and payment surfaces"
```

---

### Task 5: Refine Register, Sign-In, And Help Into One Utility Flow Family

**Files:**
- Modify: `components/summer-crash/SummerCrashRegistrationClient.tsx`
- Modify: `components/summer-crash/SummerCrashSignInClient.tsx`
- Modify: `components/summer-crash/SummerCrashLookupClient.tsx`
- Modify: `app/(public)/summer-crash-course/register/page.tsx`
- Modify: `app/(public)/summer-crash-course/signin/page.tsx`
- Modify: `app/(public)/summer-crash-course/help/page.tsx`
- Test: `local-tests/tests/e2e/summer-crash-register-ui.spec.ts`
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Refactor the register page into the denser summer flow shell**

Reshape the registration client markup around one shared shell and tighter grouped rows:

```tsx
return (
  <div className="public-flow-surface public-summer-flow-surface public-summer-register-panel public-summer-flow-stack">
    <div className="public-summer-register-header space-y-3 text-center sm:text-left">
      <div className="public-flow-badge w-fit sm:mx-0 mx-auto">{campaignTitle}</div>
      <h1 className="text-[clamp(2rem,4vw,2.7rem)] font-extrabold tracking-tight text-foreground">
        {pageTitle}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">{pageSummary}</p>
      <p className="text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-text-link">
          Sign in
        </Link>
      </p>
    </div>

    <form className="public-summer-flow-stack" onSubmit={(event) => {
      event.preventDefault();
      handleRegister();
    }}>
      <div className="public-summer-flow-grid public-summer-flow-grid-2">
        {/* studentName + classBand */}
      </div>
      <div className="public-summer-flow-stack">
        {/* sourceSchoolName */}
      </div>
      <div className="public-summer-flow-grid public-summer-flow-grid-2">
        {/* guardianName + phone */}
      </div>
      <div className="public-summer-flow-grid public-summer-flow-grid-2">
        {/* password + confirmPassword */}
      </div>
```

- [ ] **Step 2: Give sign-in the same premium utility shell**

Reorganize the sign-in page around a tighter, clearer sequence: phone lookup first, account selection second, password entry third.

```tsx
return (
  <div className="public-flow-surface public-summer-flow-surface public-summer-flow-stack">
    <div className="space-y-3 text-center">
      <div className="public-flow-badge mx-auto w-fit">{SUMMER_CRASH_DISPLAY_NAME}</div>
      <h1 className="text-[clamp(2rem,4vw,2.7rem)] font-extrabold tracking-tight text-foreground">
        Welcome back
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Use the parent phone number to find the student account, then continue with the password.
      </p>
    </div>
```

Keep lookup behavior unchanged. This is presentation and grouping only.

- [ ] **Step 3: Give help/account recovery the same shared layout and denser result cards**

Update the lookup client to use the same tighter stack and improve result-card scanability:

```tsx
<div className="public-flow-surface public-summer-flow-surface public-summer-flow-stack">
  <div className="space-y-3 text-center">
    <div className="public-flow-badge mx-auto w-fit">Account Recovery</div>
    <h1 className="text-[clamp(2rem,4vw,2.7rem)] font-extrabold tracking-tight text-foreground">
      Find your child account
    </h1>
```

And tighten the result card block:

```tsx
<div key={`${match.summerId}-${match.studentName}`} className="public-flow-card public-summer-flow-stack">
```

- [ ] **Step 4: Keep the route wrappers aligned with the new shells**

Use the narrow wrapper consistently:

```tsx
<div className="public-flow-page">
  <div className="public-flow-shell-narrow public-summer-shell">
    <Suspense fallback={null}>
      <SummerCrashSignInClient ... />
    </Suspense>
  </div>
</div>
```

Apply the same route-wrapper pattern to `register/page.tsx` and `help/page.tsx`.

- [ ] **Step 5: Run the existing register contract test**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts
```

Expected:

- PASS

- [ ] **Step 6: Run the full visual refinement contract**

Run:

```bash
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- public flow assertions PASS
- signed-in student home assertion may still FAIL until Task 7

- [ ] **Step 7: Commit the utility-flow slice**

```bash
git add 'app/(public)/summer-crash-course/register/page.tsx' 'app/(public)/summer-crash-course/signin/page.tsx' 'app/(public)/summer-crash-course/help/page.tsx' components/summer-crash/SummerCrashRegistrationClient.tsx components/summer-crash/SummerCrashSignInClient.tsx components/summer-crash/SummerCrashLookupClient.tsx
git commit -m "feat: unify summer crash utility flow styling"
```

---

### Task 6: Refine The Parent Report And Payment CTA Components

**Files:**
- Modify: `components/summer-crash/SummerCrashDiagnosticParentReport.tsx`
- Modify: `components/summer-crash/SummerCrashPaymentCard.tsx`
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Tighten the parent report opening block**

Refine the top report surfaces so the performance summary becomes stronger and easier to scan:

```tsx
<section className="space-y-4 md:space-y-5">
  <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
    {/* lead narrative + course status */}
  </div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {/* insight cards */}
  </div>
</section>
```

Reduce top-level gap sizes by one step and tighten supporting copy line length.

- [ ] **Step 2: Sharpen the payment CTA component**

Make the CTA stack feel more deliberate:

```tsx
return (
  <div className="space-y-3">
    {errorMessage ? <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice> : null}
    <div className="public-summer-flow-stack">
      <Button
        type="button"
        disabled={isPending || isSdkLoading}
        className="app-button-primary w-full min-h-11"
        onClick={handlePayNow}
      >
```

And keep the retry/status button visually subordinate:

```tsx
<Button
  type="button"
  variant="outline"
  className="w-full border-border/70 bg-background/70"
  onClick={() => window.location.reload()}
>
```

- [ ] **Step 3: Run the visual refinement contract**

Run:

```bash
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- still PASS for the public utility routes
- signed-in student route may still be pending until Task 7

- [ ] **Step 4: Commit the report/payment component pass**

```bash
git add components/summer-crash/SummerCrashDiagnosticParentReport.tsx components/summer-crash/SummerCrashPaymentCard.tsx
git commit -m "feat: refine summer crash report and payment presentation"
```

---

### Task 7: Refine The Signed-In Summer Home And Diagnostic Submitted Pages

**Files:**
- Modify: `app/(student)/student/crash-course/page.tsx`
- Modify: `app/(student)/student/crash-course/diagnostic-submitted/page.tsx`
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Strengthen the signed-in summer hero and summary strip**

Replace the generic hero/strip pairing with a more premium, tighter layout:

```tsx
<PageHero
  className="app-learning-hero app-summer-crash-hero"
  eyebrow="Summer Crash Course"
  title="Your Summer Home"
  variant="overview"
  density="compact"
  description={
    state.courses.length > 0 || state.diagnostic
      ? "Continue from the diagnostic report, summer lessons, and the next best step from one place."
      : "Your summer lessons will appear here as soon as they are assigned."
  }
/>

<div className="app-summer-crash-strip">
  ...
</div>
```

Keep the existing state logic, but tighten the copy and surface hierarchy.

- [ ] **Step 2: Upgrade lesson and locked-payment panels**

Refine the main lesson card and the locked/payment column so the next action is visually obvious:

```tsx
<Card className="app-surface app-summer-crash-panel overflow-hidden">
...
<div className="space-y-3">
  {state.courses.map((course) => (
    <article key={course._id} className="app-summer-crash-course-card">
```

Use one stronger primary action per card and move supporting chips below the course title.

- [ ] **Step 3: Turn diagnostic submitted into a milestone surface**

Keep the same data but make the page feel more intentional:

```tsx
<PageHero
  className="app-learning-hero app-summer-crash-hero"
  eyebrow="Free Diagnostic"
  title="Your child's diagnostic report is ready"
  variant="overview"
  density="compact"
  description="See the weak subskills, weak topics, and the next best step before starting the Summer Crash Course."
/>;
```

Then tighten the two-column body:

```tsx
<div className="app-summer-crash-grid">
  <Card className="app-surface app-summer-crash-panel overflow-hidden">
```

- [ ] **Step 4: Re-run the visual refinement contract**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit the signed-in summer surfaces**

```bash
git add 'app/(student)/student/crash-course/page.tsx' 'app/(student)/student/crash-course/diagnostic-submitted/page.tsx'
git commit -m "feat: refine signed-in summer crash surfaces"
```

---

### Task 8: Final Verification And Browser Review

**Files:**
- Modify: none
- Test: `local-tests/tests/e2e/summer-crash-register-ui.spec.ts`
- Test: `local-tests/tests/e2e/summer-crash-performance.spec.ts`
- Test: `local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts`

- [ ] **Step 1: Run the targeted desktop UI tests**

Run:

```bash
npm run test:e2e:desktop -- local-tests/tests/e2e/summer-crash-register-ui.spec.ts local-tests/tests/e2e/summer-crash-performance.spec.ts local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- PASS

- [ ] **Step 2: Run the targeted mobile UI test**

Run:

```bash
npm run test:e2e:mobile -- local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- PASS

- [ ] **Step 3: Run lint on only the touched files**

Run:

```bash
npx eslint app/globals.css components/InnerHero.tsx 'app/(public)/summer-crash-course/page.tsx' 'app/(public)/summer-crash-course/register/page.tsx' 'app/(public)/summer-crash-course/signin/page.tsx' 'app/(public)/summer-crash-course/help/page.tsx' 'app/(public)/summer-crash-course/payment/[orderId]/page.tsx' 'app/(student)/student/crash-course/page.tsx' 'app/(student)/student/crash-course/diagnostic-submitted/page.tsx' components/summer-crash/SummerCrashRegistrationClient.tsx components/summer-crash/SummerCrashSignInClient.tsx components/summer-crash/SummerCrashLookupClient.tsx components/summer-crash/SummerCrashDiagnosticParentReport.tsx components/summer-crash/SummerCrashPaymentCard.tsx local-tests/tests/e2e/summer-crash-visual-refinement.spec.ts
```

Expected:

- PASS with no new lint errors in touched files

- [ ] **Step 4: Run one production build**

Run:

```bash
npm run build
```

Expected:

- PASS
- no route compilation regressions

- [ ] **Step 5: Do browser verification on the main routes**

Manually verify:

- `/summer-crash-course`
- `/summer-crash-course/register`
- `/summer-crash-course/signin`
- `/summer-crash-course/help`
- `/summer-crash-course/payment/[orderId]` with a valid test fixture
- `/student/crash-course`
- `/student/crash-course/diagnostic-submitted`

Check:

- mobile spacing rhythm feels tighter and more product-like
- CTAs are stronger and easier to identify
- utility pages feel clearly related
- signed-in pages still feel compatible with the student shell

- [ ] **Step 6: Commit the final verification checkpoint**

```bash
git add -A
git commit -m "feat: complete summer crash visual refinement"
```

---

## Self-Review

### Spec coverage

- Visual direction and spacing rhythm: covered by Task 2 and applied in Tasks 4–7
- Public landing, register, sign-in, help, payment, and report surfaces: covered by Tasks 4–6
- Signed-in summer home and diagnostic submitted: covered by Task 7
- Browser and route verification: covered by Task 8

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders
- Each task has concrete files, code shapes, commands, and expected outcomes

### Type consistency

- Route paths and component names match the current codebase
- Playwright helper imports match the existing local test harness
