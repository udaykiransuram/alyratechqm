import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.config({
    extends: ["next/core-web-vitals"],
    ignorePatterns: [
      ".next/**",
      ".next-dev/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
    ],
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

export default config;
