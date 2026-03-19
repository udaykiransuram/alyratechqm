import type { Metadata } from "next";
import SignInClient from "./SignInClient";

export const metadata: Metadata = {
  title: "Admin Sign In",
  description: "Admin login for the ALYRA TECH talent test platform.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignInPage() {
  return <SignInClient />;
}
