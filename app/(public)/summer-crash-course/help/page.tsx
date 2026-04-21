import type { Metadata } from "next";
import { Suspense } from "react";

import SummerCrashLookupClient from "@/components/summer-crash/SummerCrashLookupClient";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";
import { redirectSummerCrashPublicSession } from "@/lib/server/summer-crash-session";

export const metadata: Metadata = {
  title: "Find Account | Summer Crash Course",
  description:
    "Find the linked Summer Crash Course student accounts with the parent phone number.",
};

export default async function SummerCrashHelpPage() {
  await redirectSummerCrashPublicSession();

  const config = await getSummerCrashPublicConfig();

  return (
    <div className="public-flow-page">
      <div className="public-flow-shell-narrow public-summer-shell">
        <Suspense fallback={null}>
          <SummerCrashLookupClient
            campaignTitle={config.title}
            supportContact={config.supportContact}
            supportHref={config.supportHref}
          />
        </Suspense>
      </div>
    </div>
  );
}
