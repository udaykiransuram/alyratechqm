"use client";

import { useEffect } from "react";

import { recordClientApiTiming } from "@/lib/client/api-performance";

type AppInstrumentedWindow = Window &
  typeof globalThis & {
    __APP_API_FETCH_INSTRUMENTED__?: boolean;
    __APP_API_ORIGINAL_FETCH__?: typeof window.fetch;
  };

function resolveRequestUrl(input: RequestInfo | URL) {
  if (input instanceof Request) {
    return input.url;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return String(input);
}

function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.method === "string" && init.method.trim()) {
    return init.method.trim().toUpperCase();
  }
  if (input instanceof Request && typeof input.method === "string" && input.method.trim()) {
    return input.method.trim().toUpperCase();
  }
  return "GET";
}

function resolveTrackedApiUrl(rawUrl: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const url = new URL(rawUrl, window.location.href);
    if (url.origin !== window.location.origin) {
      return null;
    }
    if (!url.pathname.startsWith("/api/")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export default function ClientApiRequestProbe() {
  useEffect(() => {
    const probeEnabled = (() => {
      try {
        return window.localStorage.getItem("app:enable-api-probe") === "1";
      } catch {
        return false;
      }
    })();

    if (!probeEnabled) {
      return;
    }

    const appWindow = window as AppInstrumentedWindow;
    if (appWindow.__APP_API_FETCH_INSTRUMENTED__) {
      return;
    }

    appWindow.__APP_API_FETCH_INSTRUMENTED__ = true;
    appWindow.__APP_API_ORIGINAL_FETCH__ = appWindow.fetch.bind(window);

    const originalFetch = appWindow.__APP_API_ORIGINAL_FETCH__;

    appWindow.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const trackedUrl = resolveTrackedApiUrl(resolveRequestUrl(input));
      const method = resolveRequestMethod(input, init);
      const startedAt = new Date().toISOString();
      const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();

      try {
        const response = await originalFetch(input, init);

        if (trackedUrl) {
          const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
          recordClientApiTiming({
            key: `${method} ${trackedUrl.pathname}`,
            method,
            pathname: trackedUrl.pathname,
            url: `${trackedUrl.pathname}${trackedUrl.search}`,
            status: response.status,
            ok: response.ok,
            durationMs: Math.max(0, endTime - startTime),
            startedAt,
          });
        }

        return response;
      } catch (error) {
        if (trackedUrl) {
          const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
          recordClientApiTiming({
            key: `${method} ${trackedUrl.pathname}`,
            method,
            pathname: trackedUrl.pathname,
            url: `${trackedUrl.pathname}${trackedUrl.search}`,
            status: null,
            ok: false,
            durationMs: Math.max(0, endTime - startTime),
            startedAt,
            errorMessage: error instanceof Error ? error.message : "Request failed.",
          });
        }

        throw error;
      }
    };

    return () => {
      if (appWindow.__APP_API_ORIGINAL_FETCH__) {
        appWindow.fetch = appWindow.__APP_API_ORIGINAL_FETCH__;
      }
      delete appWindow.__APP_API_ORIGINAL_FETCH__;
      appWindow.__APP_API_FETCH_INSTRUMENTED__ = false;
    };
  }, []);

  return null;
}
