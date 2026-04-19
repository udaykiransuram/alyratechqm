import type { Metadata } from "next";
import { Suspense } from "react";

import SummerCrashLookupClient from "@/components/summer-crash/SummerCrashLookupClient";
import SummerCrashSessionRedirect from "@/components/summer-crash/SummerCrashSessionRedirect";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";

export const metadata: Metadata = {
  title: "Sign-in Help | Summer Crash Course",
  description: "Find the linked Summer Crash Course student accounts with the parent phone number.",
};

export default async function SummerCrashHelpPage() {
  const config = await getSummerCrashPublicConfig();

  return (
    <div className="public-flow-page">
      <Suspense fallback={null}>
        <SummerCrashSessionRedirect />
      </Suspense>
      <div className="public-flow-shell-narrow">
        <SummerCrashLookupClient
          title={config.title}
          supportContact={config.supportContact}
          supportHref={config.supportHref}
        />
      </div>
    </div>
  );
}
