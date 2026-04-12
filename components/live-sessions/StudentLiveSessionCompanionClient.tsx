"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  RefreshCw,
  Video,
} from "lucide-react";

import { ContentRenderer } from "@/components/ContentRenderer";
import RichTextEditor from "@/components/RichTextEditor";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  LiveSessionStudentItem,
  StudentLiveSessionDetail,
} from "@/lib/live-sessions/types";
import { hasMeaningfulRichTextContent } from "@/lib/security/html-sanitize";
import { cn } from "@/lib/utils";

type StudentLiveSessionCompanionClientProps = {
  initialLiveSession: StudentLiveSessionDetail;
};

const LIVE_SESSION_POLL_INTERVAL_MS = 8_000;

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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date().toISOString());
  const refreshInFlightRef = useRef(false);

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

  const activeItem = liveSession.activeItem;
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

  return (
    <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-5">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-3">
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
          <CardContent className="app-section-body space-y-4">
            {activeItem ? (
              <>
                <div className="rounded-[1.2rem] border border-border/60 bg-background/75 p-4">
                  <ContentRenderer
                    htmlContent={activeItem.promptHtml}
                    enableImageZoom
                  />
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
                  <div className="space-y-3">
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
                            "w-full rounded-[1.2rem] border p-4 text-left transition-colors",
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

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/60 bg-background/72 px-4 py-3">
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

        {liveSession.publishedTranscriptSummary ? (
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
        ) : null}
      </div>

      <div className="space-y-5">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <CardTitle>Class access</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use the original join flow whenever you need to enter the meeting itself.
            </p>
          </CardHeader>
          <CardContent className="app-section-body space-y-4">
            <div className="rounded-[1rem] border border-border/60 bg-background/72 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Video className="h-4 w-4" />
                Join flow
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {liveSession.studentJoinUrlLabel}
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

              {liveSession.canJoin ? (
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
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-border/60 bg-background/72 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Attendance
                </p>
                <p className="mt-2 font-medium text-foreground capitalize">
                  {formatStatusLabel(liveSession.attendanceStatus || "invited")}
                </p>
              </div>
              <div className="rounded-[1rem] border border-border/60 bg-background/72 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Join clicks
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {liveSession.joinClicks}
                </p>
              </div>
            </div>

            <div className="rounded-[1rem] border border-border/60 bg-background/72 px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Clock3 className="h-4 w-4 text-primary" />
                Last synced {formatTime(lastSyncedAt)}
              </div>
              <p className="mt-2 leading-6">
                This page refreshes the active item automatically while it stays open.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
