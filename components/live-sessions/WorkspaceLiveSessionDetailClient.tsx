"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Copy, FileText, Layers3, MessagesSquare, MoveUp, MoveDown } from "lucide-react";
import { useRouter } from "next/navigation";

import { ContentRenderer } from "@/components/ContentRenderer";
import LiveSessionYouTubeEmbedPanel from "@/components/live-sessions/LiveSessionYouTubeEmbedPanel";
import LiveSessionItemEditorDialog from "@/components/live-sessions/LiveSessionItemEditorDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  LiveSessionItemResponsePage,
  LiveSessionTeacherItem,
  WorkspaceLiveSessionDetail,
} from "@/lib/live-sessions/types";
import { resolveLiveSessionYouTubeStream } from "@/lib/live-sessions/youtube";

import RichTextEditor from "../RichTextEditor";

type WorkspaceLiveSessionDetailClientProps = {
  liveSession: WorkspaceLiveSessionDetail;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLabel(value: string) {
  return String(value || "").replace(/_/g, " ");
}

function getItemTypeLabel(type: LiveSessionTeacherItem["type"]) {
  if (type === "single") {
    return "Single choice";
  }

  if (type === "multiple") {
    return "Multiple choice";
  }

  return "Short text";
}

function getAbsoluteShareLink(shareHref: string) {
  if (typeof window === "undefined") {
    return shareHref;
  }

  return new URL(shareHref, window.location.origin).toString();
}

function ItemStats({ item }: { item: LiveSessionTeacherItem }) {
  const accuracy =
    item.correctCount !== null && item.responseCount > 0
      ? Math.round((item.correctCount / item.responseCount) * 100)
      : null;
  const accuracyVariant =
    accuracy === null
      ? "outline"
      : accuracy >= 85
        ? "success"
        : accuracy >= 60
          ? "warning"
          : "danger";

  return (
    <div className="flex flex-wrap gap-2">
      <Badge
        variant="outline"
        className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
      >
        {item.responseCount} responses
      </Badge>
      {item.correctCount !== null ? (
        <>
          <Badge
            variant="outline"
            className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
          >
            {item.correctCount} correct
          </Badge>
          <Badge
            variant="outline"
            className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
          >
            {item.incorrectCount || 0} incorrect
          </Badge>
          {accuracy !== null ? (
            <Badge
              variant={accuracyVariant}
              className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
            >
              {accuracy}% accuracy
            </Badge>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ItemOptionStats({ item }: { item: LiveSessionTeacherItem }) {
  if (item.type === "short-text" || item.options.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {item.options.map((option) => {
        const stat = item.optionStats.find(
          (entry) => entry.optionIndex === option.index,
        );
        const isCorrect = item.answerIndexes.includes(option.index);

        return (
          <div
            key={`${item._id}-option-${option.index}`}
            className="rounded-[1.15rem] border border-border/60 bg-background/72 p-4 shadow-[0_14px_34px_-28px_hsl(var(--app-shadow-deep)/0.2)]"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={isCorrect ? "default" : "outline"}
                  className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
                >
                  Option {option.index + 1}
                </Badge>
                {isCorrect ? (
                  <Badge
                    variant="outline"
                    className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
                  >
                    Correct answer
                  </Badge>
                ) : null}
              </div>
              <span className="text-xs font-medium text-muted-foreground">
                {stat?.responseCount || 0} responses
              </span>
            </div>
            <ContentRenderer htmlContent={option.contentHtml} />
          </div>
        );
      })}
    </div>
  );
}

function LiveItemCard({
  item,
  children,
}: {
  item: LiveSessionTeacherItem;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-border/70 bg-[hsl(var(--app-surface-1)/0.82)] p-5 shadow-[0_28px_70px_-48px_hsl(var(--app-shadow-deep)/0.24)] md:p-6">
      <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold"
            >
              {getItemTypeLabel(item.type)}
            </Badge>
            <Badge className="min-h-8 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold capitalize">
              {formatLabel(item.status)}
            </Badge>
          </div>
          <ItemStats item={item} />
        </div>
        <div className="rounded-[1.05rem] border border-border/60 bg-background/60 px-3 py-2 text-left text-xs text-muted-foreground md:min-w-[12rem] md:text-right">
          <p>Opened {formatDateTime(item.openedAt)}</p>
          <p>Updated {formatDateTime(item.updatedAt)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[1.2rem] border border-border/60 bg-background/78 p-5 shadow-[inset_0_1px_0_hsl(var(--background)/0.45)] md:min-h-[11rem] md:p-6 xl:px-7 xl:py-6">
          <ContentRenderer htmlContent={item.promptHtml} />
        </div>

        <ItemOptionStats item={item} />

        {item.explanationHtml ? (
          <div className="rounded-[1.2rem] border border-border/60 bg-background/74 p-5 md:p-6 xl:px-7 xl:py-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Explanation
            </p>
            <ContentRenderer htmlContent={item.explanationHtml} />
          </div>
        ) : null}

        {children ? <div className="border-t border-border/50 pt-4">{children}</div> : null}
      </div>
    </div>
  );
}

export default function WorkspaceLiveSessionDetailClient({
  liveSession,
}: WorkspaceLiveSessionDetailClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LiveSessionTeacherItem | null>(null);
  const [responseViewerItem, setResponseViewerItem] =
    useState<LiveSessionTeacherItem | null>(null);
  const [responsePage, setResponsePage] = useState<LiveSessionItemResponsePage | null>(
    null,
  );
  const [responseFilter, setResponseFilter] = useState<
    "all" | "correct" | "incorrect"
  >("all");
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);
  const [rawTranscript, setRawTranscript] = useState(liveSession.transcript?.rawText || "");
  const [summaryHtml, setSummaryHtml] = useState(
    liveSession.transcript?.summaryHtml || "",
  );
  const [isTranscriptPublished, setIsTranscriptPublished] = useState(
    Boolean(liveSession.transcript?.isPublished),
  );
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);

  const filteredResponses = useMemo(() => {
    const responses = responsePage?.responses || [];
    if (responseFilter === "all") {
      return responses;
    }

    if (responseFilter === "correct") {
      return responses.filter((response) => response.isCorrect === true);
    }

    return responses.filter((response) => response.isCorrect === false);
  }, [responsePage, responseFilter]);

  const responseSummary = useMemo(() => {
    if (!responseViewerItem) {
      return null;
    }
    const total = responseViewerItem.responseCount;
    const correct =
      responseViewerItem.correctCount !== null ? responseViewerItem.correctCount : null;
    const incorrect =
      responseViewerItem.incorrectCount !== null ? responseViewerItem.incorrectCount : null;
    const accuracy =
      correct !== null && total > 0 ? Math.round((correct / total) * 100) : null;
    return { total, correct, incorrect, accuracy };
  }, [responseViewerItem]);

  useEffect(() => {
    setRawTranscript(liveSession.transcript?.rawText || "");
    setSummaryHtml(liveSession.transcript?.summaryHtml || "");
    setIsTranscriptPublished(Boolean(liveSession.transcript?.isPublished));
  }, [
    liveSession.transcript?.isPublished,
    liveSession.transcript?.rawText,
    liveSession.transcript?.summaryHtml,
  ]);

  const draftItems = useMemo(
    () =>
      liveSession.items
        .filter((item) => item.status === "draft")
        .sort((left, right) => left.order - right.order),
    [liveSession.items],
  );
  const historyItems = useMemo(
    () =>
      liveSession.items
        .filter((item) => item.status !== "draft" && item._id !== liveSession.activeItem?._id)
        .sort((left, right) => {
          const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
          const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
          return rightTime - leftTime;
        }),
    [liveSession.activeItem?._id, liveSession.items],
  );
  const studentJoinStream = useMemo(
    () => resolveLiveSessionYouTubeStream(liveSession.studentJoinUrl),
    [liveSession.studentJoinUrl],
  );
  const hostJoinStream = useMemo(
    () => resolveLiveSessionYouTubeStream(liveSession.hostJoinUrl),
    [liveSession.hostJoinUrl],
  );
  const showDistinctHostStream = Boolean(
    hostJoinStream && hostJoinStream.videoId !== studentJoinStream?.videoId,
  );

  async function handleMutation(url: string, init?: RequestInit) {
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setError(String(payload?.message || "Action failed.").trim());
        setIsWorking(false);
        return null;
      }

      startTransition(() => {
        router.refresh();
      });
      setIsWorking(false);
      return payload;
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Action failed.",
      );
      setIsWorking(false);
      return null;
    }
  }

  async function handleStart() {
    const payload = await handleMutation(`/api/live-sessions/${liveSession._id}/start`, {
      method: "POST",
    });
    const joinUrl = String(payload?.joinUrl || "").trim();
    if (joinUrl) {
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleEnd() {
    await handleMutation(`/api/live-sessions/${liveSession._id}/end`, {
      method: "POST",
    });
  }

  async function handleCancel() {
    const cancelReason =
      window.prompt(
        "Why are you cancelling this live class?",
        liveSession.cancelReason || "",
      ) || "";

    await handleMutation(`/api/live-sessions/${liveSession._id}/cancel`, {
      method: "POST",
      body: JSON.stringify({
        cancelReason,
      }),
    });
  }

  async function handleDelete() {
    if (!window.confirm("Delete this draft live class?")) {
      return;
    }

    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch(`/api/live-sessions/${liveSession._id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setError(String(payload?.message || "Delete failed.").trim());
        setIsWorking(false);
        return;
      }

      router.push("/workspace/live-classes");
      startTransition(() => {
        router.refresh();
      });
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Delete failed.",
      );
    } finally {
      setIsWorking(false);
    }
  }

  async function handleAttendanceUpdate(
    studentId: string,
    status: "present" | "absent",
  ) {
    setActiveStudentId(studentId);
    setError(null);

    try {
      const response = await fetch(`/api/live-sessions/${liveSession._id}/attendance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attendance: [{ studentId, status }],
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setError(String(payload?.message || "Attendance update failed.").trim());
        setActiveStudentId(null);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (attendanceError) {
      setError(
        attendanceError instanceof Error
          ? attendanceError.message
          : "Attendance update failed.",
      );
    } finally {
      setActiveStudentId(null);
    }
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(getAbsoluteShareLink(liveSession.shareHref));
      setError(null);
    } catch {
      setError("Could not copy the student share link.");
    }
  }

  function openCreateItemDialog() {
    setEditingItem(null);
    setIsItemEditorOpen(true);
  }

  function openEditItemDialog(item: LiveSessionTeacherItem) {
    setEditingItem(item);
    setIsItemEditorOpen(true);
  }

  async function handleDraftReorder(itemId: string, direction: -1 | 1) {
    const currentIndex = draftItems.findIndex((item) => item._id === itemId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= draftItems.length) {
      return;
    }

    const nextOrder = [...draftItems.map((item) => item._id)];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];

    await handleMutation(`/api/live-sessions/${liveSession._id}/items/reorder`, {
      method: "PATCH",
      body: JSON.stringify({
        orderedItemIds: nextOrder,
      }),
    });
  }

  async function handleActivateItem(itemId: string) {
    await handleMutation(`/api/live-sessions/${liveSession._id}/items/${itemId}/activate`, {
      method: "POST",
    });
  }

  async function handleCloseItem(itemId: string) {
    await handleMutation(`/api/live-sessions/${liveSession._id}/items/${itemId}/close`, {
      method: "POST",
    });
  }

  async function handleArchiveItem(itemId: string) {
    await handleMutation(`/api/live-sessions/${liveSession._id}/items/${itemId}/archive`, {
      method: "POST",
    });
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm("Delete this draft live item?")) {
      return;
    }

    await handleMutation(`/api/live-sessions/${liveSession._id}/items/${itemId}`, {
      method: "DELETE",
    });
  }

  async function loadResponses(item: LiveSessionTeacherItem, page = 1) {
    setError(null);
    setIsLoadingResponses(true);
    setResponseViewerItem(item);
    setResponseFilter("all");

    try {
      const response = await fetch(
        `/api/live-sessions/${liveSession._id}/items/${item._id}/responses?page=${page}&limit=8`,
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success || !payload?.responsePage) {
        setError(String(payload?.message || "Failed to load responses.").trim());
        setIsLoadingResponses(false);
        return;
      }

      setResponsePage(payload.responsePage as LiveSessionItemResponsePage);
    } catch (responseError) {
      setError(
        responseError instanceof Error
          ? responseError.message
          : "Failed to load responses.",
      );
    } finally {
      setIsLoadingResponses(false);
    }
  }

  async function handleTranscriptSave() {
    setError(null);
    setIsSavingTranscript(true);

    try {
      const response = await fetch(`/api/live-sessions/${liveSession._id}/transcript`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rawText: rawTranscript,
          summaryHtml,
          isPublished: isTranscriptPublished,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setError(String(payload?.message || "Failed to save the transcript.").trim());
        setIsSavingTranscript(false);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (transcriptError) {
      setError(
        transcriptError instanceof Error
          ? transcriptError.message
          : "Failed to save the transcript.",
      );
    } finally {
      setIsSavingTranscript(false);
    }
  }

  async function handleTranscriptFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      setRawTranscript(text);
    } catch {
      setError("Could not read the transcript file.");
    }
  }

  return (
    <>
      <div className="space-y-5">
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Session Operations</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Run the host flow, share the student companion link, and keep attendance updated.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="capitalize">{formatLabel(liveSession.status)}</Badge>
                {liveSession.hostTeacher?.name ? (
                  <Badge variant="outline">{liveSession.hostTeacher.name}</Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="app-section-body space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Start
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatDateTime(liveSession.scheduledStartAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  End
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {formatDateTime(liveSession.scheduledEndAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Audience
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {liveSession.audienceCount} students
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Active item
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {liveSession.activeItem ? getItemTypeLabel(liveSession.activeItem.type) : "None live"}
                </p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                <p className="font-semibold text-foreground">Meeting details</p>
                <div className="mt-3 space-y-2 text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">Student link:</span>{" "}
                    {liveSession.studentJoinUrl || "Not added"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Host link:</span>{" "}
                    {liveSession.hostJoinUrl || "Uses student link"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Meeting code:</span>{" "}
                    {liveSession.meetingCode || "Not added"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Passcode:</span>{" "}
                    {liveSession.meetingPasscode || "Not added"}
                  </p>
                </div>
                {studentJoinStream || showDistinctHostStream ? (
                  <div className="mt-4 space-y-3">
                    {studentJoinStream ? (
                      <LiveSessionYouTubeEmbedPanel
                        stream={studentJoinStream}
                        title="Student stream preview"
                        description="Students can watch the YouTube Live stream in the portal while keeping the companion page open for live prompts."
                        iframeTitle={`${liveSession.title} student stream preview`}
                        actionLabel="Open student stream"
                      />
                    ) : null}
                    {showDistinctHostStream && hostJoinStream ? (
                      <LiveSessionYouTubeEmbedPanel
                        stream={hostJoinStream}
                        title="Host stream preview"
                        description="Quick preview of the separate host link. The existing start flow still opens the configured host URL in a new tab."
                        iframeTitle={`${liveSession.title} host stream preview`}
                        actionLabel="Open host stream"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Student companion link</p>
                    <p className="mt-1 text-muted-foreground">
                      Paste this signed-in student page into class chat so learners can answer live items alongside the stream.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyShareLink}
                  >
                    <Copy className="h-4 w-4" />
                    Copy link
                  </Button>
                </div>
                <p className="mt-3 break-all rounded-[0.9rem] border border-dashed border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                  {getAbsoluteShareLink(liveSession.shareHref)}
                </p>
                <p className="mt-3 leading-6 text-muted-foreground">
                  {liveSession.joinInstructions ||
                    "No extra join instructions were added for students yet."}
                </p>
              </div>
            </div>

            {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}

	            <div className="grid gap-2 sm:flex sm:flex-wrap">
	              {liveSession.status === "scheduled" ? (
	                <Button
	                  type="button"
	                  className="app-button-page"
	                  size="sm"
	                  onClick={handleStart}
	                  disabled={isWorking}
	                >
	                  Start live class
                </Button>
              ) : null}

              {liveSession.status === "live" ? (
	                <Button
	                  type="button"
	                  className="app-button-page"
	                  size="sm"
	                  onClick={handleEnd}
	                  disabled={isWorking}
	                >
	                  End live class
                </Button>
              ) : null}

              {liveSession.status === "draft" ? (
	                <Button
	                  type="button"
	                  variant="destructive"
	                  className="app-button-page"
	                  size="sm"
	                  onClick={handleDelete}
	                  disabled={isWorking}
	                >
	                  Delete draft
                </Button>
              ) : null}

              {liveSession.status !== "completed" && liveSession.status !== "cancelled" ? (
	                <Button
	                  type="button"
	                  variant="outline"
	                  className="app-button-page"
	                  size="sm"
	                  onClick={handleCancel}
	                  disabled={isWorking}
	                >
                  Cancel session
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Live Items</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Queue draft items, activate them one at a time, and review live participation.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="app-button-page"
                  onClick={openCreateItemDialog}
                >
                  <Layers3 className="h-4 w-4" />
                  Create live item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="app-section-body space-y-6">
              {liveSession.activeItem ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Live now</p>
                      <p className="text-xs text-muted-foreground">
                        Students opening the share link will see this item immediately.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCloseItem(liveSession.activeItem!._id)}
                      disabled={isWorking}
                    >
                      Close item
                    </Button>
                  </div>
                  <LiveItemCard item={liveSession.activeItem}>
	                    <div className="grid gap-2 sm:flex sm:flex-wrap">
	                      {liveSession.activeItem.responseCount > 0 ? (
	                        <Button
	                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void loadResponses(liveSession.activeItem!, 1)}
                          disabled={isLoadingResponses}
                        >
                          <MessagesSquare className="h-4 w-4" />
                          View responses
                        </Button>
                      ) : null}
                    </div>
                  </LiveItemCard>
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  No live item is active yet. Activate a draft item when you want students to answer it.
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Draft queue</p>
                  <p className="text-xs text-muted-foreground">
                    Only draft items can be edited, reordered, activated, or deleted.
                  </p>
                </div>

                {draftItems.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                    No draft live items yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {draftItems.map((item, index) => (
                      <LiveItemCard key={item._id} item={item}>
	                        <div className="grid gap-2 sm:flex sm:flex-wrap">
	                          <Button
	                            type="button"
	                            size="sm"
	                            variant="outline"
	                            className="w-full sm:w-auto"
	                            onClick={() => openEditItemDialog(item)}
	                            disabled={isWorking}
	                          >
                            Edit
                          </Button>
	                          <Button
	                            type="button"
	                            size="sm"
	                            className="w-full sm:w-auto"
	                            onClick={() => handleActivateItem(item._id)}
	                            disabled={isWorking}
	                          >
                            Activate
                          </Button>
	                          <Button
	                            type="button"
	                            size="sm"
	                            variant="outline"
	                            className="w-full sm:w-auto"
	                            onClick={() => handleDraftReorder(item._id, -1)}
	                            disabled={isWorking || index === 0}
	                          >
                            <MoveUp className="h-4 w-4" />
                            Move up
                          </Button>
	                          <Button
	                            type="button"
	                            size="sm"
	                            variant="outline"
	                            className="w-full sm:w-auto"
	                            onClick={() => handleDraftReorder(item._id, 1)}
	                            disabled={isWorking || index === draftItems.length - 1}
	                          >
                            <MoveDown className="h-4 w-4" />
                            Move down
                          </Button>
	                          <Button
	                            type="button"
	                            size="sm"
	                            variant="ghost"
	                            className="w-full sm:w-auto"
	                            onClick={() => handleDeleteItem(item._id)}
	                            disabled={isWorking}
	                          >
                            Delete
                          </Button>
                        </div>
                      </LiveItemCard>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">History</p>
                  <p className="text-xs text-muted-foreground">
                    Closed items remain immutable. Archive them if you no longer want them visible here.
                  </p>
                </div>

                {historyItems.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                    No live-item history yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {historyItems.map((item) => (
                      <LiveItemCard key={item._id} item={item}>
	                        <div className="grid gap-2 sm:flex sm:flex-wrap">
	                          {item.responseCount > 0 ? (
	                            <Button
	                              type="button"
	                              size="sm"
	                              variant="outline"
	                              className="w-full sm:w-auto"
	                              onClick={() => void loadResponses(item, 1)}
	                              disabled={isLoadingResponses}
	                            >
                              <MessagesSquare className="h-4 w-4" />
                              View responses
                            </Button>
                          ) : null}
                          {item.status !== "archived" ? (
	                            <Button
	                              type="button"
	                              size="sm"
	                              variant="ghost"
	                              className="w-full sm:w-auto"
	                              onClick={() => handleArchiveItem(item._id)}
	                              disabled={isWorking}
	                            >
                              Archive
                            </Button>
                          ) : null}
                        </div>
                      </LiveItemCard>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

	        <Card className="app-surface overflow-hidden">
	          <CardHeader className="app-section-header gap-2">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Transcript and Summary</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Paste or import transcript text, then publish a cleaned student-facing summary when you are ready.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label htmlFor="live-session-transcript">Raw transcript</Label>
                  <label className="inline-flex cursor-pointer items-center rounded-[var(--app-radius-sm)] border border-border/70 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent/50">
                    Import text file
                    <input
                      type="file"
                      accept=".txt,.md,.text"
                      className="sr-only"
                      onChange={handleTranscriptFileChange}
                    />
                  </label>
                </div>
                <Textarea
                  id="live-session-transcript"
                  value={rawTranscript}
                  onChange={(event) => setRawTranscript(event.target.value)}
                  rows={10}
                  placeholder="Paste the raw meeting transcript or notes here."
                  disabled={isSavingTranscript}
                />
              </div>

              <div className="space-y-2">
                <Label>Student summary</Label>
                <RichTextEditor
                  initialContent={summaryHtml}
                  onChange={setSummaryHtml}
                  editorKey={`transcript-summary-${liveSession._id}-${liveSession.transcript?.updatedAt || "draft"}`}
                  compact
                  imageUploadEndpoint="/api/live-sessions/images"
                />
              </div>

              <label className="flex items-center gap-3 rounded-[1rem] border border-border/60 bg-background/70 px-3 py-3 text-sm">
                <Checkbox
                  checked={isTranscriptPublished}
                  onCheckedChange={(checked) => setIsTranscriptPublished(Boolean(checked))}
                  disabled={isSavingTranscript}
                />
                Publish this summary to the student companion page
              </label>

              <Button
                type="button"
                className="w-full"
                onClick={handleTranscriptSave}
                disabled={isSavingTranscript}
              >
                {isSavingTranscript ? "Saving transcript..." : "Save transcript"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Attendance</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Join clicks are logged automatically. Mark final attendance when the session ends.
                </p>
              </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{liveSession.audienceCount} students</Badge>
              <Badge variant="outline">{liveSession.joinedCount} joined</Badge>
              <Badge variant="outline">{liveSession.presentCount} present</Badge>
              <Badge variant="outline">{liveSession.absentCount} absent</Badge>
            </div>
          </div>
        </CardHeader>
	          <CardContent className="app-section-body space-y-4">
              <div className="app-detail-grid sm:grid-cols-2 lg:grid-cols-4">
                <div className="app-detail-item">
                  <p className="app-detail-label">Audience</p>
                  <p className="app-detail-value">{liveSession.audienceCount}</p>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Joined</p>
                  <p className="app-detail-value">{liveSession.joinedCount}</p>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Present</p>
                  <p className="app-detail-value">{liveSession.presentCount}</p>
                </div>
                <div className="app-detail-item">
                  <p className="app-detail-label">Absent</p>
                  <p className="app-detail-value">{liveSession.absentCount}</p>
                </div>
              </div>
	            {liveSession.attendance.length === 0 ? (
	              <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
	                No students are targeted by this live class yet.
	              </div>
	            ) : (
	              <>
	                <div className="space-y-3 lg:hidden">
	                  {liveSession.attendance.map((item) => (
	                    <div
	                      key={`mobile-${item.studentId}`}
	                      className="rounded-[1rem] border border-border/60 bg-background/70 p-3"
	                    >
	                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
	                        <div className="space-y-1">
	                          <p className="text-sm font-semibold text-foreground">{item.studentName}</p>
	                          <p className="text-xs text-muted-foreground">
	                            {item.rollNumber ? `Roll ${item.rollNumber}` : "No roll number"}
	                            {item.academicSectionName ? ` • ${item.academicSectionName}` : ""}
	                          </p>
	                        </div>
	                        <Badge className="capitalize">{formatLabel(item.status)}</Badge>
	                      </div>
	                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Join clicks: {item.joinClicks}</p>
                        <p>First seen: {formatDateTime(item.firstJoinedAt)}</p>
                        <p>Last seen: {formatDateTime(item.lastJoinedAt)}</p>
                        <p>
                          Marked by:{" "}
                          {item.markedByName
                            ? `${item.markedByName} • ${formatDateTime(item.markedAt)}`
                            : "Not marked"}
                        </p>
	                      </div>
	                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
	                        <Button
	                          type="button"
	                          size="sm"
	                          variant={item.status === "present" ? "default" : "outline"}
	                          className="app-button-compact w-full"
	                          disabled={activeStudentId === item.studentId}
	                          onClick={() => handleAttendanceUpdate(item.studentId, "present")}
	                        >
	                          Present
	                        </Button>
	                        <Button
	                          type="button"
	                          size="sm"
	                          variant={item.status === "absent" ? "default" : "outline"}
	                          className="app-button-compact w-full"
	                          disabled={activeStudentId === item.studentId}
	                          onClick={() => handleAttendanceUpdate(item.studentId, "absent")}
	                        >
	                          Absent
	                        </Button>
	                      </div>
	                    </div>
	                  ))}
	                </div>

	                <div className="hidden lg:block app-table-wrap app-table-dense">
	                  <Table>
	                    <TableHeader>
	                      <TableRow>
	                        <TableHead>Student</TableHead>
	                        <TableHead>Status</TableHead>
	                        <TableHead>Join clicks</TableHead>
	                        <TableHead>First seen</TableHead>
	                        <TableHead>Last seen</TableHead>
	                        <TableHead>Marked by</TableHead>
	                        <TableHead className="text-right">Actions</TableHead>
	                      </TableRow>
	                    </TableHeader>
	                    <TableBody>
	                      {liveSession.attendance.map((item) => (
	                        <TableRow key={item.studentId}>
	                          <TableCell>
	                            <div className="space-y-1">
	                              <p className="font-medium text-foreground">{item.studentName}</p>
	                              <p className="text-xs text-muted-foreground">
	                                {item.rollNumber ? `Roll ${item.rollNumber}` : "No roll number"}
	                                {item.academicSectionName ? ` • ${item.academicSectionName}` : ""}
	                              </p>
	                            </div>
	                          </TableCell>
	                          <TableCell>
	                            <Badge className="capitalize">{formatLabel(item.status)}</Badge>
	                          </TableCell>
	                          <TableCell>{item.joinClicks}</TableCell>
	                          <TableCell>{formatDateTime(item.firstJoinedAt)}</TableCell>
	                          <TableCell>{formatDateTime(item.lastJoinedAt)}</TableCell>
	                          <TableCell>
	                            {item.markedByName
	                              ? `${item.markedByName} • ${formatDateTime(item.markedAt)}`
	                              : "Not marked"}
	                          </TableCell>
	                          <TableCell className="text-right">
	                            <div className="flex justify-end gap-2">
	                              <Button
	                                type="button"
	                                size="sm"
	                                variant={item.status === "present" ? "default" : "outline"}
	                                className="app-button-compact"
	                                disabled={activeStudentId === item.studentId}
	                                onClick={() => handleAttendanceUpdate(item.studentId, "present")}
	                              >
	                                Present
	                              </Button>
	                              <Button
	                                type="button"
	                                size="sm"
	                                variant={item.status === "absent" ? "default" : "outline"}
	                                className="app-button-compact"
	                                disabled={activeStudentId === item.studentId}
	                                onClick={() => handleAttendanceUpdate(item.studentId, "absent")}
	                              >
	                                Absent
	                              </Button>
	                            </div>
	                          </TableCell>
	                        </TableRow>
	                      ))}
	                    </TableBody>
	                  </Table>
	                </div>
	              </>
	            )}
	          </CardContent>
	        </Card>
      </div>

      <LiveSessionItemEditorDialog
        liveSessionId={liveSession._id}
        open={isItemEditorOpen}
        onOpenChange={setIsItemEditorOpen}
        item={editingItem}
        onSaved={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      <Dialog
        open={Boolean(responseViewerItem)}
        onOpenChange={(open) => {
          if (!open) {
            setResponseViewerItem(null);
            setResponsePage(null);
          }
        }}
      >
        <DialogContent className="max-w-[min(92vw,64rem)]">
          <DialogHeader>
            <DialogTitle>Live responses</DialogTitle>
            <DialogDescription>
              Review submitted responses for the selected live item.
            </DialogDescription>
          </DialogHeader>

          {responseViewerItem ? (
            <div className="space-y-4">
              <div className="rounded-[1rem] border border-border/60 bg-background/72 p-3">
                <ContentRenderer htmlContent={responseViewerItem.promptHtml} />
              </div>

              {responseSummary ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-border/60 bg-background/72 px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {responseSummary.total} responses
                    </Badge>
                    {responseSummary.correct !== null ? (
                      <Badge variant="success">
                        {responseSummary.correct} correct
                      </Badge>
                    ) : null}
                    {responseSummary.incorrect !== null ? (
                      <Badge variant="warning">
                        {responseSummary.incorrect} incorrect
                      </Badge>
                    ) : null}
                    {responseSummary.accuracy !== null ? (
                      <Badge
                        variant={
                          responseSummary.accuracy >= 85
                            ? "success"
                            : responseSummary.accuracy >= 60
                              ? "warning"
                              : "danger"
                        }
                      >
                        {responseSummary.accuracy}% accuracy
                      </Badge>
                    ) : null}
                  </div>
                  {responseViewerItem.type !== "short-text" ? (
                    <div className="flex flex-wrap gap-2">
                      {(["all", "correct", "incorrect"] as const).map((value) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={responseFilter === value ? "default" : "outline"}
                          className="app-button-compact"
                          onClick={() => setResponseFilter(value)}
                        >
                          {value === "all"
                            ? "All"
                            : value === "correct"
                              ? "Correct"
                              : "Needs review"}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isLoadingResponses ? (
                <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  Loading responses...
                </div>
              ) : filteredResponses.length ? (
                <div className="space-y-4">
                  {filteredResponses.map((response) => (
                    <div
                      key={`${response.studentId}-${response.updatedAt || "response"}`}
                      className={`rounded-[1rem] border bg-background/70 p-3 ${
                        response.isCorrect === true
                          ? "border-emerald-300/60"
                          : response.isCorrect === false
                            ? "border-amber-300/70"
                            : "border-border/60"
                      }`}
                    >
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{response.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {response.rollNumber ? `Roll ${response.rollNumber}` : "No roll number"}
                            {response.academicSectionName
                              ? ` • ${response.academicSectionName}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">
                            Submitted {formatDateTime(response.submittedAt)}
                          </Badge>
                          {response.isCorrect !== null ? (
                            <Badge variant={response.isCorrect ? "default" : "outline"}>
                              {response.isCorrect ? "Correct" : "Needs review"}
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {responseViewerItem.type === "short-text" ? (
                        response.answerHtml ? (
                          <div className="rounded-[0.9rem] border border-border/60 bg-background/72 p-3">
                            <ContentRenderer htmlContent={response.answerHtml} />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No answer submitted.</p>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Selected options:{" "}
                          {response.selectedOptionIndexes.length > 0
                            ? response.selectedOptionIndexes
                                .map((value) => `Option ${value + 1}`)
                                .join(", ")
                            : "No option selected"}
                        </p>
                      )}
                    </div>
                  ))}

                  {responsePage && responsePage.pages > 1 ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        Page {responsePage.page} of {responsePage.pages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void loadResponses(responseViewerItem, responsePage.page - 1)
                          }
                          disabled={responsePage.page <= 1 || isLoadingResponses}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void loadResponses(responseViewerItem, responsePage.page + 1)
                          }
                          disabled={
                            responsePage.page >= responsePage.pages || isLoadingResponses
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-[1rem] border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  {responsePage?.responses.length
                    ? "No responses match the selected filter."
                    : "No responses have been submitted for this live item yet."}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
