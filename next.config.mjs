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
    experimental: {
      optimizePackageImports: [
        "lucide-react",
        "@heroicons/react",
        "date-fns",
      ],
    },
    webpack(config) {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        "@react-three/fiber": path.join(
          PROJECT_ROOT,
          "node_modules/@react-three/fiber/dist/react-three-fiber.cjs.js",
        ),
        "@react-three/drei": path.join(
          PROJECT_ROOT,
          "node_modules/@react-three/drei/index.cjs.js",
        ),
      };

      return config;
    },
  };
}
