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
import { fetchApiJson } from "@/lib/client/api";

type WorkspaceAppearanceResponse = {
  success?: boolean;
  schoolKey?: string;
  appearance?: WorkspaceAppearanceState;
};

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
        if (!cancelled) {
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
