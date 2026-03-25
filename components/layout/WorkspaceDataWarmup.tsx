"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { prefetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import { isMockedE2ETestMode } from "@/lib/test-mode";

const WARM_WORKSPACE_ROUTES = [
  "/workspace",
  "/workspace/question-papers",
  "/workspace/question-papers/create",
  "/workspace/questions",
  "/workspace/questions/create",
  "/workspace/students",
  "/workspace/students/create",
  "/workspace/teachers",
  "/workspace/teachers/create",
  "/workspace/admins",
  "/workspace/admins/create",
  "/workspace/subjects",
  "/workspace/subjects/create",
  "/workspace/tags",
  "/workspace/tags/create",
  "/workspace/manage/users",
  "/workspace/manage/users/create",
  "/workspace/manage/classes",
  "/workspace/manage/classes/create",
  "/workspace/manage/sections",
  "/workspace/manage/sections/create",
  "/workspace/manage/reports",
  "/workspace/manage/audit-logs",
  "/workspace/analytics",
  "/workspace/analytics/student-tag-report/excel-upload",
  "/workspace/questions/bulk-upload",
  "/workspace/upload",
  "/workspace/upload/getjson",
];

const warmedWorkspaceRoutes = new Set<string>();
const workspaceWarmupDisabled = isMockedE2ETestMode();

export default function WorkspaceDataWarmup({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || workspaceWarmupDisabled) {
      return;
    }

    WARM_WORKSPACE_ROUTES.forEach((href) => {
      if (warmedWorkspaceRoutes.has(href)) {
        return;
      }

      warmedWorkspaceRoutes.add(href);
      router.prefetch(href);
    });
  }, [enabled, router]);

  useEffect(() => {
    if (!enabled || workspaceWarmupDisabled) {
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
