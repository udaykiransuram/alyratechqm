import { notFound } from "next/navigation";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { formatDiaryDateLabel } from "@/lib/diary/shared";
import { getStudentProgressUpdatesDetail } from "@/lib/server/progress-updates";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

type ProgressUpdatesDetailPageProps = {
  params: Promise<{ studentId: string }>;
};

const STATUS_VARIANTS: Record<string, "success" | "warning" | "neutral" | "danger"> = {
  sent: "success",
  pending: "warning",
  skipped: "neutral",
  failed: "danger",
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default async function ProgressUpdatesDetailPage({
  params,
}: ProgressUpdatesDetailPageProps) {
  const { schoolKey, viewerId, viewerRole } = await requireWorkspaceStaffSession();
  const { studentId } = await params;

  const detail = await getStudentProgressUpdatesDetail({
    schoolKey,
    viewerId,
    viewerRole,
    studentId,
  });

  if (!detail) {
    notFound();
  }

  const studentLabel = `${detail.student.name}${
    detail.student.rollNumber ? ` • Roll ${detail.student.rollNumber}` : ""
  }`;

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="directory"
        eyebrow="Progress Updates"
        title={detail.student.name}
        description="Review daily parent summaries and the latest WhatsApp delivery status."
        meta={
          <>
            <span className="app-meta-chip">{detail.student.class?.name || "Class"}</span>
            {detail.student.section?.name ? (
              <span className="app-meta-chip">{detail.student.section.name}</span>
            ) : null}
          </>
        }
        actions={
          <Button asChild variant="outline" className="app-button-back">
            <AppPrefetchLink href="/workspace/progress-updates">
              Back to progress updates
            </AppPrefetchLink>
          </Button>
        }
        stats={[
          {
            label: "Student",
            value: studentLabel,
            meta: "Current cohort placement.",
          },
          {
            label: "Contact",
            value: detail.student.mobileNumber || "Not set",
            meta: detail.contact?.parentName || "Parent contact name not configured.",
          },
          {
            label: "WhatsApp opt-in",
            value: detail.contact?.whatsappOptIn ? "Yes" : "No",
            meta: detail.contact?.relationship || "Parent/guardian",
          },
          {
            label: "Updates",
            value: String(detail.progress.length),
            meta: "Daily updates available.",
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-card-title">Daily progress history</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="app-table-wrap app-table-dense">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent at</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.progress.map((entry) => (
                    <TableRow key={entry.date}>
                      <TableCell>
                        <div className="app-table-cell-stack">
                          <div className="app-table-cell-title">
                            {formatDiaryDateLabel(entry.date) || entry.date}
                          </div>
                          <div className="app-table-cell-note">
                            {entry.topicsCovered.length
                              ? entry.topicsCovered.join(", ")
                              : "No topics logged"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="app-table-cell-stack">
                          <div className="app-table-cell-title">
                            {entry.assessmentQuestionCount > 0
                              ? `Assessment ${entry.assessmentAccuracyPct ?? 0}%`
                              : "No assessment activity"}
                          </div>
                          <div className="app-table-cell-note">
                            {entry.homeworkAssigned > 0
                              ? `Homework ${entry.homeworkCompleted}/${entry.homeworkAssigned}`
                              : "No homework tracked"}
                          </div>
                          <div className="app-table-cell-note">
                            {entry.liveSessionsAssigned > 0
                              ? `Live class ${entry.liveSessionsAttended}/${entry.liveSessionsAssigned} • ${
                                  typeof entry.liveAttentionPct === "number"
                                    ? `${Math.round(entry.liveAttentionPct)}% attention`
                                    : "Attention —"
                                }`
                              : "No live classes tracked"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[entry.digestStatus || "pending"] || "neutral"}>
                          {entry.digestStatus || "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDateTime(entry.digestSentAt)}</TableCell>
                    </TableRow>
                  ))}
                  {detail.progress.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>No updates logged yet.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardHeader className="app-card-header">
            <CardTitle className="app-card-title">Parent contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Contact name
              </p>
              <p className="text-sm text-foreground">
                {detail.contact?.parentName || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                WhatsApp number
              </p>
              <p className="text-sm text-foreground">
                {detail.student.mobileNumber || "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Relationship
              </p>
              <p className="text-sm text-foreground">
                {detail.contact?.relationship || "Parent/guardian"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Opt-in
              </p>
              <p className="text-sm text-foreground">
                {detail.contact?.whatsappOptIn ? "Confirmed" : "Not confirmed"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Last updated
              </p>
              <p className="text-sm text-foreground">
                {formatDateTime(detail.contact?.updatedAt)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
