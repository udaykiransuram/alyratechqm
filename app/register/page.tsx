import type { Metadata } from "next";
import RegisterPageClient from "./RegisterPageClient";
import {
  COMPANY_NAME,
  PRODUCT_NAME,
  REGISTER_DESCRIPTION,
  SITE_KEYWORDS,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: `Register for ${PRODUCT_NAME}`,
  description: REGISTER_DESCRIPTION,
  keywords: [...SITE_KEYWORDS, "online registration", "secure payment"],
  alternates: {
    canonical: "/register",
  },
  openGraph: {
    title: `Register for ${PRODUCT_NAME} | ${COMPANY_NAME}`,
    description: REGISTER_DESCRIPTION,
    url: "/register",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: `Register for ${PRODUCT_NAME} | ${COMPANY_NAME}`,
    description: REGISTER_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function RegisterPage() {
  return <RegisterPageClient />;
}
