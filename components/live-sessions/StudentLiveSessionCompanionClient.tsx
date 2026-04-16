"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Video,
} from "lucide-react";

import { ContentRenderer } from "@/components/ContentRenderer";
import RichTextEditor from "@/components/RichTextEditor";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  exitCurrentFullscreen,
  isFullscreenSupported,
  requestElementFullscreen,
  requestGlobalFullscreen,
} from "@/lib/client/fullscreen";
import { useClientRuntimeSignals } from "@/lib/client/runtime-signals";
import type {
  LiveSessionStudentItem,
  StudentLiveSessionDetail,
} from "@/lib/live-sessions/types";
import { resolveLiveSessionYouTubeStream } from "@/lib/live-sessions/youtube";
import { buildYouTubeThumbnailUrl } from "@/lib/courses/youtube";
import { hasMeaningfulRichTextContent } from "@/lib/security/html-sanitize";
import { cn } from "@/lib/utils";

type StudentLiveSessionCompanionClientProps = {
  initialLiveSession: StudentLiveSessionDetail;
};

const LIVE_SESSION_POLL_INTERVAL_MS = 8_000;
const LIVE_SESSION_PRESENCE_INTERVAL_MS = 20_000;
const LIVE_SESSION_POLL_INTERVAL_LITE_MS = 16_000;
const LIVE_SESSION_PRESENCE_INTERVAL_LITE_MS = 40_000;

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatTime(value?: string | null) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatusLabel(value: string) {
  return String(value || "").replace(/_/g, " ");
}

function getItemTypeLabel(type: LiveSessionStudentItem["type"]) {
  if (type === "single") {
    return "One answer";
  }

  if (type === "multiple") {
    return "More than one";
  }

  return "Written answer";
}

function buildDraftState(session: StudentLiveSessionDetail) {
  const activeItem = session.activeItem;
  const response =
    activeItem && session.studentResponse?.itemId === activeItem._id
      ? session.studentResponse
      : null;

  return {
    selectedOptionIndexes: response?.selectedOptionIndexes || [],
    answerHtml: response?.answerHtml || "",
  };
}

function getObjectiveHelperText(type: LiveSessionStudentItem["type"]) {
  return type === "single"
    ? "Choose one answer."
    : "Choose all answers that apply.";
}

