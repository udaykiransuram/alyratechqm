import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/marketing", "/register"],
        disallow: [
          "/api/",
          "/auth/",
          "/admins/",
          "/analytics/",
          "/manage/",
          "/question-papers/",
          "/questions/",
          "/students/",
          "/subject/",
          "/subjects/",
          "/success/",
          "/tags/",
          "/teachers/",
          "/upload/",
        ],
      },
    ],
    sitemap: getAbsoluteUrl("/sitemap.xml"),
    host: getAbsoluteUrl("/").replace(/\/$/, ""),
  };
}
