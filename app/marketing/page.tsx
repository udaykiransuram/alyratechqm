import type { Metadata } from "next";
import MarketingContent from "@/components/marketing/MarketingContent";
import {
  COMPANY_NAME,
  MARKETING_DESCRIPTION,
  SITE_KEYWORDS,
} from "@/lib/seo";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Beyond Marks Diagnostics",
  description: MARKETING_DESCRIPTION,
  keywords: [...SITE_KEYWORDS, "education diagnostics", "school performance insights"],
  alternates: {
    canonical: "/marketing",
  },
  openGraph: {
    title: `Beyond Marks Diagnostics | ${COMPANY_NAME}`,
    description: MARKETING_DESCRIPTION,
    url: "/marketing",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: `Beyond Marks Diagnostics | ${COMPANY_NAME}`,
    description: MARKETING_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function MarketingPage() {
  return <MarketingContent />;
}
