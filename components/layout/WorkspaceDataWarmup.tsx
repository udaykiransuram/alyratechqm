"use client";

import { useEffect } from "react";

import { prefetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

export default function WorkspaceDataWarmup({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const schoolKey = resolveClientSchoolKey();
    if (!schoolKey) {
      return;
    }

    const warmSupportData = () => {
      void prefetchApiJson("/api/classes", {
        cache: "no-store",
        schoolKey,
        clientCacheTtlMs: 60_000,
      });
      void prefetchApiJson("/api/sections", {
        cache: "no-store",
        schoolKey,
        clientCacheTtlMs: 60_000,
      });
      void prefetchApiJson("/api/subjects", {
        cache: "no-store",
        schoolKey,
        clientCacheTtlMs: 60_000,
      });
      void prefetchApiJson("/api/tags/with-subjects", {
        cache: "no-store",
        schoolKey,
        clientCacheTtlMs: 60_000,
      });
    };

    if (typeof window === "undefined") {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      const idleHandle = window.requestIdleCallback(() => {
        warmSupportData();
      }, { timeout: 1200 });

      return () => {
        window.cancelIdleCallback?.(idleHandle);
      };
    }

    const timeoutId = window.setTimeout(() => {
      warmSupportData();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [enabled]);

  return null;
}
