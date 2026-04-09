export async function requestGlobalFullscreen() {
  if (typeof document === "undefined") {
    return;
  }

  if (!document.fullscreenEnabled || document.fullscreenElement) {
    return;
  }

  try {
    await document.documentElement.requestFullscreen();
  } catch {
    // Ignore failures to avoid blocking navigation.
  }
}
