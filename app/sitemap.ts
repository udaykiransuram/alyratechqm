import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "/",
    "/about",
    "/benefits",
    "/case-study",
    "/contact",
    "/product",
    "/register",
    "/talent-test",
    "/terms",
  ];

  return routes.map((path) => ({
    url: getAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/register" || path === "/talent-test" ? 0.8 : 0.7,
  }));
}
