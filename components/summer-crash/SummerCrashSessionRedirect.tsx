"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

type SummerCrashSessionRedirectProps = {
  defaultHref?: string;
  nextParamName?: string;
};

export default function SummerCrashSessionRedirect({
  defaultHref = SUMMER_CRASH_HOME_PATH,
  nextParamName,
}: SummerCrashSessionRedirectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectHref = useMemo(() => {
    const nextHref = nextParamName
      ? getSafeReturnToPath(searchParams.get(nextParamName))
      : null;
    return nextHref || defaultHref;
  }, [defaultHref, nextParamName, searchParams]);

  useEffect(() => {
    let isActive = true;

    void fetch("/api/auth/session", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((session: {
        user?: {
          accountType?: string;
          role?: string;
          schoolKey?: string;
        };
      } | null) => {
        if (!isActive || !session?.user) {
          return;
        }

        if (
          isSummerCrashSession({
            accountType: session.user.accountType,
            role: session.user.role,
            schoolKey: session.user.schoolKey,
          })
        ) {
          router.replace(redirectHref);
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [redirectHref, router]);

  return null;
}
