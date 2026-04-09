import { ArrowLeft, Edit } from "lucide-react";

import StaticContentRenderer from "@/components/StaticContentRenderer";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import DiaryArchiveButton from "@/components/workspace/diary/DiaryArchiveButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildYouTubeEmbedUrl } from "@/lib/courses/youtube";
import { formatDiaryDateLabel } from "@/lib/diary/shared";
import { buildHrefWithReturnTo, getSafeReturnToPath } from "@/lib/navigation/returnTo";
import { getWorkspaceDiaryById } from "@/lib/server/diary";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";


type WorkspaceDiaryPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

function formatStateLabel(status: string) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "seen") {
    return "Seen";
  }

  return "Not seen";
}

function getStateBadgeVariant(status: string) {
  if (status === "completed") {
    return "success";
  }

  if (status === "seen") {
    return "warning";
  }

  return "neutral";
}

function formatStateActivityLabel(state: {
  completedAt: string | null;
  firstSeenAt: string | null;
}) {
  const timestamp = state.completedAt || state.firstSeenAt;
  if (!timestamp) {
    return "Not opened yet";
  }

  const activityLabel = state.completedAt ? "Completed" : "Seen";
  return `${activityLabel} ${new Date(timestamp).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export default async function WorkspaceDiaryPage({
  params,
  searchParams,
}: WorkspaceDiaryPageProps) {
  const { schoolKey, viewerId } = await requireWorkspaceStaffSession();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const rawReturnTo = Array.isArray(resolvedSearchParams?.returnTo)
    ? resolvedSearchParams.returnTo[0]
    : resolvedSearchParams?.returnTo;
  const backHref = getSafeReturnToPath(rawReturnTo) || "/workspace/diary";

  const entry = await getWorkspaceDiaryById({
    schoolKey,
    entryId: id,
    viewerId,
  });

  if (!entry) {
    return (
      <PageShell width="wide" padding="standard">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Daily Learning"
          title="Diary Entry"
          description="The requested diary entry could not be loaded."
          actions={
            <Button asChild variant="outline" className="app-button-back">
              <AppPrefetchLink href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </AppPrefetchLink>
            </Button>
          }
        />
      </PageShell>
    );
  }

  const currentPath = `/workspace/diary/${id}`;
  const editHref = buildHrefWithReturnTo(`/workspace/diary/edit/${id}`, currentPath);
  const sectionScopeSummary =
    entry.assignedAcademicSections.length > 0
      ? entry.assignedAcademicSections.map((section) => section.name).join(", ")
      : "All sections in the selected class";
  const publishedAtLabel = entry.publishedAt
    ? new Date(entry.publishedAt).toLocaleString("en-IN")
    : null;

  return (
    <PageShell width="wide" padding="standard">
      <div className="app-diary-page">
        <PageHero
          className="app-learning-hero"
          variant="editor"
          density="compact"
          eyebrow="Daily Learning"
          title={entry.title}
          description={formatDiaryDateLabel(entry.entryDate) || entry.entryDate}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="app-button-back">
                <AppPrefetchLink href={backHref}>
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </AppPrefetchLink>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="app-row-action-button app-row-action-button-accent"
                aria-label="Edit entry"
                title="Edit entry"
              >
                <AppPrefetchLink href={editHref}>
                  <Edit className="h-4 w-4" />
                  Edit
                </AppPrefetchLink>
              </Button>
              <DiaryArchiveButton entryId={id} returnToPath={backHref} />
            </div>
          }
          meta={
            <>
              <span className="app-meta-chip capitalize">{entry.status}</span>
              {entry.class?.name ? (
                <span className="app-meta-chip">{entry.class.name}</span>
              ) : null}
              {entry.subject?.name ? (
                <span className="app-meta-chip">{entry.subject.name}</span>
              ) : null}
            </>
          }
          stats={[
            {
              label: "Assigned students",
              value: String(entry.progressSummary.assignedStudents),
              meta: "Students covered by this scope.",
            },
            {
              label: "Not seen",
              value: String(entry.progressSummary.notSeenStudents),
              meta: "Students who have not opened it yet.",
            },
            {
              label: "Seen",
              value: String(entry.progressSummary.seenStudents),
              meta: "Opened but not marked complete.",
            },
            {
              label: "Completed",
              value: String(entry.progressSummary.completedStudents),
              meta: "Students who marked the work complete.",
            },
          ]}
        />

        <div className="app-diary-detail-layout">
          <div className="space-y-4">
            {entry.lessonSummaryHtml ? (
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <CardTitle>Lesson Summary</CardTitle>
                </CardHeader>
                <CardContent className="app-section-body">
                  <StaticContentRenderer htmlContent={entry.lessonSummaryHtml} />
                </CardContent>
              </Card>
            ) : null}

            {entry.homeworkHtml ? (
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <CardTitle>Homework</CardTitle>
                </CardHeader>
                <CardContent className="app-section-body">
                  <StaticContentRenderer htmlContent={entry.homeworkHtml} />
                </CardContent>
              </Card>
            ) : null}

            {entry.teacherNoteHtml ? (
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <CardTitle>Teacher Note</CardTitle>
                </CardHeader>
                <CardContent className="app-section-body">
                  <StaticContentRenderer htmlContent={entry.teacherNoteHtml} />
                </CardContent>
              </Card>
            ) : null}

            {entry.resources.length > 0 ? (
              <Card className="app-surface overflow-hidden">
                <CardHeader className="app-section-header">
                  <CardTitle>Resources</CardTitle>
                </CardHeader>
                <CardContent className="app-section-body space-y-4">
                  {entry.resources.map((resource) => (
                    <div key={resource.id} className="app-diary-resource-card">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {resource.type === "youtube" ? "Video" : resource.type}
                        </Badge>
                      </div>

                      {resource.type === "image" ? (
                        <div className="app-diary-media-frame mt-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resource.url}
                            alt={resource.altText || "Diary image"}
                            className="h-[280px] w-full object-cover"
                          />
                          {resource.caption ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">
                              {resource.caption}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {resource.type === "youtube" ? (
                        <div className="app-diary-media-frame mt-4 overflow-hidden">
                          <iframe
                            src={buildYouTubeEmbedUrl(resource.videoId)}
                            title="Diary video"
                            className="aspect-video w-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                          {resource.caption ? (
                            <p className="px-4 py-3 text-sm text-muted-foreground">
                              {resource.caption}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {resource.type === "file" ? (
                        <div className="mt-4 rounded-[1rem] border border-border/70 bg-muted/10 px-4 py-4">
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-foreground underline-offset-4 hover:underline"
                          >
                            {resource.fileName}
                          </a>
                          {resource.caption ? (
                            <p className="mt-2 text-sm text-muted-foreground">
                              {resource.caption}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="app-course-sidebar">
            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Entry Details</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body space-y-4">
                <div className="app-course-metric-grid">
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Resources</p>
                    <p className="app-course-metric-value">{entry.resources.length}</p>
                  </div>
                  <div className="app-course-metric-card">
                    <p className="app-course-metric-label">Sections</p>
                    <p className="app-course-metric-value">
                      {entry.assignedAcademicSections.length > 0
                        ? entry.assignedAcademicSections.length
                        : "All"}
                    </p>
                  </div>
                </div>

                <div className="app-editor-summary-list">
                  <div className="space-y-1">
                    <p className="app-editor-summary-label">Coverage</p>
                    <p className="app-editor-summary-value">{sectionScopeSummary}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="app-editor-summary-label">Updated by</p>
                    <p className="app-editor-summary-value">
                      {entry.updatedBy?.name || entry.author?.name || "Unknown author"}
                    </p>
                  </div>
                  {publishedAtLabel ? (
                    <div className="space-y-1">
                      <p className="app-editor-summary-label">Published</p>
                      <p className="app-editor-summary-value">{publishedAtLabel}</p>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="app-surface overflow-hidden">
              <CardHeader className="app-section-header">
                <CardTitle>Roster Status</CardTitle>
              </CardHeader>
              <CardContent className="app-section-body">
                {entry.roster.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No students match this diary scope yet.
                  </p>
                ) : (
                  <div className="app-diary-roster-list">
                    {entry.roster.map((item) => {
                      const metaLine = [
                        item.student.rollNumber
                          ? `Roll ${item.student.rollNumber}`
                          : "No roll number",
                        item.student.academicSection?.name || null,
                        formatStateActivityLabel(item.state),
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <div
                          key={item.student._id}
                          className="app-diary-roster-row"
                        >
                          <div className="app-diary-roster-main">
                            <p className="app-diary-roster-name">
                              {item.student.name}
                            </p>
                            <p className="app-diary-roster-meta">{metaLine}</p>
                          </div>
                          <Badge variant={getStateBadgeVariant(item.state.status)}>
                            {formatStateLabel(item.state.status)}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
