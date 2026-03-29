"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isMockedE2ETestMode } from "@/lib/test-mode";

const WARM_WORKSPACE_ROUTES = [
  "/workspace/question-papers",
  "/workspace/questions",
  "/workspace/students",
  "/workspace/manage/reports",
  "/workspace/teachers",
];

const LIGHT_WARM_WORKSPACE_ROUTES = [
  "/workspace/question-papers",
  "/workspace/students",
  "/workspace/manage/reports",
];
const WARM_WORKSPACE_ROUTE_BATCH_SIZE = 2;
const WARM_WORKSPACE_ROUTE_BATCH_DELAY_MS = 140;
const WARM_WORKSPACE_EARLY_START_DELAY_MS = 260;
const WARM_WORKSPACE_INTERACTION_START_DELAY_MS = 60;
const WARMUP_INTERACTION_FALLBACK_MS = 1_200;

const warmedWorkspaceRoutes = new Set<string>();
const workspaceWarmupDisabled =
  isMockedE2ETestMode() || process.env.NODE_ENV !== "production";

type NetworkInformationLike = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
};

function getConnectionInfo(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") {
    return null;
  }

  const networkNavigator = navigator as Navigator & {
    connection?: NetworkInformationLike;
  };

  return networkNavigator.connection || null;
}

function shouldUseLightWorkspaceWarmup() {
  const connection = getConnectionInfo();
  if (!connection) {
    return false;
  }

  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  const downlink = Number(connection.downlink || 0);

  return (
    connection.saveData === true ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    effectiveType === "3g" ||
    (Number.isFinite(downlink) && downlink > 0 && downlink < 2.5)
  );
}

function scheduleIdleTask(callback: () => void, timeout: number) {
  if (typeof window === "undefined") {
    return () => {};
  }

  if (typeof window.requestIdleCallback === "function") {
    const idleHandle = window.requestIdleCallback(callback, { timeout });
    return () => {
      window.cancelIdleCallback?.(idleHandle);
    };
  }

  const timeoutId = window.setTimeout(callback, timeout);
  return () => {
    window.clearTimeout(timeoutId);
  };
}

function scheduleWarmupAfterInteraction(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  let cancelled = false;
  const events: Array<keyof WindowEventMap> = [
    "pointerdown",
    "keydown",
    "touchstart",
  ];

  const run = () => {
    if (cancelled) {
      return;
    }
    cleanupListeners();
    callback();
  };

  const cleanupListeners = () => {
    events.forEach((eventName) => {
      window.removeEventListener(eventName, run);
    });
    window.clearTimeout(timeoutId);
  };

  const timeoutId = window.setTimeout(run, WARMUP_INTERACTION_FALLBACK_MS);
  events.forEach((eventName) => {
    window.addEventListener(eventName, run, { passive: true, once: true });
  });

  return () => {
    cancelled = true;
    cleanupListeners();
  };
}

export default function WorkspaceDataWarmup({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled || workspaceWarmupDisabled) {
      return;
    }

    const routeTargets = (
      shouldUseLightWorkspaceWarmup()
        ? LIGHT_WARM_WORKSPACE_ROUTES
        : WARM_WORKSPACE_ROUTES
    ).filter((href) => !warmedWorkspaceRoutes.has(href));

    if (routeTargets.length === 0) {
      return;
    }

    let cancelled = false;
    let nextIndex = 0;
    let cancelScheduledTask: (() => void) | null = null;
    let cancelEarlyTask: (() => void) | null = null;
    let cancelGateTask: (() => void) | null = null;

    const prefetchRouteBatch = (batchSize = WARM_WORKSPACE_ROUTE_BATCH_SIZE) => {
      cancelScheduledTask = null;
      if (cancelled) {
        return;
      }

      const batch = routeTargets.slice(
        nextIndex,
        nextIndex + Math.max(1, batchSize),
      );
      nextIndex += batch.length;

      batch.forEach((href) => {
        warmedWorkspaceRoutes.add(href);
        router.prefetch(href);
      });

      if (nextIndex < routeTargets.length) {
        cancelScheduledTask = scheduleIdleTask(
          prefetchRouteBatch,
          WARM_WORKSPACE_ROUTE_BATCH_DELAY_MS,
        );
      }
    };

    // Warm one route shortly after mount so cold first-clicks are less likely to miss.
    cancelEarlyTask = scheduleIdleTask(() => {
      prefetchRouteBatch(1);
    }, WARM_WORKSPACE_EARLY_START_DELAY_MS);

    cancelGateTask = scheduleWarmupAfterInteraction(() => {
      cancelScheduledTask = scheduleIdleTask(
        prefetchRouteBatch,
        WARM_WORKSPACE_INTERACTION_START_DELAY_MS,
      );
    });

    return () => {
      cancelled = true;
      cancelEarlyTask?.();
      cancelGateTask?.();
      cancelScheduledTask?.();
    };
  }, [enabled, router]);

  return null;
}
