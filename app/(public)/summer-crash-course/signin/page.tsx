import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import SummerCrashSignInClient from "@/components/summer-crash/SummerCrashSignInClient";
import { authOptions } from "@/lib/auth";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { SUMMER_CRASH_WELCOME_PATH } from "@/lib/summer-crash/constants";
import {
  buildSummerCrashWelcomeHref,
  isSummerCrashSession,
} from "@/lib/summer-crash/shared";

export const metadata: Metadata = {
  title: "Sign In | Summer Crash Course",
  description: "Phone-first Summer Crash Course student sign-in.",
};

type SummerCrashSignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function SummerCrashSignInPage({
  searchParams,
}: SummerCrashSignInPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([
    getServerSession(authOptions),
    searchParams,
  ]);
  const nextHref = getSafeReturnToPath(getSearchParam(resolvedSearchParams?.next));

  if (
    session &&
    isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey: session.user.schoolKey,
    })
  ) {
    redirect(nextHref ? buildSummerCrashWelcomeHref(nextHref) : SUMMER_CRASH_WELCOME_PATH);
  }

  return (
    <div className="public-flow-page">
      <div className="public-flow-shell-narrow">
        <SummerCrashSignInClient
          phone={getSearchParam(resolvedSearchParams?.phone)}
          summerId={getSearchParam(resolvedSearchParams?.summerId)}
          nextHref={nextHref || ""}
          pageError={getSearchParam(resolvedSearchParams?.error)}
        />
      </div>
    </div>
  );
}
