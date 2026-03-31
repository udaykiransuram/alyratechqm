import type { Metadata } from "next";

import { resolveCompanyCallbackUrl } from "@/lib/company/auth";
import CompanySignInClient from "./CompanySignInClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Company Admin Sign In",
  description: "Secure login for the company school administration portal.",
  robots: {
    index: false,
    follow: false,
  },
};

type CompanySignInPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getFirstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

export default async function CompanySignInPage({
  searchParams,
}: CompanySignInPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedCallbackUrl = getFirstSearchParam(
    resolvedSearchParams?.callbackUrl,
  );
  const pageError = getFirstSearchParam(resolvedSearchParams?.error);
  const signedOut = getFirstSearchParam(resolvedSearchParams?.signedOut) === "1";

  return (
    <CompanySignInClient
      initialCallbackUrl={resolveCompanyCallbackUrl(requestedCallbackUrl)}
      pageError={pageError}
      signedOut={signedOut}
    />
  );
}
