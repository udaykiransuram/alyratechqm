import path from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: [
      ".next/**",
      ".next-dev/**",
      "node_modules/**",
      "playwright-report/**",
      "release-health-report/**",
      "test-results/**",
    ],
  },
  ...compat.config({
    extends: ["next/core-web-vitals"],
    overrides: [
      {
        files: ["local-tests/**/*.ts"],
        env: {
          node: true,
        },
      },
    ],
  }),
];
