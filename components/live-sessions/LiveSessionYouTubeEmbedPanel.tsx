import { ExternalLink, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LiveSessionYouTubeStream } from "@/lib/live-sessions/youtube";

type LiveSessionYouTubeEmbedPanelProps = {
  stream: LiveSessionYouTubeStream;
  title: string;
  description: string;
  iframeTitle: string;
  actionLabel?: string;
};

export default function LiveSessionYouTubeEmbedPanel({
  stream,
  title,
  description,
  iframeTitle,
  actionLabel = "Open on YouTube",
}: LiveSessionYouTubeEmbedPanelProps) {
  return (
    <div className="app-surface overflow-hidden">
      <div className="app-section-header">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <PlayCircle className="h-4 w-4 text-primary" />
              <span>{title}</span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={stream.watchUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              {actionLabel}
            </a>
          </Button>
        </div>
      </div>

      <div className="app-section-body">
        <div className="overflow-hidden rounded-[1rem] border border-border/60 bg-black shadow-[0_20px_44px_-34px_hsl(var(--app-shadow-deep)/0.5)]">
          <div className="aspect-video w-full">
            <iframe
              src={stream.embedUrl}
              title={iframeTitle}
              className="h-full w-full border-0"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
