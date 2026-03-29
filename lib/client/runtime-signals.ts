"use client";

import { useEffect, useState } from "react";

type NetworkInformationLike = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
  addEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void;
  removeEventListener?: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void;
};

type NavigatorWithRuntimeSignals = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
  deviceMemory?: number;
};

export type ClientRuntimeSignals = {
  prefersReducedMotion: boolean;
  saveData: boolean;
  lowBandwidth: boolean;
  lowPower: boolean;
  compactViewport: boolean;
  liteMode: boolean;
};

const DEFAULT_RUNTIME_SIGNALS: ClientRuntimeSignals = {
  prefersReducedMotion: false,
  saveData: false,
  lowBandwidth: false,
  lowPower: false,
  compactViewport: false,
  liteMode: false,
};

function readConnectionInfo() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const runtimeNavigator = navigator as NavigatorWithRuntimeSignals;
  return (
    runtimeNavigator.connection ||
    runtimeNavigator.mozConnection ||
    runtimeNavigator.webkitConnection ||
    null
  );
}

function readClientRuntimeSignals(): ClientRuntimeSignals {
  if (typeof window === "undefined") {
    return DEFAULT_RUNTIME_SIGNALS;
  }

  const connection = readConnectionInfo();
  const effectiveType = String(connection?.effectiveType || "").toLowerCase();
  const downlink = Number(connection?.downlink || 0);
  const saveData = connection?.saveData === true;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const compactViewport = window.matchMedia("(max-width: 1024px)").matches;
  const runtimeNavigator = navigator as NavigatorWithRuntimeSignals;
  const deviceMemory = Number(runtimeNavigator.deviceMemory || 0);
  const hardwareConcurrency = Number(navigator.hardwareConcurrency || 0);

  const lowBandwidth =
    saveData ||
    effectiveType === "slow-2g" ||
    effectiveType === "2g" ||
    (Number.isFinite(downlink) && downlink > 0 && downlink < 1.2);

  const lowPower =
    (Number.isFinite(deviceMemory) && deviceMemory > 0 && deviceMemory <= 2) ||
    (Number.isFinite(hardwareConcurrency) &&
      hardwareConcurrency > 0 &&
      hardwareConcurrency <= 2);

  return {
    prefersReducedMotion,
    saveData,
    lowBandwidth,
    lowPower,
    compactViewport,
    liteMode: prefersReducedMotion || saveData || (lowBandwidth && lowPower),
  };
}

export function useClientRuntimeSignals() {
  const [signals, setSignals] = useState<ClientRuntimeSignals>(
    DEFAULT_RUNTIME_SIGNALS,
  );

  useEffect(() => {
    const syncSignals = () => {
      setSignals(readClientRuntimeSignals());
    };

    syncSignals();

    const reducedMotionMedia = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const compactViewportMedia = window.matchMedia("(max-width: 1024px)");
    const connection = readConnectionInfo();

    reducedMotionMedia.addEventListener?.("change", syncSignals);
    compactViewportMedia.addEventListener?.("change", syncSignals);
    connection?.addEventListener?.("change", syncSignals as EventListener);
    window.addEventListener("resize", syncSignals, { passive: true });

    return () => {
      reducedMotionMedia.removeEventListener?.("change", syncSignals);
      compactViewportMedia.removeEventListener?.("change", syncSignals);
      connection?.removeEventListener?.("change", syncSignals as EventListener);
      window.removeEventListener("resize", syncSignals);
    };
  }, []);

  return signals;
}
