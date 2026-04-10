"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
import type { WorkspaceLiveSessionDetail } from "@/lib/live-sessions/types";

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

function formatAttendanceLabel(value: string) {
  return String(value || "").replace(/_/g, " ");
}

export default function WorkspaceLiveSessionDetailClient({
  liveSession,
}: WorkspaceLiveSessionDetailClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  async function handleRequest(url: string, options?: RequestInit) {
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch(url, {
        method: "POST",
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setError(String(payload?.message || "Action failed.").trim());
        setIsWorking(false);
        return payload;
      }

      router.refresh();
      setIsWorking(false);
      return payload;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Action failed.",
      );
      setIsWorking(false);
      return null;
    }
  }

  async function handleStart() {
    const payload = await handleRequest(
      `/api/live-sessions/${liveSession._id}/start`,
    );
    const joinUrl = String(payload?.joinUrl || "").trim();
    if (joinUrl) {
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleEnd() {
    await handleRequest(`/api/live-sessions/${liveSession._id}/end`);
  }

  async function handleCancel() {
    const cancelReason =
      window.prompt(
        "Why are you cancelling this live class?",
        liveSession.cancelReason || "",
      ) || "";

    await handleRequest(`/api/live-sessions/${liveSession._id}/cancel`, {
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
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Delete failed.",
      );
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
      const response = await fetch(
        `/api/live-sessions/${liveSession._id}/attendance`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            attendance: [{ studentId, status }],
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.success) {
        setError(
          String(payload?.message || "Attendance update failed.").trim(),
        );
        setActiveStudentId(null);
        return;
      }

      router.refresh();
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

  return (
    <div className="space-y-5">
      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Session Operations</CardTitle>
              <p className="text-sm text-muted-foreground">
                Run the host flow, manage schedule changes, and keep attendance updated.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="capitalize">
                {formatAttendanceLabel(liveSession.status)}
              </Badge>
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
                Joined
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {liveSession.joinedCount} joined
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
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
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm">
              <p className="font-semibold text-foreground">Join instructions</p>
              <p className="mt-3 leading-6 text-muted-foreground">
                {liveSession.joinInstructions ||
                  "No extra instructions were added for students yet."}
              </p>
            </div>
          </div>

          {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}

          <div className="flex flex-wrap gap-2">
            {liveSession.status === "scheduled" ? (
              <Button
                type="button"
                className="app-button-page"
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
                onClick={handleCancel}
                disabled={isWorking}
              >
                Cancel session
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

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
              <Badge variant="outline">{liveSession.presentCount} present</Badge>
              <Badge variant="outline">{liveSession.absentCount} absent</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Join clicks</TableHead>
                <TableHead>First join</TableHead>
                <TableHead>Marked by</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveSession.attendance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No students are targeted by this live class yet.
                  </TableCell>
                </TableRow>
              ) : (
                liveSession.attendance.map((item) => (
                  <TableRow key={item.studentId}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {item.studentName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.rollNumber ? `Roll ${item.rollNumber}` : "No roll number"}
                          {item.academicSectionName
                            ? ` • ${item.academicSectionName}`
                            : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="capitalize">
                        {formatAttendanceLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.joinClicks}</TableCell>
                    <TableCell>{formatDateTime(item.firstJoinedAt)}</TableCell>
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
                          onClick={() =>
                            handleAttendanceUpdate(item.studentId, "present")
                          }
                        >
                          Present
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={item.status === "absent" ? "default" : "outline"}
                          className="app-button-compact"
                          disabled={activeStudentId === item.studentId}
                          onClick={() =>
                            handleAttendanceUpdate(item.studentId, "absent")
                          }
                        >
                          Absent
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
