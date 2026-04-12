import {
  buildYouTubeEmbedUrl,
  buildYouTubeWatchUrl,
  resolveYouTubeVideoId,
} from "@/lib/courses/youtube";

export type LiveSessionYouTubeStream = {
  videoId: string;
  embedUrl: string;
  watchUrl: string;
};

export function resolveLiveSessionYouTubeStream(
  url?: string | null,
): LiveSessionYouTubeStream | null {
  const videoId = resolveYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  return {
    videoId,
    embedUrl: buildYouTubeEmbedUrl(videoId),
    watchUrl: buildYouTubeWatchUrl(videoId),
  };
}
