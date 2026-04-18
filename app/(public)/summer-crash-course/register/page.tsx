import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import SummerCrashRegistrationClient from "@/components/summer-crash/SummerCrashRegistrationClient";
import { authOptions } from "@/lib/auth";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";
import { SUMMER_CRASH_WELCOME_PATH } from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

export const metadata: Metadata = {
  title: "Register | Summer Crash Course",
  description:
    "Register a student for the Summer Crash Course and the free diagnostic flow.",
};

type SummerCrashRegisterPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function SummerCrashRegisterPage({
  searchParams,
}: SummerCrashRegisterPageProps) {
  const [session, config, resolvedSearchParams] = await Promise.all([
    getServerSession(authOptions),
    getSummerCrashPublicConfig(),
    searchParams,
  ]);

  if (
    session &&
    isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey: session.user.schoolKey,
    })
  ) {
    redirect(SUMMER_CRASH_WELCOME_PATH);
  }

  const entrySource =
    getSearchParam(resolvedSearchParams?.entry) === "diagnostic"
      ? "diagnostic"
      : "direct_registration";

  return (
    <div className="public-flow-page public-register-page">
      <div className="public-flow-shell-narrow">
        <SummerCrashRegistrationClient
          {...config}
          entrySource={entrySource}
        />
      </div>
    </div>
  );
}
