import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  SUMMER_CRASH_HOME_PATH,
} from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

export const metadata: Metadata = {
  title: "Summer Crash Course",
  description: "Summer Crash Course access.",
};

export default async function SummerCrashWelcomePage() {
  const session = await getServerSession(authOptions);

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

  redirect("/summer-crash-course");
}