export default function StudentLiveSessionCompanionClient({
  initialLiveSession,
}: StudentLiveSessionCompanionClientProps) {
  const searchParams = useSearchParams();
  const runtimeSignals = useClientRuntimeSignals();
  const [liveSession, setLiveSession] = useState(initialLiveSession);
  const initialDraft = useMemo(
    () => buildDraftState(initialLiveSession),
    [initialLiveSession],
  );
  const [selectedOptionIndexes, setSelectedOptionIndexes] = useState(
    initialDraft.selectedOptionIndexes,
  );
  const [answerHtml, setAnswerHtml] = useState(initialDraft.answerHtml);
  const [error, setError] = useState<string | null>(null);
  const [focusModeError, setFocusModeError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocusModeActive, setIsFocusModeActive] = useState(false);
  const [isFocusModeAvailable, setIsFocusModeAvailable] = useState(false);
  const [isFocusModePending, setIsFocusModePending] = useState(false);
  const [hasStartedStream, setHasStartedStream] = useState(false);
  const [isStreamLoaded, setIsStreamLoaded] = useState(false);
  const [streamLoadTimedOut, setStreamLoadTimedOut] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date().toISOString());
  const refreshInFlightRef = useRef(false);
  const presenceInFlightRef = useRef(false);
  const focusStageRef = useRef<HTMLDivElement | null>(null);
  const streamFrameRef = useRef<HTMLIFrameElement | null>(null);
  const pollIntervalMs = runtimeSignals.lowBandwidth
    ? LIVE_SESSION_POLL_INTERVAL_LITE_MS
    : LIVE_SESSION_POLL_INTERVAL_MS;
  const presenceIntervalMs = runtimeSignals.lowBandwidth
    ? LIVE_SESSION_PRESENCE_INTERVAL_LITE_MS
    : LIVE_SESSION_PRESENCE_INTERVAL_MS;

  useEffect(() => {
    setLiveSession(initialLiveSession);
    setLastSyncedAt(new Date().toISOString());
  }, [initialLiveSession]);

  useEffect(() => {
    const nextDraft = buildDraftState(liveSession);
    setSelectedOptionIndexes(nextDraft.selectedOptionIndexes);
    setAnswerHtml(nextDraft.answerHtml);
    // Polling refreshes the full session object often; resetting on every object change
    // would wipe in-progress student drafts, so this reset intentionally keys off item/response changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    liveSession.activeItem?._id,
    liveSession.activeItem?.type,
    liveSession.studentResponse?.itemId,
    liveSession.studentResponse?.updatedAt,
  ]);

  const refreshLiveSession = useCallback(
    async (options?: { silent?: boolean }) => {
      if (refreshInFlightRef.current) {
        return;
      }

      const silent = Boolean(options?.silent);
      refreshInFlightRef.current = true;
      if (!silent) {
        setIsRefreshing(true);
      }

      try {
        const response = await fetch(`/api/student/live-sessions/${liveSession._id}`, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload?.success || !payload?.liveSession) {
          if (!silent) {
            setError(
              String(payload?.message || "Could not refresh the live class.").trim(),
            );
          }
          return;
        }

        setLiveSession(payload.liveSession as StudentLiveSessionDetail);
        setLastSyncedAt(new Date().toISOString());
        if (!silent) {
          setError(null);
        }
      } catch (refreshError) {
        if (!silent) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "Could not refresh the live class.",
          );
        }
      } finally {
        refreshInFlightRef.current = false;
        if (!silent) {
          setIsRefreshing(false);
        }
      }
    },
    [liveSession._id],
  );

  useEffect(() => {
    let disposed = false;

    const refreshWhenVisible = () => {
      if (disposed) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      void refreshLiveSession({ silent: true });
    };

    const intervalId = window.setInterval(refreshWhenVisible, pollIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshLiveSession({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollIntervalMs, refreshLiveSession]);

  useEffect(() => {
    let disposed = false;

    const sendPresence = async () => {
      if (disposed || presenceInFlightRef.current) {
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      presenceInFlightRef.current = true;
      try {
        await fetch(`/api/student/live-sessions/${liveSession._id}/presence`, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
        });
      } catch {
        // Ignore presence failures; the next tick will retry.
      } finally {
        presenceInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(
      () => void sendPresence(),
      presenceIntervalMs,
    );

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void sendPresence();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void sendPresence();

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [liveSession._id, presenceIntervalMs]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const syncFocusModeState = () => {
      setIsFocusModeAvailable(isFullscreenSupported());
      setIsFocusModeActive(Boolean(document.fullscreenElement));
    };

    syncFocusModeState();
    document.addEventListener("fullscreenchange", syncFocusModeState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFocusModeState);
    };
  }, []);

  const activeItem = liveSession.activeItem;
  const studentJoinStream = useMemo(
    () => resolveLiveSessionYouTubeStream(liveSession.studentJoinUrl),
    [liveSession.studentJoinUrl],
  );
  const streamPosterUrl = studentJoinStream
    ? buildYouTubeThumbnailUrl(studentJoinStream.videoId)
    : "";
  const siteOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const streamEmbedUrl = studentJoinStream
    ? `${studentJoinStream.embedUrl}&autoplay=1&mute=1&playsinline=1&iv_load_policy=3&enablejsapi=1&controls=1&fs=0&modestbranding=1&rel=0${
        siteOrigin ? `&origin=${encodeURIComponent(siteOrigin)}` : ""
      }`
    : "";
  const isSessionOver =
    liveSession.status === "completed" || liveSession.status === "cancelled";
  const hasSupportingContent = Boolean(
    studentJoinStream || (isSessionOver && liveSession.publishedTranscriptSummary),
  );
  const showSplitCompanionStage = Boolean(studentJoinStream);
  const useCompactQuestionLayout = Boolean(activeItem && studentJoinStream);
  const savedResponse =
    activeItem && liveSession.studentResponse?.itemId === activeItem._id
      ? liveSession.studentResponse
      : null;
  const isCorrectResponse =
    savedResponse?.isCorrect === true &&
    (activeItem?.type === "single" || activeItem?.type === "multiple");
  const optionCount =
    activeItem && (activeItem.type === "single" || activeItem.type === "multiple")
      ? activeItem.options.length
      : 0;
  const canSubmit =
    activeItem?.type === "short-text"
      ? hasMeaningfulRichTextContent(answerHtml)
      : activeItem?.type === "single"
        ? selectedOptionIndexes.length === 1
        : activeItem?.type === "multiple"
          ? selectedOptionIndexes.length > 0
          : false;

  const activeItemHint = activeItem
    ? activeItem.type === "short-text"
      ? "Type your answer below. You can change it until the teacher closes this question."
      : getObjectiveHelperText(activeItem.type)
    : "Stay on this page. The next question will appear here automatically.";

  const streamFrameId = useMemo(
    () => `student-live-stream-${liveSession._id}`,
    [liveSession._id],
  );

  const lockLandscapeOrientation = useCallback(async () => {
    if (typeof screen === "undefined") {
      return;
    }
    const orientation = screen.orientation;
    if (!orientation?.lock) {
      return;
    }
    try {
      await orientation.lock("landscape");
    } catch {
      // Ignore lock failures on unsupported devices.
    }
  }, []);

  const unlockOrientation = useCallback(() => {
    if (typeof screen === "undefined") {
      return;
    }
    try {
      screen.orientation?.unlock?.();
    } catch {
      // Ignore unlock failures.
    }
  }, []);

  useEffect(() => {
    if (!showSplitCompanionStage && isFocusModeActive) {
      void exitCurrentFullscreen();
    }
  }, [isFocusModeActive, showSplitCompanionStage]);

  useEffect(() => {
    if (!studentJoinStream || !showSplitCompanionStage) {
      return;
    }

    if (!searchParams?.get("join")) {
      return;
    }

    if (isFocusModeActive || isFocusModePending) {
      return;
    }

    if (!isFullscreenSupported() || !focusStageRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void requestElementFullscreen(focusStageRef.current).then(async (success) => {
        if (!success) {
          await requestGlobalFullscreen();
        }

        if (!document.fullscreenElement) {
          setFocusModeError(
            "Tap Full screen to open the class in full screen.",
          );
          return;
        }

        await lockLandscapeOrientation();
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [
    isFocusModeActive,
    isFocusModePending,
    lockLandscapeOrientation,
    searchParams,
    showSplitCompanionStage,
    studentJoinStream,
  ]);

  useEffect(() => {
    setHasStartedStream(false);
    setIsStreamLoaded(false);
    setStreamLoadTimedOut(false);
  }, [studentJoinStream?.embedUrl]);

  useEffect(() => {
    if (!hasStartedStream) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setStreamLoadTimedOut(true);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [hasStartedStream]);


  const requestStreamPlayback = useCallback(() => {
    if (!streamFrameRef.current) {
      return;
    }

    try {
      streamFrameRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "mute", args: [] }),
        "*",
      );
      streamFrameRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "*",
      );
    } catch {
      // Ignore postMessage failures for blocked embeds.
    }
  }, []);

  useEffect(() => {
    if (isFocusModeActive) {
      void lockLandscapeOrientation();
      return;
    }

    unlockOrientation();
  }, [isFocusModeActive, lockLandscapeOrientation, unlockOrientation]);

  function handleOptionToggle(optionIndex: number) {
    if (!activeItem || activeItem.type === "short-text") {
      return;
    }

    setSelectedOptionIndexes((current) => {
      if (activeItem.type === "single") {
        return [optionIndex];
      }

      return current.includes(optionIndex)
        ? current.filter((value) => value !== optionIndex)
        : [...current, optionIndex].sort((left, right) => left - right);
    });
  }

  async function handleSubmit() {
    if (!activeItem) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/student/live-sessions/${liveSession._id}/response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            itemId: activeItem._id,
            selectedOptionIndexes,
            answerHtml,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success || !payload?.liveSession) {
        setError(String(payload?.message || "Could not save your response.").trim());
        setIsSubmitting(false);
        return;
      }

      setLiveSession(payload.liveSession as StudentLiveSessionDetail);
      setLastSyncedAt(new Date().toISOString());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save your response.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFocusModeToggle() {
    if (isFocusModePending) {
      return;
    }

    if (!isFocusModeAvailable) {
      setFocusModeError(
        "Full screen is not available in this browser. Use the normal view instead.",
      );
      return;
    }

    setFocusModeError(null);
    setIsFocusModePending(true);

    try {
      if (isFocusModeActive) {
        const exited = await exitCurrentFullscreen();
        if (!exited) {
          setFocusModeError("Could not exit full screen right now.");
        }
        return;
      }

      const success = await requestElementFullscreen(focusStageRef.current);
      if (!success) {
        await requestGlobalFullscreen();
      }

      if (!document.fullscreenElement) {
        setFocusModeError("Could not start full screen right now.");
        return;
      }

      await lockLandscapeOrientation();
    } finally {
      setIsFocusModePending(false);
    }
  }

  const currentItemCard = (
    <Card
      className={cn(
        "app-surface overflow-hidden",
        useCompactQuestionLayout && "xl:border-border/55 xl:shadow-[0_24px_56px_-42px_hsl(var(--app-shadow-deep)/0.24)]",
      )}
    >
      <CardHeader
        className={cn(
          "app-section-header gap-3",
          useCompactQuestionLayout && "gap-2 px-5 py-4",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Question</CardTitle>
            <p className="text-sm text-muted-foreground">{activeItemHint}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeItem ? (
              <Badge variant="outline">{getItemTypeLabel(activeItem.type)}</Badge>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refreshLiveSession()}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "app-section-body space-y-5",
          useCompactQuestionLayout && "space-y-4 px-5 py-4",
        )}
      >
        {activeItem ? (
          <>
            <div
              className={cn(
                "max-h-[18rem] overflow-auto overscroll-contain rounded-[1.35rem] border border-border/60 bg-background/78 p-5 pr-4 shadow-[0_20px_48px_-36px_hsl(var(--app-shadow-deep)/0.2)] md:max-h-[22rem] md:min-h-[11rem] md:p-6 xl:px-7 xl:py-6",
                optionCount > 0 &&
                  optionCount <= 3 &&
                  "max-h-[22rem] md:max-h-[26rem] xl:max-h-[28rem]",
                useCompactQuestionLayout &&
                  "max-h-[13rem] rounded-[1.1rem] p-4 pr-3 shadow-[0_18px_38px_-34px_hsl(var(--app-shadow-deep)/0.18)] md:max-h-[16rem] md:min-h-[8.5rem] md:p-4 xl:max-h-[14.5rem] xl:px-5 xl:py-4",
                useCompactQuestionLayout &&
                  optionCount > 0 &&
                  optionCount <= 3 &&
                  "max-h-[16rem] md:max-h-[20rem] xl:max-h-[20rem]",
              )}
            >
              <ContentRenderer htmlContent={activeItem.promptHtml} enableImageZoom />
            </div>

            {activeItem.type === "short-text" ? (
              <div className="space-y-2">
                <RichTextEditor
                  initialContent={answerHtml}
                  onChange={setAnswerHtml}
                  editorKey={`student-live-answer-${activeItem._id}-${savedResponse?.updatedAt || "draft"}`}
                  compact
                  allowImages={false}
                />
                <p className="text-xs text-muted-foreground">
                  You can type text and math here.
                </p>
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-3 lg:grid-cols-2",
                  useCompactQuestionLayout && "gap-2 lg:grid-cols-1",
                )}
              >
                {activeItem.options.map((option) => {
                  const isSelected = selectedOptionIndexes.includes(option.index);

                  return (
                    <button
                      key={`${activeItem._id}-option-${option.index}`}
                      type="button"
                      aria-label={`Select option ${option.index + 1}`}
                      aria-pressed={isSelected}
                      onClick={() => handleOptionToggle(option.index)}
                      className={cn(
                        "w-full rounded-[1.3rem] border p-5 text-left transition-colors md:p-6",
                        useCompactQuestionLayout && "rounded-[1rem] p-4 md:p-4",
                        isSelected
                          ? "border-primary/60 bg-primary/[0.08] shadow-[0_18px_40px_-30px_hsl(var(--primary)/0.45)]"
                          : "border-border/60 bg-background/72 hover:border-primary/35 hover:bg-background",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                            isSelected
                              ? "border-primary/50 bg-primary text-primary-foreground"
                              : "border-border/60 bg-background text-foreground",
                          )}
                        >
                          {String.fromCharCode(65 + option.index)}
                        </span>
                        <div className="min-w-0 flex-1 line-clamp-1">
                          <ContentRenderer htmlContent={option.contentHtml} />
                        </div>
                        {isSelected ? (
                          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}

            <div
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-[1.15rem] border border-border/60 bg-background/74 px-5 py-4",
                useCompactQuestionLayout && "rounded-[1rem] px-4 py-3",
              )}
            >
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {savedResponse
                    ? isCorrectResponse
                      ? "Nice work"
                      : "Response saved"
                    : "Ready to submit"}
                </p>
                <p>
                  {savedResponse?.updatedAt
                    ? isCorrectResponse
                      ? "Your answer is correct."
                      : `Last updated ${formatDateTime(savedResponse.updatedAt)}`
                    : "Your answer will be saved for this class."}
                </p>
              </div>
              <Button
                type="button"
                className="app-button-page"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting
                  ? "Saving..."
                  : activeItem.type === "short-text"
                    ? "Save answer"
                    : "Submit response"}
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
            No question is open right now. Keep this page open and the next question will appear automatically.
          </div>
        )}
      </CardContent>
    </Card>
  );

  const studentJoinStreamCard = studentJoinStream ? (
    <div
      className={cn(
        "app-live-session-stream-shell overflow-hidden rounded-[1.2rem] border border-border/60 bg-black shadow-[0_24px_52px_-36px_hsl(var(--app-shadow-deep)/0.46)]",
        isFocusModeActive
          ? "app-live-session-stream-full h-full min-h-[calc(100dvh-8rem)] rounded-none border-0 shadow-none xl:min-h-[calc(100dvh-8.5rem)]"
          : "",
      )}
    >
      <div
        className={cn(
          isFocusModeActive
            ? "app-live-session-stream-stage flex h-full w-full min-h-[calc(100dvh-8rem)] items-center justify-center bg-black xl:min-h-[calc(100dvh-8.5rem)]"
            : "aspect-video w-full",
        )}
      >
        {hasStartedStream ? (
          <div className="app-live-session-stream-frame-shell relative h-full w-full">
            <iframe
              id={streamFrameId}
              src={streamEmbedUrl}
              title={`${liveSession.title} live stream`}
              className="app-live-session-stream-frame h-full w-full border-0"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; encrypted-media; picture-in-picture; web-share"
              loading="eager"
              ref={streamFrameRef}
              onLoad={() => {
                setIsStreamLoaded(true);
                requestStreamPlayback();
              }}
            />
            {!isStreamLoaded ? (
              <>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center text-sm text-white">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <p>
                    {liveSession.status === "live"
                      ? "Loading the live stream..."
                      : "The class will appear once the teacher goes live."}
                  </p>
                </div>
                {streamLoadTimedOut && studentJoinStream?.watchUrl ? (
                  <div className="absolute inset-x-0 bottom-4 flex justify-center">
                    <a
                      href={studentJoinStream.watchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold text-foreground shadow-lg"
                    >
                      Open in YouTube
                    </a>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setHasStartedStream(true);
              setIsStreamLoaded(false);
              setStreamLoadTimedOut(false);
              requestStreamPlayback();
            }}
            className={cn(
              "relative flex h-full w-full items-center justify-center bg-black",
              isFocusModeActive ? "min-h-[calc(100dvh-8rem)]" : "",
            )}
            aria-label="Start live class video"
          >
            {streamPosterUrl ? (
              <Image
                src={streamPosterUrl}
                alt=""
                fill
                unoptimized
                sizes="(min-width: 1280px) 60vw, 100vw"
                className="absolute inset-0 h-full w-full object-cover opacity-85"
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-foreground shadow-lg">
              <Play className="h-4 w-4" />
              Start
            </span>
          </button>
        )}
      </div>
    </div>
  ) : null;

  const transcriptCard = liveSession.publishedTranscriptSummary ? (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header gap-2">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <CardTitle>Class notes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Notes shared by your teacher.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="app-section-body space-y-3">
        <div className="rounded-[1.2rem] border border-border/60 bg-background/75 p-4">
          <ContentRenderer
            htmlContent={liveSession.publishedTranscriptSummary.summaryHtml}
            enableImageZoom
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Updated {formatDateTime(liveSession.publishedTranscriptSummary.updatedAt)}
        </p>
      </CardContent>
    </Card>
  ) : null;

  const accessCard = (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header gap-2">
        <CardTitle>Class details</CardTitle>
        <p className="text-sm text-muted-foreground">
          {studentJoinStream
            ? "The class video opens on this page."
            : "Use this class link if your teacher asks you to open the meeting."}
        </p>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <div className="rounded-[1rem] border border-border/60 bg-background/72 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Video className="h-4 w-4" />
            Video
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {studentJoinStream
              ? "Opens on this page."
              : liveSession.studentJoinUrlLabel}
          </p>
        </div>

        <div className="rounded-[1rem] border border-border/60 bg-background/72 p-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Start
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatDateTime(liveSession.scheduledStartAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                End
              </p>
              <p className="mt-1 font-medium text-foreground">
                {formatDateTime(liveSession.scheduledEndAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Code
              </p>
              <p className="mt-1 font-medium text-foreground">
                {liveSession.meetingCode || "Not provided"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Passcode
              </p>
              <p className="mt-1 font-medium text-foreground">
                {liveSession.meetingPasscode || "Not provided"}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            {liveSession.joinInstructions ||
              "No extra join instructions were added yet."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="app-button-page">
            <AppPrefetchLink href="/student/live-classes">
              <ArrowLeft className="h-4 w-4" />
              Back to classes
            </AppPrefetchLink>
          </Button>

          {!studentJoinStream && liveSession.canJoin ? (
            <Button asChild className="app-button-page">
              <a href={liveSession.joinHref}>
                <ExternalLink className="h-4 w-4" />
                Open class link
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  const sessionSnapshotCard = (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header gap-2">
        <CardTitle>Quick info</CardTitle>
        <p className="text-sm text-muted-foreground">
          Simple details for this class.
        </p>
      </CardHeader>
      <CardContent className="app-section-body space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="capitalize">{formatStatusLabel(liveSession.status)}</Badge>
          {liveSession.subject?.name ? (
            <Badge variant="outline">{liveSession.subject.name}</Badge>
          ) : null}
          {liveSession.hostTeacher?.name ? (
            <Badge variant="outline">{liveSession.hostTeacher.name}</Badge>
          ) : null}
          {liveSession.attendanceStatus === "present" ? (
            <Badge variant="success">Marked present</Badge>
          ) : null}
        </div>

        <div className="app-detail-grid sm:grid-cols-2">
          <div className="app-detail-item">
            <p className="app-detail-label">Attendance</p>
            <p className="app-detail-value capitalize">
              {formatStatusLabel(liveSession.attendanceStatus || "invited")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              This updates while you stay on this page.
            </p>
          </div>
          <div className="app-detail-item">
            <p className="app-detail-label">Times joined</p>
            <p className="app-detail-value">{liveSession.joinClicks}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Each time you open the class link, the count goes up.
            </p>
          </div>
        </div>

        <div className="app-detail-item">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            Updated {formatTime(lastSyncedAt)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This page updates automatically while it stays open.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const afterClassStatsCard = (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header gap-2">
        <CardTitle>Class summary</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your after-class stats and attendance.
        </p>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className="capitalize">{formatStatusLabel(liveSession.status)}</Badge>
          {liveSession.subject?.name ? (
            <Badge variant="outline">{liveSession.subject.name}</Badge>
          ) : null}
          {liveSession.hostTeacher?.name ? (
            <Badge variant="outline">{liveSession.hostTeacher.name}</Badge>
          ) : null}
          {liveSession.attendanceStatus === "present" ? (
            <Badge variant="success">Marked present</Badge>
          ) : null}
        </div>

        <div className="app-detail-grid sm:grid-cols-2">
          <div className="app-detail-item">
            <p className="app-detail-label">Start</p>
            <p className="app-detail-value">
              {formatDateTime(liveSession.scheduledStartAt)}
            </p>
          </div>
          <div className="app-detail-item">
            <p className="app-detail-label">End</p>
            <p className="app-detail-value">
              {formatDateTime(liveSession.scheduledEndAt)}
            </p>
          </div>
          <div className="app-detail-item">
            <p className="app-detail-label">Attendance</p>
            <p className="app-detail-value capitalize">
              {formatStatusLabel(liveSession.attendanceStatus || "invited")}
            </p>
          </div>
          <div className="app-detail-item">
            <p className="app-detail-label">Times joined</p>
            <p className="app-detail-value">{liveSession.joinClicks}</p>
          </div>
        </div>

        <div className="rounded-[1rem] border border-border/60 bg-background/72 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Poll performance
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="outline">{liveSession.pollAnswered}/{liveSession.pollTotal} answered</Badge>
            <Badge variant="success">{liveSession.pollCorrect} correct</Badge>
            <Badge variant="warning">
              {Math.max(0, liveSession.pollAnswered - liveSession.pollCorrect)} incorrect
            </Badge>
            {typeof liveSession.pollAccuracy === "number" ? (
              <Badge
                variant={
                  liveSession.pollAccuracy >= 85
                    ? "success"
                    : liveSession.pollAccuracy >= 60
                      ? "warning"
                      : "danger"
                }
              >
                {liveSession.pollAccuracy}% accuracy
              </Badge>
            ) : (
              <Badge variant="outline">Accuracy —</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="app-button-page">
            <AppPrefetchLink href="/student/live-classes">
              <ArrowLeft className="h-4 w-4" />
              Back to classes
            </AppPrefetchLink>
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      {showSplitCompanionStage ? (
        <>
          <div
            ref={focusStageRef}
            data-live-focus={isFocusModeActive ? "true" : "false"}
            className={cn(
              "app-live-session-focus-stage rounded-[1.75rem] border border-border/60 bg-background/76 p-4 shadow-[0_30px_80px_-44px_hsl(var(--app-shadow-deep)/0.22)]",
              isFocusModeActive
                ? "h-full w-screen overflow-auto rounded-none border-0 bg-background p-0 shadow-none"
                : "overflow-hidden",
            )}
          >
            <div
              className={cn(
                "mb-5 flex flex-wrap items-start justify-between gap-3 rounded-[1.2rem] border border-border/60 bg-background/80 px-4 py-3 shadow-[0_18px_48px_-42px_hsl(var(--app-shadow-deep)/0.26)]",
                isFocusModeActive &&
                  "sticky top-0 z-10 mb-0 rounded-none border-x-0 border-t-0 bg-background/94 px-4 py-2.5 shadow-none backdrop-blur supports-[backdrop-filter]:bg-background/90",
              )}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Class screen</p>
                <p className={cn("text-sm text-muted-foreground", isFocusModeActive && "text-xs")}>
                  {isFocusModeActive
                    ? "The video and question stay together on one full screen."
                    : "Open full screen to keep the video and question together."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={isFocusModeActive ? "outline" : "default"}
                  onClick={() => void handleFocusModeToggle()}
                  disabled={isFocusModePending || !isFocusModeAvailable}
                  className="app-button-page"
                >
                  {isFocusModeActive ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                  {isFocusModePending
                    ? "Working..."
                    : isFocusModeActive
                      ? "Exit full screen"
                      : "Full screen"}
                </Button>
              </div>
            </div>

            {focusModeError ? (
              <div className="mb-4 app-feedback app-feedback-error">{focusModeError}</div>
            ) : null}

            <div
              className={cn(
                "grid gap-5 xl:items-start",
                activeItem
                  ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.85fr)]"
                  : "xl:grid-cols-[minmax(0,1fr)]",
                isFocusModeActive &&
                  (activeItem
                    ? "min-h-[calc(100dvh-3.75rem)] grid-cols-1 gap-0 xl:grid-cols-1 xl:min-h-[calc(100dvh-3.75rem)]"
                    : "min-h-[calc(100dvh-3.75rem)] grid-cols-1 gap-0 xl:grid-cols-1 xl:min-h-[calc(100dvh-3.75rem)]"),
              )}
            >
              <div className={cn("space-y-5", isFocusModeActive && "space-y-0")}>
                {studentJoinStreamCard}
                {isSessionOver && !isFocusModeActive ? transcriptCard : null}
              </div>
              {activeItem ? (
                <div
                  className={cn(
                    "space-y-5 xl:sticky xl:top-6 xl:self-start",
                    isFocusModeActive &&
                      "max-h-[calc(100dvh-7.5rem)] overflow-auto px-4 pb-4 pt-4 xl:top-0 xl:pr-4",
                  )}
                >
                  {currentItemCard}
                </div>
              ) : null}
            </div>
          </div>

          {activeItem ? (
            isSessionOver ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
                {afterClassStatsCard}
                {transcriptCard}
              </div>
            ) : (
              <div className="flex">
                <Button asChild variant="outline" className="app-button-page">
                  <AppPrefetchLink href="/student/live-classes">
                    <ArrowLeft className="h-4 w-4" />
                    Back to classes
                  </AppPrefetchLink>
                </Button>
              </div>
            )
          ) : null}
        </>
      ) : (
        <>
          {activeItem ? currentItemCard : null}

          {hasSupportingContent ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] xl:items-start">
                <div className="space-y-5">
                  {studentJoinStreamCard}
                  {isSessionOver ? transcriptCard : null}
                </div>
                {isSessionOver ? afterClassStatsCard : accessCard}
              </div>
              {isSessionOver ? null : sessionSnapshotCard}
            </>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.92fr)]">
              {isSessionOver ? afterClassStatsCard : accessCard}
              {isSessionOver ? transcriptCard : sessionSnapshotCard}
            </div>
          )}
        </>
      )}
    </div>
  );
}
