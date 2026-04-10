"use client";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";

type StudentTestFullscreenGateViewProps = {
  paperTitle: string;
  testsHref: string;
  backLabel: string;
  actionError?: string | null;
  connectionNotice?: string | null;
  recoveryNotice?: string | null;
  onResumeFullscreen: () => Promise<void>;
};

export default function StudentTestFullscreenGateView({
  paperTitle,
  testsHref,
  backLabel,
  actionError = null,
  connectionNotice = null,
  recoveryNotice = null,
  onResumeFullscreen,
}: StudentTestFullscreenGateViewProps) {
  return (
    <div className="fixed inset-0 z-[1400] flex min-h-[100dvh] items-center justify-center bg-background px-4 py-6 sm:px-6">
      <div className="w-full max-w-2xl space-y-4">
        {actionError ? (
          <FeedbackNotice variant="error">{actionError}</FeedbackNotice>
        ) : null}
        {!actionError && connectionNotice ? (
          <FeedbackNotice variant="warning">{connectionNotice}</FeedbackNotice>
        ) : null}
        {!actionError && !connectionNotice && recoveryNotice ? (
          <FeedbackNotice variant="success">{recoveryNotice}</FeedbackNotice>
        ) : null}

        <div className="rounded-[2rem] border border-border/60 bg-background p-6 text-center shadow-[0_24px_60px_-40px_rgba(15,23,42,0.35)] sm:p-8">
          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-muted/60" />
          <p className="app-spotlight-label">Online Test</p>
          <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
            {paperTitle}
          </h1>
          <h2 className="mt-5 text-lg font-semibold text-foreground">
            Fullscreen required
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            This test opens only in fullscreen mode. Restore Chrome, enter
            fullscreen, and continue only after the fullscreen window is active.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,15rem)_minmax(0,15rem)] sm:justify-center">
            <Button
              type="button"
              size="lg"
              className="w-full"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void onResumeFullscreen();
              }}
            >
              Resume in fullscreen
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <AppPrefetchLink href={testsHref}>{backLabel}</AppPrefetchLink>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
