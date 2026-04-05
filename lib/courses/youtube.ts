const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function normalizeYouTubeCandidate(value: unknown) {
  return String(value || "").trim();
}

export function isYouTubeVideoId(value: unknown) {
  return YOUTUBE_ID_PATTERN.test(normalizeYouTubeCandidate(value));
}

export function resolveYouTubeVideoId(value: unknown) {
  const rawValue = normalizeYouTubeCandidate(value);
  if (!rawValue) {
    return null;
  }

  if (isYouTubeVideoId(rawValue)) {
    return rawValue;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawValue);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

  if (hostname === "youtu.be") {
    const pathId = parsedUrl.pathname.split("/").filter(Boolean)[0] || "";
    return isYouTubeVideoId(pathId) ? pathId : null;
  }

  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    const searchVideoId = parsedUrl.searchParams.get("v");
    if (isYouTubeVideoId(searchVideoId)) {
      return String(searchVideoId);
    }

    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    if (pathSegments.length >= 2) {
      const [, maybeVideoId] = pathSegments;
      const kind = pathSegments[0];
      if (
        (kind === "embed" || kind === "shorts" || kind === "live") &&
        isYouTubeVideoId(maybeVideoId)
      ) {
        return maybeVideoId;
      }
    }
  }

  return null;
}

export function buildYouTubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export function buildYouTubeEmbedUrl(videoId: string) {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`;
}

export function buildYouTubeThumbnailUrl(videoId: string) {
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

