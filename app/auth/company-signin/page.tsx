import type { Metadata } from "next";

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
  return <CompanySignInClient />;
}
