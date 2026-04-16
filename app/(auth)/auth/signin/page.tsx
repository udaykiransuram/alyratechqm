import type { Metadata } from "next";

import { cookies } from "next/headers";

import { isHiddenPublicSchoolKey } from "@/lib/public-school/shared";
import {
  getPublicSchoolOptionByKey,
  getPublicSchoolOptions,
} from "@/lib/server/public-school-data";
import SignInClient from "./SignInClient";

export const metadata: Metadata = {
  title: "Quality Management Sign In",
  description: "Secure login for the school quality management workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

type SignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstSearchParam(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const [cookieStore, resolvedSearchParams] = await Promise.all([
    cookies(),
    searchParams,
  ]);
  const requestedCallbackUrl = getFirstSearchParam(
    resolvedSearchParams?.callbackUrl,
  );
  const signedOut = getFirstSearchParam(
    resolvedSearchParams?.signedOut,
  ) === "1";

  const rawRememberedSchoolKey = String(
    cookieStore.get("schoolKey")?.value || "",
  )
    .trim()
    .toLowerCase();
  const rememberedSchoolKey = isHiddenPublicSchoolKey(rawRememberedSchoolKey)
    ? ""
    : rawRememberedSchoolKey;
  const rememberedSchoolDisplayName = String(
    cookieStore.get("schoolDisplayName")?.value || "",
  ).trim();

  const shouldBootstrapFromCookies = Boolean(
    rememberedSchoolKey && rememberedSchoolDisplayName,
  );
  const schools = shouldBootstrapFromCookies
    ? [
        {
          key: rememberedSchoolKey,
          displayName: rememberedSchoolDisplayName,
        },
      ]
    : rememberedSchoolKey
      ? await getPublicSchoolOptionByKey(rememberedSchoolKey)
          .then((school) => (school ? [school] : []))
          .catch(() => getPublicSchoolOptions().catch(() => []))
      : await getPublicSchoolOptions().catch(() => []);

  const rememberedSchool = schools.find(
    (school) => school.key === rememberedSchoolKey,
  );
  const autoSelectedSchool =
    rememberedSchool || (schools.length === 1 ? schools[0] : undefined);

  return (
    <>
      <SignInClient
        initialSchools={schools}
        initialSchoolKey={autoSelectedSchool?.key}
        requestedCallbackUrl={requestedCallbackUrl}
        pageError={getFirstSearchParam(resolvedSearchParams?.error)}
        initialSchoolsPartial={shouldBootstrapFromCookies}
        signedOut={signedOut}
      />
    </>
  );
}
