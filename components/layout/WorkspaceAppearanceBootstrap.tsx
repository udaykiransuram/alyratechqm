"use client";

import { useLayoutEffect, useRef } from "react";

import {
  clearWorkspaceAppearanceFromDocument,
  applyWorkspaceAppearanceToDocument,
  persistWorkspaceAppearance,
  readStoredWorkspaceAppearance,
  subscribeWorkspaceAppearance,
  type WorkspaceAppearanceState,
} from "@/lib/client/workspace-appearance";
import {
  APP_SCHOOL_SELECTION_CHANGE_EVENT,
  getSchoolKeyFromCookie,
} from "@/lib/client/school";
import {
  fetchApiJson,
  getApiRequestErrorCode,
  isApiRequestError,
} from "@/lib/client/api";

type WorkspaceAppearanceResponse = {
  success?: boolean;
  schoolKey?: string;
  appearance?: WorkspaceAppearanceState;
};

function shouldSilenceWorkspaceAppearanceError(error: unknown) {
  if (!isApiRequestError(error)) {
    return false;
  }

  if (error.httpStatus === 401 || error.httpStatus === 403) {
    return true;
  }

  const code = getApiRequestErrorCode(error);
  if (code === "SessionInvalidated" || code === "StudentSessionExpired") {
    return true;
  }

  const message = String(error.message || "").toLowerCase();
  return (
    message.includes("active session permissions") ||
    message.includes("authentication required") ||
    message.includes("school workspace session required") ||
    message.includes("forbidden")
  );
}

export default function WorkspaceAppearanceBootstrap({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  const activeSchoolKeyRef = useRef("");
  const latestLoadIdRef = useRef(0);

  useLayoutEffect(() => {
    if (!enabled) {
      activeSchoolKeyRef.current = "";
      latestLoadIdRef.current += 1;
      clearWorkspaceAppearanceFromDocument();
      return;
    }

    let cancelled = false;

    const applyCachedAppearance = (schoolKey?: string | null) => {
      const cachedAppearance = readStoredWorkspaceAppearance(schoolKey);
      applyWorkspaceAppearanceToDocument(cachedAppearance);
      return cachedAppearance;
    };

    const loadSchoolAppearance = async (schoolKey?: string | null) => {
      const normalizedSchoolKey = String(schoolKey || "").trim().toLowerCase();
      if (!normalizedSchoolKey) {
        return;
      }

      const loadId = latestLoadIdRef.current + 1;
      latestLoadIdRef.current = loadId;

      try {
        const response = await fetchApiJson<WorkspaceAppearanceResponse>(
          "/api/workspace/appearance",
          {
            cache: "no-store",
            includeSchoolQuery: false,
            schoolKey: normalizedSchoolKey,
          },
        );

        if (
          cancelled ||
          loadId !== latestLoadIdRef.current ||
          activeSchoolKeyRef.current !== normalizedSchoolKey
        ) {
          return;
        }

        const nextAppearance =
          response.appearance || readStoredWorkspaceAppearance(normalizedSchoolKey);
        persistWorkspaceAppearance(nextAppearance, normalizedSchoolKey);
      } catch (error) {
        if (cancelled || shouldSilenceWorkspaceAppearanceError(error)) {
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          console.error("Failed to bootstrap workspace appearance:", error);
        }
      }
    };

    const initialSchoolKey = getSchoolKeyFromCookie();
    activeSchoolKeyRef.current = initialSchoolKey;
    applyCachedAppearance(initialSchoolKey);
    void loadSchoolAppearance(initialSchoolKey);

    const unsubscribe = subscribeWorkspaceAppearance((nextAppearance) => {
      applyWorkspaceAppearanceToDocument(nextAppearance);
    });

    const handleSchoolSelectionChange = () => {
      const nextSchoolKey = getSchoolKeyFromCookie();
      activeSchoolKeyRef.current = nextSchoolKey;
      applyCachedAppearance(nextSchoolKey);
      void loadSchoolAppearance(nextSchoolKey);
    };

    window.addEventListener(
      APP_SCHOOL_SELECTION_CHANGE_EVENT,
      handleSchoolSelectionChange as EventListener,
    );

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(
        APP_SCHOOL_SELECTION_CHANGE_EVENT,
        handleSchoolSelectionChange as EventListener,
      );
      clearWorkspaceAppearanceFromDocument();
    };
  }, [enabled]);

  return null;
}
