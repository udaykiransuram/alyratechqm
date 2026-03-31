/// <reference types="@playwright/test" />
import {
  expect,
  test as base,
  type ConsoleMessage,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";

type RuntimeFailure = {
  source: "console" | "pageerror" | "requestfailed";
  message: string;
  url?: string;
  location?: string;
};

const CONSOLE_EXCEPTION_PATTERNS = [
  /\bTypeError\b/i,
  /\bReferenceError\b/i,
  /\bSyntaxError\b/i,
  /\bRangeError\b/i,
  /\bUnhandled Runtime Error\b/i,
  /\bApplication error\b/i,
  /\bHydration failed\b/i,
  /\bCannot read properties of undefined\b/i,
  /\bCannot destructure property\b/i,
  /\bMinified React error\b/i,
];

const IGNORED_REQUEST_FAILURE_PATTERNS = [/\/favicon\.ico$/i, /\/_next\/webpack-hmr/i];

function matchesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function shouldFailOnRuntimeErrors() {
  return process.env.PLAYWRIGHT_FAIL_ON_RUNTIME_ERRORS !== "0";
}

function formatConsoleLocation(message: ConsoleMessage) {
  const location = message.location();
  if (!location?.url) {
    return "";
  }

  const lineNumber = Number.isFinite(location.lineNumber)
    ? location.lineNumber + 1
    : null;
  const columnNumber = Number.isFinite(location.columnNumber)
    ? location.columnNumber + 1
    : null;
  return `${location.url}${lineNumber ? `:${lineNumber}` : ""}${
    columnNumber ? `:${columnNumber}` : ""
  }`;
}

function resolveAllowedOrigins(page: Page) {
  const origins = new Set<string>();

  const envBaseUrl = String(process.env.BASE_URL || "").trim();
  if (envBaseUrl) {
    try {
      origins.add(new URL(envBaseUrl).origin);
    } catch {}
  }

  const pageUrl = String(page.url() || "").trim();
  if (pageUrl && pageUrl !== "about:blank") {
    try {
      origins.add(new URL(pageUrl).origin);
    } catch {}
  }

  return origins;
}

function isSameOriginRequest(requestUrl: string, page: Page) {
  const allowedOrigins = resolveAllowedOrigins(page);
  if (!allowedOrigins.size) {
    return true;
  }

  try {
    const requestOrigin = new URL(requestUrl).origin;
    return allowedOrigins.has(requestOrigin);
  } catch {
    return requestUrl.startsWith("/");
  }
}

function shouldCaptureConsoleMessage(message: ConsoleMessage) {
  if (!["error", "assert"].includes(message.type())) {
    return false;
  }

  const text = String(message.text() || "").trim();
  if (!text) {
    return false;
  }

  return matchesAny(text, CONSOLE_EXCEPTION_PATTERNS);
}

function shouldCaptureRequestFailure(request: Request, page: Page) {
  const failureText = String(request.failure()?.errorText || "").trim();
  if (!failureText || /ERR_ABORTED|NS_BINDING_ABORTED/i.test(failureText)) {
    return false;
  }

  const resourceType = request.resourceType();
  if (!["document", "script", "stylesheet", "fetch", "xhr"].includes(resourceType)) {
    return false;
  }

  const requestUrl = String(request.url() || "").trim();
  if (!requestUrl || matchesAny(requestUrl, IGNORED_REQUEST_FAILURE_PATTERNS)) {
    return false;
  }

  return isSameOriginRequest(requestUrl, page);
}

function formatRuntimeFailure(failure: RuntimeFailure) {
  const parts = [`[${failure.source}] ${failure.message}`];
  if (failure.url) {
    parts.push(`url: ${failure.url}`);
  }
  if (failure.location) {
    parts.push(`location: ${failure.location}`);
  }
  return parts.join("\n");
}

const test = base.extend<{ runtimeGuard: void }>({
  runtimeGuard: [
    async ({ page }, use) => {
      if (!shouldFailOnRuntimeErrors()) {
        await use();
        return;
      }

      const failures: RuntimeFailure[] = [];
      const pushFailure = (failure: RuntimeFailure) => {
        if (
          failures.some(
            (entry) =>
              entry.source === failure.source &&
              entry.message === failure.message &&
              entry.url === failure.url &&
              entry.location === failure.location,
          )
        ) {
          return;
        }

        failures.push(failure);
      };

      const handleConsole = (message: ConsoleMessage) => {
        if (!shouldCaptureConsoleMessage(message)) {
          return;
        }

        pushFailure({
          source: "console",
          message: String(message.text() || "").trim(),
          location: formatConsoleLocation(message) || undefined,
        });
      };

      const handlePageError = (error: Error) => {
        const message = String(error?.stack || error?.message || error || "").trim();
        if (!message) {
          return;
        }

        pushFailure({
          source: "pageerror",
          message,
          url: page.url() || undefined,
        });
      };

      const handleRequestFailed = (request: Request) => {
        if (!shouldCaptureRequestFailure(request, page)) {
          return;
        }

        pushFailure({
          source: "requestfailed",
          message: String(request.failure()?.errorText || "").trim(),
          url: request.url(),
        });
      };

      page.on("console", handleConsole);
      page.on("pageerror", handlePageError);
      page.on("requestfailed", handleRequestFailed);

      await use();

      page.off("console", handleConsole);
      page.off("pageerror", handlePageError);
      page.off("requestfailed", handleRequestFailed);

      expect(
        failures,
        failures.length
          ? `Unexpected browser runtime errors:\n${failures
              .map((failure) => formatRuntimeFailure(failure))
              .join("\n\n")}`
          : "Unexpected browser runtime errors detected.",
      ).toHaveLength(0);
    },
    { auto: true },
  ],
});

export { expect, test };
export type { Page, Request, Route } from "@playwright/test";
