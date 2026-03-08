import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const DEV_DIST_DIR = ".next-dev";
const PROD_DIST_DIR = ".next";

export default function createNextConfig(phase) {
  return {
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? DEV_DIST_DIR : PROD_DIST_DIR,
  };
}
