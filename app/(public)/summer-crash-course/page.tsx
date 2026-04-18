import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";
import {
  SUMMER_CRASH_HELP_PATH,
  SUMMER_CRASH_HOME_PATH,
  SUMMER_CRASH_REGISTER_PATH,
  SUMMER_CRASH_SIGNIN_PATH,
} from "@/lib/summer-crash/constants";
import {
  formatSummerCrashPrice,
  isSummerCrashSession,
} from "@/lib/summer-crash/shared";

export const metadata: Metadata = {
  title: "Summer Crash Course",
  description: "Summer Crash Course registration and student sign-in.",
};

export default async function SummerCrashCourseLandingPage() {
  const [session, config] = await Promise.all([
    getServerSession(authOptions),
    getSummerCrashPublicConfig(),
  ]);

  if (
    session &&
    isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey: session.user.schoolKey,
    })
  ) {
    redirect(SUMMER_CRASH_HOME_PATH);
  }

  const hasPaidCourseAccess = Number(config.price) > 0;
  const priceLabel = formatSummerCrashPrice(config.price, config.currency);

  return (
    <div className="public-flow-page">
      <div className="public-flow-shell">
        <section className="public-flow-hero public-summer-hero">
          <div className="public-summer-hero-grid">
            <div className="space-y-6">
              <div className="public-flow-badge w-fit">Limited Summer Seats</div>
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
                  Summer Crash Course
                </p>
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                  {config.title}
                </h1>
                <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  A focused, summer-only learning space built to fix math
                  foundations fast. Families can start with the free diagnostic
                  test or register straight for the lessons without entering
                  the regular school portal.
                  {hasPaidCourseAccess
                    ? ` The diagnostic stays open, and lessons unlock after payment (${priceLabel}).`
                    : " The full summer experience is currently free."}
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Link
                  href={`${SUMMER_CRASH_REGISTER_PATH}?entry=diagnostic`}
                  className="public-flow-button-primary inline-flex min-w-[13rem] items-center justify-center"
                >
                  Take Free Diagnostic Test
                </Link>
                <Link
                  href={`${SUMMER_CRASH_REGISTER_PATH}?entry=direct_registration`}
                  className="public-flow-button-secondary inline-flex min-w-[13rem] items-center justify-center"
                >
                  Register for Summer Course
                </Link>
              </div>

              <div>
                <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
                  Already registered? Sign In
                </Link>
              </div>
            </div>

            <div className="public-summer-hero-card">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Program snapshot
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">
                  Built for fast math recovery
                </h2>
              </div>
              <div className="grid gap-4">
                <div className="public-summer-hero-stat">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Class bands
                    </p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {config.classBands.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Registration
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {config.isActive ? "Open now" : "Closed"}
                    </p>
                  </div>
                </div>
                <div className="public-summer-hero-stat">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Price
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {hasPaidCourseAccess ? priceLabel : "Free"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      Support
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {config.supportContact || "Summer support available"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="public-summer-grid">
          <div className="public-flow-card">
            <h2 className="text-2xl font-semibold text-foreground">
              What students get
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Phone-number sign-in with no school picker.</li>
              <li>
                {hasPaidCourseAccess
                  ? `Take the free diagnostic first, then unlock lessons after payment (${priceLabel}).`
                  : "Free access to lessons matched to the selected class band."}
              </li>
              <li>Daily micro-lessons with worked examples and practice.</li>
              <li>Instant-result diagnostic test to pinpoint weak areas.</li>
              <li>Parent-ready progress updates after every session.</li>
            </ul>
          </div>

          <div className="public-flow-card-soft">
            <h2 className="text-2xl font-semibold text-foreground">
              Available class bands
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {config.classBands.map((band) => (
                <span key={band.classBand} className="public-flow-band">
                  {band.classBand}
                </span>
              ))}
            </div>
            <div className="pt-4">
              <Link href={SUMMER_CRASH_HELP_PATH} className="public-flow-text-link">
                Already registered? Get sign-in help
              </Link>
            </div>
          </div>
        </section>

        <section className="public-summer-steps">
          <div className="public-flow-card">
            <h2 className="text-2xl font-semibold text-foreground">How it works</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                "Register with phone number",
                "Take the free diagnostic",
                "Start daily lessons",
              ].map((step, index) => (
                <div key={step} className="public-summer-step">
                  <div className="public-flow-step">{index + 1}</div>
                  <p className="text-sm font-semibold text-foreground">
                    {step}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {index === 0
                      ? "No school portal required. Use a parent phone number."
                      : index === 1
                        ? "Instant results highlight the exact gaps."
                        : "Daily practice + examples to close each gap."}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="public-flow-cta">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                Summer enrollment
              </p>
              <h2 className="text-3xl font-semibold">Ready to start?</h2>
              <p className="text-sm text-white/80">
                Lock the class band, run the diagnostic, and move straight into
                recovery lessons.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`${SUMMER_CRASH_REGISTER_PATH}?entry=diagnostic`}
                className="public-flow-button-primary inline-flex min-w-[13rem] items-center justify-center"
              >
                Start Free Diagnostic
              </Link>
              <Link
                href={`${SUMMER_CRASH_REGISTER_PATH}?entry=direct_registration`}
                className="public-flow-button-secondary inline-flex min-w-[13rem] items-center justify-center"
              >
                Register &amp; Pay
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
