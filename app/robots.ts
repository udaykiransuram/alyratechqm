import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: ["/"],
      },
    ],
    host: getAbsoluteUrl("/").replace(/\/$/, ""),
  };
}
