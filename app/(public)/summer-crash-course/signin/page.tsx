import type { Metadata } from "next";
import { Suspense } from "react";

import SummerCrashSignInClient from "@/components/summer-crash/SummerCrashSignInClient";
import {
  getSummerCrashPublicConfig,
  lookupSummerCrashIdsByPhone,
} from "@/lib/server/summer-crash";
import { redirectSummerCrashPublicSession } from "@/lib/server/summer-crash-session";

export const metadata: Metadata = {
  title: "Sign In | Summer Crash Course",
  description: "Parent phone sign-in for Summer Crash Course students.",
};

type SummerCrashSignInPageProps = {
  searchParams?: Promise<{
    error?: string | string[] | undefined;
    next?: string | string[] | undefined;
    phone?: string | string[] | undefined;
    summerId?: string | string[] | undefined;
  }>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function SummerCrashSignInPage({
  searchParams,
}: SummerCrashSignInPageProps) {
  const resolvedSearchParams = await searchParams;
  const phone = getSearchParam(resolvedSearchParams?.phone).trim();
  const summerId = getSearchParam(resolvedSearchParams?.summerId)
    .trim()
    .toUpperCase();
  const nextHref = getSearchParam(resolvedSearchParams?.next).trim();
  const pageError = getSearchParam(resolvedSearchParams?.error).trim();

  await redirectSummerCrashPublicSession({
    nextDestinationHref: nextHref,
  });

  const [config, initialLookupResult] = await Promise.all([
    getSummerCrashPublicConfig(),
    phone
      ? lookupSummerCrashIdsByPhone(phone)
          .then((result) => ({
            errorMessage: "",
            matches: result.matches,
          }))
          .catch((error) => ({
            errorMessage:
              error instanceof Error
                ? error.message
                : "We couldn't find any Summer Crash Course students for that phone number.",
            matches: [],
          }))
      : Promise.resolve({
          errorMessage: "",
          matches: [],
        }),
  ]);

  return (
    <div className="public-flow-page">
      <div className="public-flow-shell-narrow public-summer-shell">
        <Suspense fallback={null}>
          <SummerCrashSignInClient
            phone={phone}
            summerId={summerId}
            nextHref={nextHref}
            pageError={pageError}
            initialMatches={initialLookupResult.matches}
            initialLookupError={
              pageError ? "" : initialLookupResult.errorMessage
            }
            supportContact={config.supportContact}
            supportHref={config.supportHref}
          />
        </Suspense>
      </div>
    </div>
  );
}
