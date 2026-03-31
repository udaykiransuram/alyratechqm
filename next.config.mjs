import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DEV_DIST_DIR = ".next-dev";
const PROD_DIST_DIR = ".next";
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));

export default function createNextConfig(phase) {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? DEV_DIST_DIR : PROD_DIST_DIR,
    outputFileTracingRoot: PROJECT_ROOT,
    eslint: {
      ignoreDuringBuilds: true,
    },
    async headers() {
      return [
        {
          source: "/animations/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=0, must-revalidate",
            },
          ],
        },
        {
          source: "/wasm/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=0, must-revalidate",
            },
          ],
        },
      ];
    },
    images: {
      qualities: [75, 78],
    },
    experimental: {
      optimizePackageImports: [
        "lucide-react",
        "@heroicons/react",
        "date-fns",
      ],
    },
  };
}
