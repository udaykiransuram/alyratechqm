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
        <section className="public-flow-hero text-center">
          <div className="public-flow-badge mx-auto mb-4 w-fit">
            Limited Summer Seats
          </div>
          <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {config.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            A separate summer-only learning space for students. Families can
            start with the free diagnostic test or register straight for the
            summer lessons without entering the normal school portal.
            {hasPaidCourseAccess
              ? ` The free test stays open, and lessons unlock after payment (${priceLabel}).`
              : " The full summer experience is currently free."}
          </p>

          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
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
          <div className="mt-4">
            <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
              Already registered? Sign In
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="public-flow-stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Class bands
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {config.classBands.length}
            </p>
          </div>
          <div className="public-flow-stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Registration
            </p>
            <p className="mt-2 text-xl font-semibold text-foreground">
              {config.isActive ? "Open now" : "Closed"}
            </p>
          </div>
          <div className="public-flow-stat-card">
            <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Help
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {config.supportContact || "Summer support available"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="public-flow-card space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              What students get
            </h2>
            <ul className="space-y-3 text-sm leading-6 text-muted-foreground">
              <li>Phone-number sign-in with no school picker.</li>
              <li>
                {hasPaidCourseAccess
                  ? `Take the free diagnostic first, then unlock lessons after payment (${priceLabel}).`
                  : "Free access to lessons matched to the selected class band."}
              </li>
              <li>Free diagnostic test with instant-result flow.</li>
              <li>Registration includes password setup for future sign-ins.</li>
              <li>Backup ID is kept only for support and recovery.</li>
            </ul>
          </div>

          <div className="public-flow-card-soft space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              Available class bands
            </h2>
            <div className="flex flex-wrap gap-2">
              {config.classBands.map((band) => (
                <span key={band.classBand} className="public-flow-band">
                  {band.classBand}
                </span>
              ))}
            </div>
            <div className="pt-2">
              <Link href={SUMMER_CRASH_HELP_PATH} className="public-flow-text-link">
                Already registered? Get sign-in help
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
