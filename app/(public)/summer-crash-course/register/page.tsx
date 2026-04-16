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
  description: "Register a student for the free Summer Crash Course.",
};

export default async function SummerCrashRegisterPage() {
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
    <div className="public-flow-page public-register-page">
      <div className="public-flow-shell-narrow">
        <SummerCrashRegistrationClient {...config} />
      </div>
    </div>
  );
}
