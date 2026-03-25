import type { Metadata } from "next";

import { cookies } from "next/headers";

import { getPublicSchoolOptions } from "@/lib/server/public-school-data";
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
  const [schools, cookieStore, resolvedSearchParams] = await Promise.all([
    getPublicSchoolOptions().catch(() => []),
    cookies(),
    searchParams,
  ]);

  const rememberedSchoolKey = String(
    cookieStore.get("schoolKey")?.value || "",
  )
    .trim()
    .toLowerCase();
  const rememberedSchool = schools.find(
    (school) => school.key === rememberedSchoolKey,
  );
  const autoSelectedSchool =
    rememberedSchool || (schools.length === 1 ? schools[0] : undefined);

  return (
    <SignInClient
      initialSchools={schools}
      initialSchoolKey={autoSelectedSchool?.key}
      requestedCallbackUrl={getFirstSearchParam(resolvedSearchParams?.callbackUrl)}
      pageError={getFirstSearchParam(resolvedSearchParams?.error)}
    />
  );
}
