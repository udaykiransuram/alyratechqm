export const COMPANY_NAME = "ALYRA TECH";
export const PRODUCT_NAME = "Young Scholars Talent Test";
export const SITE_TITLE = `${PRODUCT_NAME}`;

export const HOME_DESCRIPTION =
  "Young Scholars Talent Test by ALYRA TECH is a national STEM talent assessment with registration, performance analytics, awards, and school-level insights for classes 1-10.";

export const MARKETING_DESCRIPTION =
  "ALYRA TECH helps schools go beyond marks with precision diagnostic assessments, class heatmaps, targeted reteach, and measurable student growth.";

export const REGISTER_DESCRIPTION =
  "Register for the Young Scholars Talent Test by ALYRA TECH and complete secure online payment for student enrollment.";

export const SITE_KEYWORDS = [
  "ALYRA TECH",
  "Young Scholars Talent Test",
  "talent test registration",
  "STEM assessment",
  "student talent test",
  "school analytics",
  "diagnostic assessment",
  "classes 1 to 10",
];

export const PUBLIC_SITEMAP_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/marketing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/register", changeFrequency: "weekly", priority: 0.9 },
] as const;

export function getMetadataBase() {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";

  try {
    return new URL(candidate);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function getAbsoluteUrl(path = "/") {
  return new URL(path, getMetadataBase()).toString();
}
