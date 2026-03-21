import type { Metadata } from "next";
import { Suspense } from "react";

import CompanySignInClient from "./CompanySignInClient";

export const metadata: Metadata = {
  title: "Company Admin Sign In",
  description: "Secure login for the company school administration portal.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CompanySignInPage() {
  return (
    <Suspense fallback={null}>
      <CompanySignInClient />
    </Suspense>
  );
}
