"use client";

export const HOME_WEBGL_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_HOME_WEBGL !== "false";

export function detectHomeWebglSupport() {
  if (!HOME_WEBGL_ENABLED || typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}
