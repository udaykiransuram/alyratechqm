export function isFullscreenSupported() {
  return typeof document !== "undefined" && Boolean(document.fullscreenEnabled);
}

export async function requestElementFullscreen(
  element?: Element | null,
) {
  if (!isFullscreenSupported() || !element) {
    return false;
  }

  if (document.fullscreenElement === element) {
    return true;
  }

  try {
    await element.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function exitCurrentFullscreen() {
  if (typeof document === "undefined" || !document.fullscreenElement) {
    return false;
  }

  try {
    await document.exitFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function requestGlobalFullscreen() {
  if (!isFullscreenSupported()) {
    return;
  }

  if (document.fullscreenElement) {
    return;
  }

  try {
    await document.documentElement.requestFullscreen();
  } catch {
    // Ignore failures to avoid blocking navigation.
  }
}
