import type { Metadata } from "next";

import PublicThemeStudioClient from "./PublicThemeStudioClient";

export const metadata: Metadata = {
  title: "Theme Studio | Alyra Tech",
  description:
    "Choose public-site styles and color palettes, preview them live, and apply them from the company CMS.",
};

export default function CompanyContentThemePage() {
  return <PublicThemeStudioClient />;
}
