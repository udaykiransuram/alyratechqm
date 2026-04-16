import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import SummerCrashLookupClient from "@/components/summer-crash/SummerCrashLookupClient";
import { authOptions } from "@/lib/auth";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";
import { SUMMER_CRASH_WELCOME_PATH } from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

export const metadata: Metadata = {
  title: "Find Summer ID | Summer Crash Course",
  description: "Recover the Summer Crash Course student ID with the parent phone number.",
};

export default async function SummerCrashHelpPage() {
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
    redirect(SUMMER_CRASH_WELCOME_PATH);
  }

  return (
    <div className="public-flow-page">
      <div className="public-flow-shell-narrow">
        <SummerCrashLookupClient
          title={config.title}
          supportContact={config.supportContact}
        />
      </div>
    </div>
  );
}
