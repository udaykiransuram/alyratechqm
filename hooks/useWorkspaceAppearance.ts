"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchApiJson } from "@/lib/client/api";
import { APP_SCHOOL_SELECTION_CHANGE_EVENT, getSchoolKeyFromCookie } from "@/lib/client/school";
import {
  applyWorkspaceAppearanceToDocument,
  DEFAULT_WORKSPACE_APPEARANCE,
  normalizeAccentHex,
  persistWorkspaceAppearance,
  readStoredWorkspaceAppearance,
  subscribeWorkspaceAppearance,
  type AppNavMode,
  type AppNavTone,
  type AppPalette,
  type AppTextStyle,
  type WorkspaceAppearanceState,
} from "@/lib/client/workspace-appearance";

type WorkspaceAppearanceHookResult = WorkspaceAppearanceState & {
  hydrated: boolean;
  updateAppearance: (updates: Partial<WorkspaceAppearanceState>) => void;
  setTextStyle: (textStyle: AppTextStyle) => void;
  setNavMode: (navMode: AppNavMode) => void;
  setNavTone: (navTone: AppNavTone) => void;
  setPalette: (palette: AppPalette) => void;
  setCustomAccentHex: (customAccentHex: string) => void;
  resetAppearance: () => void;
};

type WorkspaceAppearanceResponse = {
  success?: boolean;
  schoolKey?: string;
  appearance?: WorkspaceAppearanceState;
};

const APPEARANCE_SAVE_DEBOUNCE_MS = 220;

function normalizeAppearance(
  appearance: WorkspaceAppearanceState,
): WorkspaceAppearanceState {
  return {
    ...appearance,
    customAccentHex: normalizeAccentHex(appearance.customAccentHex),
  };
}

export function useWorkspaceAppearance(): WorkspaceAppearanceHookResult {
  const [appearance, setAppearance] = useState<WorkspaceAppearanceState>(
    DEFAULT_WORKSPACE_APPEARANCE,
  );
  const [hydrated, setHydrated] = useState(false);
  const appearanceRef = useRef<WorkspaceAppearanceState>(
    DEFAULT_WORKSPACE_APPEARANCE,
  );
  const activeSchoolKeyRef = useRef("");
  const saveTimeoutRef = useRef<number | null>(null);
  const latestLoadIdRef = useRef(0);

  const syncAppearance = useCallback((nextAppearance: WorkspaceAppearanceState) => {
    const normalized = normalizeAppearance(nextAppearance);
    appearanceRef.current = normalized;
    setAppearance(normalized);
    return normalized;
  }, []);

  const queueServerSave = useCallback(
    (nextAppearance: WorkspaceAppearanceState, schoolKey: string) => {
      if (!schoolKey || typeof window === "undefined") {
        return;
      }

      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = window.setTimeout(() => {
        saveTimeoutRef.current = null;

        void fetchApiJson<WorkspaceAppearanceResponse>(
          "/api/workspace/appearance",
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              appearance: nextAppearance,
            }),
            cache: "no-store",
            includeSchoolQuery: false,
            schoolKey,
          },
        ).catch((error) => {
          console.error("Failed to persist workspace appearance:", error);
        });
      }, APPEARANCE_SAVE_DEBOUNCE_MS);
    },
    [],
  );

  const updateAppearance = useCallback(
    (updates: Partial<WorkspaceAppearanceState>) => {
      const schoolKey = getSchoolKeyFromCookie();
      const nextAppearance = syncAppearance({
        ...appearanceRef.current,
        ...updates,
      });
      persistWorkspaceAppearance(nextAppearance, schoolKey);
      queueServerSave(nextAppearance, schoolKey);
    },
    [queueServerSave, syncAppearance],
  );

  const resetAppearance = useCallback(() => {
    const schoolKey = getSchoolKeyFromCookie();
    const nextAppearance = syncAppearance(DEFAULT_WORKSPACE_APPEARANCE);
    persistWorkspaceAppearance(nextAppearance, schoolKey);
    queueServerSave(nextAppearance, schoolKey);
  }, [queueServerSave, syncAppearance]);

  useEffect(() => {
    let cancelled = false;

    const applyCachedAppearance = (schoolKey?: string | null) => {
      const cachedAppearance = syncAppearance(readStoredWorkspaceAppearance(schoolKey));
      applyWorkspaceAppearanceToDocument(cachedAppearance);
      return cachedAppearance;
    };

    const loadSchoolAppearance = async (schoolKey?: string | null) => {
      const normalizedSchoolKey = String(schoolKey || "").trim().toLowerCase();
      if (!normalizedSchoolKey) {
        if (!cancelled) {
          setHydrated(true);
        }
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

        const nextAppearance = syncAppearance(
          response.appearance || DEFAULT_WORKSPACE_APPEARANCE,
        );
        persistWorkspaceAppearance(nextAppearance, normalizedSchoolKey);
        applyWorkspaceAppearanceToDocument(nextAppearance);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load school workspace appearance:", error);
        }
      } finally {
        if (!cancelled && loadId === latestLoadIdRef.current) {
          setHydrated(true);
        }
      }
    };

    const initialSchoolKey = getSchoolKeyFromCookie();
    activeSchoolKeyRef.current = initialSchoolKey;
    applyCachedAppearance(initialSchoolKey);
    void loadSchoolAppearance(initialSchoolKey);

    const unsubscribe = subscribeWorkspaceAppearance((nextAppearance) => {
      const normalized = syncAppearance(nextAppearance);
      applyWorkspaceAppearanceToDocument(normalized);
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
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [syncAppearance]);

  const setTextStyle = useCallback(
    (textStyle: AppTextStyle) => {
      updateAppearance({ textStyle });
    },
    [updateAppearance],
  );

  const setNavMode = useCallback(
    (navMode: AppNavMode) => {
      updateAppearance({ navMode });
    },
    [updateAppearance],
  );

  const setNavTone = useCallback(
    (navTone: AppNavTone) => {
      updateAppearance({ navTone });
    },
    [updateAppearance],
  );

  const setPalette = useCallback(
    (palette: AppPalette) => {
      updateAppearance({ palette });
    },
    [updateAppearance],
  );

  const setCustomAccentHex = useCallback(
    (customAccentHex: string) => {
      updateAppearance({ customAccentHex });
    },
    [updateAppearance],
  );

  return {
    ...appearance,
    hydrated,
    updateAppearance,
    setTextStyle,
    setNavMode,
    setNavTone,
    setPalette,
    setCustomAccentHex,
    resetAppearance,
  };
}
