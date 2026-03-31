"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { resetPendingNavigationFeedback } from "@/lib/client/navigation-feedback";

const STALE_DEPLOY_RELOAD_KEY = "app:stale-deploy-reload-at";
const STALE_DEPLOY_RELOAD_COOLDOWN_MS = 60_000;

function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "";
}

function isRecoverableDeployMismatchError(error: unknown) {
  const message = getErrorMessage(error);
  if (!message) {
    return false;
  }

  return [
    "ChunkLoadError",
    "Loading chunk",
    "Failed to fetch dynamically imported module",
    "Importing a module script failed",
    "Failed to load module script",
  ].some((token) => message.includes(token));
}

function tryReloadForStaleDeploy() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const lastAttempt = Number(
      window.sessionStorage.getItem(STALE_DEPLOY_RELOAD_KEY) || "0",
    );

    if (
      Number.isFinite(lastAttempt) &&
      Date.now() - lastAttempt < STALE_DEPLOY_RELOAD_COOLDOWN_MS
    ) {
      return;
    }

    window.sessionStorage.setItem(
      STALE_DEPLOY_RELOAD_KEY,
      String(Date.now()),
    );
  } catch {}

  window.location.reload();
}

export default function AppClientRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.setAttribute("data-app-hydrated", "true");

    return () => {
      document.documentElement.removeAttribute("data-app-hydrated");
    };
  }, []);

  useEffect(() => {
    resetPendingNavigationFeedback();
  }, [pathname]);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      const candidate = event.error || event.message;
      if (isRecoverableDeployMismatchError(candidate)) {
        tryReloadForStaleDeploy();
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isRecoverableDeployMismatchError(event.reason)) {
        tryReloadForStaleDeploy();
      }
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
