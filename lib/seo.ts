import { getSiteUrlOrFallback } from "@/lib/site-url";

export const COMPANY_NAME = "ALYRA TECH";
export const PRODUCT_NAME = "School Quality Management Workspace";
export const SITE_TITLE = `${PRODUCT_NAME}`;

export const HOME_DESCRIPTION =
  "ALYRA TECH provides a secure school quality management workspace for academic setup, assessment operations, analytics, and report delivery.";

export const SITE_KEYWORDS = [
  "ALYRA TECH",
  "school quality management",
  "assessment operations",
  "school analytics",
  "question paper management",
  "report delivery",
  "academic setup",
];

export function getMetadataBase() {
  const candidate = getSiteUrlOrFallback();

  try {
    return new URL(candidate);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function getAbsoluteUrl(path = "/") {
  return new URL(path, getMetadataBase()).toString();
}
