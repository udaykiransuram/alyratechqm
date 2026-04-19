import type { Metadata } from "next";
import { Suspense } from "react";

import SummerCrashRegistrationClient from "@/components/summer-crash/SummerCrashRegistrationClient";
import SummerCrashSessionRedirect from "@/components/summer-crash/SummerCrashSessionRedirect";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";

export const metadata: Metadata = {
  title: "Register | Summer Crash Course",
  description:
    "Register a student for the Summer Crash Course and the free diagnostic flow.",
};

export default async function SummerCrashRegisterPage() {
  const config = await getSummerCrashPublicConfig();
  return (
    <div className="public-flow-page public-register-page public-summer-register-page">
      <Suspense fallback={null}>
        <SummerCrashSessionRedirect />
      </Suspense>
      <div className="public-flow-shell">
        <Suspense fallback={null}>
          <SummerCrashRegistrationClient {...config} />
        </Suspense>
      </div>
    </div>
  );
}
