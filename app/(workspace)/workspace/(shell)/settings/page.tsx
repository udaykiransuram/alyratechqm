import type { Metadata } from "next";

import WorkspaceSettingsPageClient from "@/components/settings/WorkspaceSettingsPageClient";
import { COMPANY_NAME, PRODUCT_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Workspace Settings",
  description:
    "Adjust workspace appearance, choose standard color palettes, and refine typography preferences for the school operations shell.",
  alternates: {
    canonical: "/workspace/settings",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: `Workspace Settings | ${PRODUCT_NAME}`,
    description:
      "Choose calmer workspace colors, navigation shell tones, and text styles.",
    url: "/workspace/settings",
    siteName: COMPANY_NAME,
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: `Workspace Settings | ${PRODUCT_NAME}`,
    description:
      "Choose calmer workspace colors, navigation shell tones, and text styles.",
    images: ["/opengraph-image"],
  },
};

export default function WorkspaceSettingsPage() {
  return <WorkspaceSettingsPageClient />;
}
