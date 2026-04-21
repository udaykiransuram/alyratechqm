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
              value: "public, max-age=86400, stale-while-revalidate=604800",
            },
          ],
        },
        {
          source: "/wasm/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=86400, stale-while-revalidate=604800",
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
    webpack: (config) => {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "@tiptap/core/jsx-runtime": path.join(
          PROJECT_ROOT,
          "lib/shims/tiptap-jsx-runtime.ts",
        ),
      };
      return config;
    },
  };
}
