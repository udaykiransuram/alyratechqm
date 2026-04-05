"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, ExternalLink, FileImage, FileText, Video } from "lucide-react";

import StaticContentRenderer from "@/components/StaticContentRenderer";
import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { fetchApiJson } from "@/lib/client/api";
import { buildYouTubeEmbedUrl } from "@/lib/courses/youtube";
import { formatDiaryDateLabel } from "@/lib/diary/shared";
import type { StudentDiaryDetail, DiaryStudentStateSnapshot } from "@/lib/diary/types";

type StudentDiaryDetailClientProps = {
  initialEntry: StudentDiaryDetail;
};

function renderStateLabel(status: string) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "seen") {
    return "Seen";
  }

  return "Not seen";
}

function ResourceIcon({ type }: { type: "image" | "youtube" | "file" }) {
  if (type === "image") {
    return <FileImage className="h-4 w-4" />;
  }

  if (type === "youtube") {
    return <Video className="h-4 w-4" />;
  }

  return <FileText className="h-4 w-4" />;
}

export default function StudentDiaryDetailClient({
  initialEntry,
}: StudentDiaryDetailClientProps) {
  const [entry, setEntry] = useState(initialEntry);
  const [state, setState] = useState<DiaryStudentStateSnapshot>(initialEntry.state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function markSeen() {
      if (state.status !== "not_seen") {
        return;
      }

      try {
        const payload = await fetchApiJson<{
          success: boolean;
          state: DiaryStudentStateSnapshot;
        }>(`/api/student/diary/${entry._id}/state`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            markSeen: true,
          }),
          fallbackMessage: "Failed to update the diary state.",
        });

        if (!cancelled && payload?.state) {
          setState(payload.state);
          setEntry((current) => ({
            ...current,
            state: payload.state,
          }));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "We couldn't update the diary state.",
          );
        }
      }
    }

    void markSeen();

    return () => {
      cancelled = true;
    };
  }, [entry._id, state.status]);

  const markCompleted = async () => {
    setBusy(true);
    setError(null);

    try {
      const payload = await fetchApiJson<{
        success: boolean;
        state: DiaryStudentStateSnapshot;
      }>(`/api/student/diary/${entry._id}/state`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markCompleted: true,
        }),
        fallbackMessage: "Failed to update the diary state.",
      });

      if (payload?.state) {
        setState(payload.state);
        setEntry((current) => ({
          ...current,
          state: payload.state,
        }));
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn't update the diary state.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-student-page-shell app-diary-page">
      <PageHero
        className="app-learning-hero"
        eyebrow="Student Portal"
        title={entry.title}
        variant="overview"
        density="compact"
        description={formatDiaryDateLabel(entry.entryDate) || entry.entryDate}
        actions={
          <div className="app-student-action-cluster">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="app-student-action-secondary"
            >
              <AppPrefetchLink href="/student/diary">
                <ArrowLeft className="h-4 w-4" />
                Back to Diary
              </AppPrefetchLink>
            </Button>
            <Button
              type="button"
              onClick={() => void markCompleted()}
              disabled={busy || state.status === "completed"}
              size="lg"
              className="app-student-action-primary"
            >
              <CheckCircle2 className="h-4 w-4" />
              {state.status === "completed"
                ? "Completed"
                : busy
                  ? "Updating..."
                  : "Mark Completed"}
            </Button>
          </div>
        }
        meta={
          <>
            <span className="app-meta-chip">{renderStateLabel(state.status)}</span>
            {entry.subject?.name ? (
              <span className="app-meta-chip">{entry.subject.name}</span>
            ) : null}
            {entry.class?.name ? (
              <span className="app-meta-chip">{entry.class.name}</span>
            ) : null}
            {entry.resources.length > 0 ? (
              <span className="app-meta-chip">
                {entry.resources.length} resource{entry.resources.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </>
        }
      />

      {error ? <FeedbackNotice variant="error">{error}</FeedbackNotice> : null}

      <div className="app-diary-detail-layout">
        <div className="space-y-3">
          {entry.lessonSummaryHtml ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Lesson Summary</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <StaticContentRenderer htmlContent={entry.lessonSummaryHtml} />
              </CardContent>
            </Card>
          ) : null}

          {entry.homeworkHtml ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Homework</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <StaticContentRenderer htmlContent={entry.homeworkHtml} />
              </CardContent>
            </Card>
          ) : null}

          {entry.teacherNoteHtml ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Teacher Note</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                <StaticContentRenderer htmlContent={entry.teacherNoteHtml} />
              </CardContent>
            </Card>
          ) : null}

          {entry.resources.length > 0 ? (
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Resources</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-3">
                {entry.resources.map((resource) => (
                  <div key={resource.id} className="app-diary-resource-card space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background">
                        <ResourceIcon type={resource.type} />
                      </div>
                      <div className="space-y-1">
                        <Badge variant="secondary" className="capitalize text-[11px] tracking-[0.2em]">
                          {resource.type === "youtube" ? "Video" : resource.type}
                        </Badge>
                        {resource.caption ? (
                          <p className="text-[12px] text-muted-foreground line-clamp-2">
                            {resource.caption}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {resource.type === "image" && (
                      <div className="app-diary-media-frame mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resource.url}
                          alt={resource.altText || "Diary image"}
                          className="h-[220px] w-full object-cover"
                        />
                      </div>
                    )}

                    {resource.type === "youtube" && (
                      <div className="app-diary-media-frame mt-3 overflow-hidden">
                        <iframe
                          src={buildYouTubeEmbedUrl(resource.videoId)}
                          title="Diary video"
                          className="aspect-video w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {resource.type === "file" && (
                      <div className="mt-3 rounded-[1rem] border border-border/70 bg-muted/10 px-4 py-3">
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                          {resource.fileName}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="app-course-student-sidebar">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>My Status</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-3">
              <div className="app-course-panel space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Clock3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[13px] font-semibold">{renderStateLabel(state.status)}</span>
                </div>
                {state.firstSeenAt ? (
                  <p className="text-sm text-muted-foreground">
                    Opened on {new Date(state.firstSeenAt).toLocaleString("en-IN")}
                  </p>
                ) : null}
                {state.completedAt ? (
                  <p className="text-sm text-muted-foreground">
                    Completed on {new Date(state.completedAt).toLocaleString("en-IN")}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
