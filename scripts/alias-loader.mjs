import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRootUrl = pathToFileURL(`${process.cwd()}${path.sep}`);
const EXTENSION_CANDIDATES = [
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.mjs",
];

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const mappedBaseUrl = new URL(specifier.slice(2), projectRootUrl);
  const candidates = [mappedBaseUrl.href, ...EXTENSION_CANDIDATES.map((suffix) => `${mappedBaseUrl.href}${suffix}`)];

  for (const candidate of candidates) {
    try {
      return await nextResolve(candidate, context);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code !== "ERR_MODULE_NOT_FOUND"
      ) {
        throw error;
      }
    }
  }

  return nextResolve(specifier, context);
}
