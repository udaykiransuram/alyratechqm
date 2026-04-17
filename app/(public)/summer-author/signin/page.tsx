import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import SummerAuthorSignInClient from "@/components/summer-crash/SummerAuthorSignInClient";
import { authOptions } from "@/lib/auth";
import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import {
  SUMMER_CRASH_DISPLAY_NAME,
  SUMMER_CRASH_PUBLIC_TESTS_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
} from "@/lib/summer-crash/constants";

export const metadata: Metadata = {
  title: "Summer Author Sign In",
  description: "Internal summer-author sign-in for the hidden Summer Crash workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

type SummerAuthorSignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function SummerAuthorSignInPage({
  searchParams,
}: SummerAuthorSignInPageProps) {
  const [session, resolvedSearchParams] = await Promise.all([
    getServerSession(authOptions),
    searchParams,
  ]);
  const callbackUrl =
    getSafeReturnToPath(getSearchParam(resolvedSearchParams?.callbackUrl)) ||
    SUMMER_CRASH_PUBLIC_TESTS_PATH;

  if (
    session?.user?.accountType === "school_user" &&
    (session.user.role === "admin" || session.user.role === "teacher") &&
    String(session.user.schoolKey || "").trim().toLowerCase() ===
      SUMMER_CRASH_SCHOOL_KEY
  ) {
    redirect(callbackUrl);
  }

  return (
    <SummerAuthorSignInClient
      schoolLabel={SUMMER_CRASH_DISPLAY_NAME}
      requestedCallbackUrl={callbackUrl}
      pageError={getSearchParam(resolvedSearchParams?.error)}
    />
  );
}
