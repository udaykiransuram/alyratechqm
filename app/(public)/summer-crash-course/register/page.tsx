import type { Metadata } from "next";
import { Suspense } from "react";

import SummerCrashRegistrationClient from "@/components/summer-crash/SummerCrashRegistrationClient";
import { getSummerCrashPublicConfig } from "@/lib/server/summer-crash";
import { redirectSummerCrashPublicSession } from "@/lib/server/summer-crash-session";

export const metadata: Metadata = {
  title: "Register | Summer Crash Course",
  description:
    "Register a student for the Summer Crash Course and the free diagnostic flow.",
};

type SummerCrashRegisterPageProps = {
  searchParams?: Promise<{
    entry?: string | string[] | undefined;
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function SummerCrashRegisterPage({
  searchParams,
}: SummerCrashRegisterPageProps) {
  await redirectSummerCrashPublicSession();

  const [config, resolvedSearchParams] = await Promise.all([
    getSummerCrashPublicConfig(),
    searchParams,
  ]);
  const entrySource =
    getSearchParam(resolvedSearchParams?.entry) === "diagnostic"
      ? "diagnostic"
      : "direct_registration";

  return (
    <div className="public-flow-page public-summer-register-page">
      <div className="public-flow-shell-narrow public-summer-shell public-summer-register-shell">
        <Suspense fallback={null}>
          <SummerCrashRegistrationClient
            {...config}
            entrySource={entrySource}
          />
        </Suspense>
      </div>
    </div>
  );
}
