import type { Metadata } from "next";
import { Suspense } from "react";

import SummerCrashSignInClient from "@/components/summer-crash/SummerCrashSignInClient";
import SummerCrashSessionRedirect from "@/components/summer-crash/SummerCrashSessionRedirect";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";

export const metadata: Metadata = {
  title: "Sign In | Summer Crash Course",
  description: "Parent phone sign-in for Summer Crash Course students.",
};

export default async function SummerCrashSignInPage() {
  const config = await getSummerCrashPublicConfig();

  return (
    <div className="public-flow-page">
      <Suspense fallback={null}>
        <SummerCrashSessionRedirect nextParamName="next" />
      </Suspense>
      <div className="public-flow-shell-narrow">
        <Suspense fallback={null}>
          <SummerCrashSignInClient
            supportContact={config.supportContact}
            supportHref={config.supportHref}
          />
        </Suspense>
      </div>
    </div>
  );
}
