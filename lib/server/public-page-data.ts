export async function resolvePublicPageData<T>(
  load: () => Promise<T>,
  fallback: T,
  timeoutMs = 2000,
): Promise<T> {
  try {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve(fallback);
      }, timeoutMs);
    });

    const result = await Promise.race([load(), timeoutPromise]);

    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    return result;
  } catch {
    return fallback;
  }
}
