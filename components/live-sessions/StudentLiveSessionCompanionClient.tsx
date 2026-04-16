"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Maximize2,
  Minimize2,
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
} from "@/lib/client/fullscreen";
import type {
  LiveSessionStudentItem,
  StudentLiveSessionDetail,
} from "@/lib/live-sessions/types";
import { resolveLiveSessionYouTubeStream } from "@/lib/live-sessions/youtube";
import { hasMeaningfulRichTextContent } from "@/lib/security/html-sanitize";
import { cn } from "@/lib/utils";

type StudentLiveSessionCompanionClientProps = {
  initialLiveSession: StudentLiveSessionDetail;
};

const LIVE_SESSION_POLL_INTERVAL_MS = 8_000;
const LIVE_SESSION_PRESENCE_INTERVAL_MS = 20_000;

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
    return "Single choice";
  }

  if (type === "multiple") {
    return "Multiple choice";
  }

  return "Short text";
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
    ? "Choose one answer and submit it while the teacher keeps this item open."
    : "Choose all answers that apply, then submit your response.";
}

export default function StudentLiveSessionCompanionClient({
  initialLiveSession,
}: StudentLiveSessionCompanionClientProps) {
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
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date().toISOString());
  const refreshInFlightRef = useRef(false);
  const presenceInFlightRef = useRef(false);
  const focusStageRef = useRef<HTMLDivElement | null>(null);

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

    const intervalId = window.setInterval(
      refreshWhenVisible,
      LIVE_SESSION_POLL_INTERVAL_MS,
    );

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
  }, [refreshLiveSession]);

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
      LIVE_SESSION_PRESENCE_INTERVAL_MS,
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
  }, [liveSession._id]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const syncFocusModeState = () => {
      setIsFocusModeAvailable(isFullscreenSupported());
      setIsFocusModeActive(document.fullscreenElement === focusStageRef.current);
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
  const hasSupportingContent = Boolean(
    studentJoinStream || liveSession.publishedTranscriptSummary,
  );
  const showSplitCompanionStage = Boolean(studentJoinStream && activeItem);
  const useCompactQuestionLayout = Boolean(activeItem && studentJoinStream);
  const savedResponse =
    activeItem && liveSession.studentResponse?.itemId === activeItem._id
      ? liveSession.studentResponse
      : null;
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
      ? "Write your response below. You can keep editing it until the teacher closes this prompt."
      : getObjectiveHelperText(activeItem.type)
    : "Stay on this page. The next live item will appear here as soon as the teacher opens it.";

  useEffect(() => {
    if (!showSplitCompanionStage && isFocusModeActive) {
      void exitCurrentFullscreen();
    }
  }, [isFocusModeActive, showSplitCompanionStage]);

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
        "Focus mode is not available in this browser. Use the normal split view instead.",
      );
      return;
    }

    setFocusModeError(null);
    setIsFocusModePending(true);

    try {
      const success = isFocusModeActive
        ? await exitCurrentFullscreen()
        : await requestElementFullscreen(focusStageRef.current);

      if (!success) {
        setFocusModeError(
          isFocusModeActive
            ? "Could not exit focus mode right now."
            : "Could not start focus mode right now.",
        );
      }
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
            <CardTitle>Current live item</CardTitle>
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
                "rounded-[1.35rem] border border-border/60 bg-background/78 p-5 shadow-[0_20px_48px_-36px_hsl(var(--app-shadow-deep)/0.2)] md:min-h-[11rem] md:p-6 xl:px-7 xl:py-6",
                useCompactQuestionLayout &&
                  "max-h-[13rem] overflow-auto rounded-[1.1rem] p-4 shadow-[0_18px_38px_-34px_hsl(var(--app-shadow-deep)/0.18)] md:min-h-[8.5rem] md:p-4 xl:max-h-[14.5rem] xl:px-5 xl:py-4",
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
                  Rich text and math are supported. Image uploads stay disabled for student answers in this version.
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
                        <div className="min-w-0 flex-1">
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
                  {savedResponse ? "Response saved" : "Ready to submit"}
                </p>
                <p>
                  {savedResponse?.updatedAt
                    ? `Last updated ${formatDateTime(savedResponse.updatedAt)}`
                    : "Your live answer stays separate from formal tests and marks."}
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
            No live item is open right now. Keep this page ready and the next prompt will appear here automatically.
          </div>
        )}
      </CardContent>
    </Card>
  );

  const studentJoinStreamCard = studentJoinStream ? (
    <div
      className={cn(
        "overflow-hidden rounded-[1.2rem] border border-border/60 bg-black shadow-[0_24px_52px_-36px_hsl(var(--app-shadow-deep)/0.46)]",
        isFocusModeActive
          ? "h-full min-h-[calc(100dvh-8rem)] rounded-none border-0 shadow-none xl:min-h-[calc(100dvh-8.5rem)]"
          : "",
      )}
    >
      <div
        className={cn(
          isFocusModeActive
            ? "flex h-full w-full min-h-[calc(100dvh-8rem)] items-center justify-center bg-black xl:min-h-[calc(100dvh-8.5rem)]"
            : "aspect-video w-full",
        )}
      >
        <iframe
          src={studentJoinStream.embedUrl}
          title={`${liveSession.title} live stream`}
          className={cn(
            "border-0",
            isFocusModeActive
              ? "aspect-video h-auto max-h-full w-full max-w-full"
              : "h-full w-full",
          )}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  ) : null;

  const transcriptCard = liveSession.publishedTranscriptSummary ? (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header gap-2">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <CardTitle>Published class summary</CardTitle>
            <p className="text-sm text-muted-foreground">
              Notes shared by the teacher for this live class.
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
        <CardTitle>Class access</CardTitle>
        <p className="text-sm text-muted-foreground">
          {studentJoinStream
            ? "The live lesson is embedded directly in this portal for students."
            : "Use the original join flow whenever you need to enter the meeting itself."}
        </p>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <div className="rounded-[1rem] border border-border/60 bg-background/72 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Video className="h-4 w-4" />
            Join flow
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {studentJoinStream
              ? "Embedded in the live-class page."
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
                Meeting code
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
              Back to live classes
            </AppPrefetchLink>
          </Button>

          {!studentJoinStream && liveSession.canJoin ? (
            <Button asChild className="app-button-page">
              <a href={liveSession.joinHref}>
                <ExternalLink className="h-4 w-4" />
                Join live class
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
        <CardTitle>Session snapshot</CardTitle>
        <p className="text-sm text-muted-foreground">
          Quick status details for your current live-class companion.
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
            <Badge variant="success">Live attendance verified</Badge>
          ) : null}
        </div>

        <div className="app-detail-grid sm:grid-cols-2">
          <div className="app-detail-item">
            <p className="app-detail-label">Attendance</p>
            <p className="app-detail-value capitalize">
              {formatStatusLabel(liveSession.attendanceStatus || "invited")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Verified after 2 minutes on this live page.
            </p>
          </div>
          <div className="app-detail-item">
            <p className="app-detail-label">Join clicks</p>
            <p className="app-detail-value">{liveSession.joinClicks}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Re-joins add to the count.
            </p>
          </div>
        </div>

        <div className="app-detail-item">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            Last synced {formatTime(lastSyncedAt)}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            This page refreshes the active item automatically while it stays open.
          </p>
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
            className={cn(
              "rounded-[1.75rem] border border-border/60 bg-background/76 p-4 shadow-[0_30px_80px_-44px_hsl(var(--app-shadow-deep)/0.22)]",
              isFocusModeActive
                ? "h-full w-full overflow-auto rounded-none border-0 bg-background p-0 shadow-none"
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
                <p className="text-sm font-semibold text-foreground">Companion stage</p>
                <p className={cn("text-sm text-muted-foreground", isFocusModeActive && "text-xs")}>
                  {isFocusModeActive
                    ? "The lesson and the current live question now stay together in one fullscreen workspace."
                    : "Open focus mode to keep the YouTube lesson and the assigned live question together on one screen."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="hidden sm:inline-flex">
                  Student companion
                </Badge>
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
                      ? "Exit focus mode"
                      : "Focus mode"}
                </Button>
              </div>
            </div>

            {focusModeError ? (
              <div className="mb-4 app-feedback app-feedback-error">{focusModeError}</div>
            ) : null}

            <div
              className={cn(
                "grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.98fr)] xl:items-start",
                isFocusModeActive &&
                  "xl:min-h-[calc(100dvh-3.75rem)] xl:grid-cols-[minmax(0,1.22fr)_minmax(18.75rem,0.78fr)] xl:gap-0",
              )}
            >
              <div className={cn("space-y-5", isFocusModeActive && "space-y-0")}>
                {studentJoinStreamCard}
                {!isFocusModeActive ? transcriptCard : null}
              </div>
              <div
                className={cn(
                  "space-y-5 xl:sticky xl:top-6 xl:self-start",
                  isFocusModeActive &&
                    "xl:top-0 xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-auto xl:pr-1",
                )}
              >
                {currentItemCard}
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.92fr)]">
            {accessCard}
            {sessionSnapshotCard}
          </div>
        </>
      ) : (
        <>
          {currentItemCard}

          {hasSupportingContent ? (
            <>
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] xl:items-start">
                <div className="space-y-5">
                  {studentJoinStreamCard}
                  {transcriptCard}
                </div>
                {accessCard}
              </div>
              {sessionSnapshotCard}
            </>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.92fr)]">
              {accessCard}
              {sessionSnapshotCard}
            </div>
          )}
        </>
      )}
    </div>
  );
}
