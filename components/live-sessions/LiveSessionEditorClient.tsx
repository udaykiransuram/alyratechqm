"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { SearchableCommandSelect } from "@/components/ui/searchable-command-select";
import { SearchableMultiSelectPopover } from "@/components/ui/searchable-multi-select-popover";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { filterEligibleLiveSessionTeachers } from "@/lib/live-sessions/shared";
import type {
  LiveSessionWorkspaceSupportData,
  WorkspaceLiveSessionDetail,
} from "@/lib/live-sessions/types";

type LiveSessionEditorClientProps = {
  mode: "create" | "edit";
  supportData: LiveSessionWorkspaceSupportData;
  initialSession?: WorkspaceLiveSessionDetail | null;
};

function resolveSectionClassId(section: LiveSessionWorkspaceSupportData["sections"][number]) {
  if (typeof section.class === "string") {
    return section.class;
  }

  return String(section.class?._id || "").trim();
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function buildDefaultDateTimeLocalValue(minutesFromNow: number) {
  const now = new Date();
  const rounded = new Date(now.getTime() + minutesFromNow * 60 * 1000);
  rounded.setSeconds(0, 0);
  const shifted = new Date(
    rounded.getTime() - rounded.getTimezoneOffset() * 60 * 1000,
  );
  return shifted.toISOString().slice(0, 16);
}

function toIsoFromLocalDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

export default function LiveSessionEditorClient({
  mode,
  supportData,
  initialSession,
}: LiveSessionEditorClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialSession?.title || "");
  const [description, setDescription] = useState(
    initialSession?.description || "",
  );
  const [classId, setClassId] = useState(initialSession?.class?._id || "");
  const [subjectId, setSubjectId] = useState(initialSession?.subject?._id || "");
  const [assignedAcademicSectionIds, setAssignedAcademicSectionIds] = useState(
    initialSession?.assignedAcademicSections.map((section) => section._id) || [],
  );
  const [hostTeacherId, setHostTeacherId] = useState(
    initialSession?.hostTeacher?._id ||
      supportData.defaultHostTeacherId ||
      "",
  );
  const [scheduledStartAt, setScheduledStartAt] = useState(
    toDateTimeLocalValue(initialSession?.scheduledStartAt) ||
      buildDefaultDateTimeLocalValue(60),
  );
  const [scheduledEndAt, setScheduledEndAt] = useState(
    toDateTimeLocalValue(initialSession?.scheduledEndAt) ||
      buildDefaultDateTimeLocalValue(120),
  );
  const [studentJoinUrl, setStudentJoinUrl] = useState(
    initialSession?.studentJoinUrl || "",
  );
  const [hostJoinUrl, setHostJoinUrl] = useState(
    initialSession?.hostJoinUrl || "",
  );
  const [meetingCode, setMeetingCode] = useState(
    initialSession?.meetingCode || "",
  );
  const [meetingPasscode, setMeetingPasscode] = useState(
    initialSession?.meetingPasscode || "",
  );
  const [joinInstructions, setJoinInstructions] = useState(
    initialSession?.joinInstructions || "",
  );
  const [status, setStatus] = useState<"draft" | "scheduled">(
    initialSession?.status === "draft" ? "draft" : "scheduled",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classOptions = useMemo(
    () =>
      supportData.classes.map((item) => ({
        value: item._id,
        label: item.name,
      })),
    [supportData.classes],
  );
  const subjectOptions = useMemo(
    () =>
      supportData.subjects.map((item) => ({
        value: item._id,
        label: item.name,
      })),
    [supportData.subjects],
  );
  const sectionOptions = useMemo(
    () =>
      supportData.sections
        .filter((section) => !classId || resolveSectionClassId(section) === classId)
        .map((section) => ({
          value: section._id,
          label: section.name,
          description:
            typeof section.class === "string"
              ? undefined
              : section.class?.name || undefined,
        })),
    [classId, supportData.sections],
  );
  const eligibleTeachers = useMemo(
    () =>
      filterEligibleLiveSessionTeachers({
        teachers: supportData.teachers,
        classId,
        subjectId,
        assignedAcademicSectionIds,
      }),
    [
      assignedAcademicSectionIds,
      classId,
      subjectId,
      supportData.teachers,
    ],
  );
  const teacherOptions = useMemo(
    () =>
      eligibleTeachers.map((teacher) => ({
        value: teacher._id,
        label: teacher.name,
      })),
    [eligibleTeachers],
  );

  useEffect(() => {
    const validSectionIds = new Set(sectionOptions.map((option) => option.value));
    setAssignedAcademicSectionIds((current) =>
      current.every((sectionId) => validSectionIds.has(sectionId))
        ? current
        : current.filter((sectionId) => validSectionIds.has(sectionId)),
    );
  }, [sectionOptions]);

  useEffect(() => {
    if (
      supportData.defaultHostTeacherId &&
      !initialSession?.hostTeacher?._id &&
      !hostTeacherId
    ) {
      setHostTeacherId(supportData.defaultHostTeacherId);
    }
  }, [hostTeacherId, initialSession?.hostTeacher?._id, supportData.defaultHostTeacherId]);

  useEffect(() => {
    if (teacherOptions.length === 0) {
      if (
        supportData.defaultHostTeacherId &&
        supportData.defaultHostTeacherId !== hostTeacherId
      ) {
        setHostTeacherId(supportData.defaultHostTeacherId);
      }
      return;
    }

    if (!teacherOptions.some((option) => option.value === hostTeacherId)) {
      setHostTeacherId(teacherOptions[0]?.value || "");
    }
  }, [hostTeacherId, supportData.defaultHostTeacherId, teacherOptions]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(
        mode === "create"
          ? "/api/live-sessions"
          : `/api/live-sessions/${initialSession?._id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            description,
            classId,
            subjectId,
            assignedAcademicSectionIds,
            hostTeacherId,
            scheduledStartAt: toIsoFromLocalDateTime(scheduledStartAt),
            scheduledEndAt: toIsoFromLocalDateTime(scheduledEndAt),
            studentJoinUrl,
            hostJoinUrl,
            meetingCode,
            meetingPasscode,
            joinInstructions,
            status,
          }),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success || !payload?.liveSession?._id) {
        setError(
          String(payload?.message || "Failed to save the live class.").trim(),
        );
        setIsSaving(false);
        return;
      }

      router.push(`/workspace/live-classes/${payload.liveSession._id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save the live class.",
      );
      setIsSaving(false);
    }
  }

  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header gap-2">
        <CardTitle>
          {mode === "create" ? "Live Class Setup" : "Live Class Details"}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Organize the session basics, audience, schedule, and join details in one place.
        </p>
      </CardHeader>
      <CardContent className="app-section-body">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <section className="app-section">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Session basics</p>
                  <p className="text-xs text-muted-foreground">
                    Title and a short prep summary for students.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group md:col-span-2">
                  <Label htmlFor="live-session-title">Title</Label>
                  <Input
                    id="live-session-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Algebra revision live class"
                    disabled={isSaving}
                  />
                </div>

                <div className="app-field-group md:col-span-2">
                  <Label htmlFor="live-session-description">Description</Label>
                  <Textarea
                    id="live-session-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Tell students what this session covers and how to prepare."
                    rows={4}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </section>

            <section className="app-section">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Audience</p>
                  <p className="text-xs text-muted-foreground">
                    Choose the class, sections, and host teacher.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group">
                  <Label>Class</Label>
                  <SearchableCommandSelect
                    value={classId}
                    options={classOptions}
                    onValueChange={setClassId}
                    placeholder="Select class"
                    searchPlaceholder="Search classes"
                    emptyText="No classes available."
                    disabled={isSaving}
                  />
                </div>

                <div className="app-field-group">
                  <Label>Subject</Label>
                  <SearchableCommandSelect
                    value={subjectId}
                    options={subjectOptions}
                    onValueChange={setSubjectId}
                    placeholder="Select subject"
                    searchPlaceholder="Search subjects"
                    emptyText="No subjects available."
                    disabled={isSaving}
                  />
                </div>

                <div className="app-field-group">
                  <Label>Sections</Label>
                  <SearchableMultiSelectPopover
                    selectedValues={assignedAcademicSectionIds}
                    options={sectionOptions}
                    onSelectedValuesChange={setAssignedAcademicSectionIds}
                    placeholder="Whole class or selected sections"
                    searchPlaceholder="Search sections"
                    emptyText="No sections available."
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave this empty to target the full class.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label>Host teacher</Label>
                  <SearchableCommandSelect
                    value={hostTeacherId}
                    options={teacherOptions}
                    onValueChange={setHostTeacherId}
                    placeholder="Select host teacher"
                    searchPlaceholder="Search teachers"
                    emptyText={
                      classId && subjectId
                        ? "No eligible teachers for this scope."
                        : "Choose class and subject first."
                    }
                    disabled={isSaving || teacherOptions.length <= 1}
                  />
                  <p className="text-xs text-muted-foreground">
                    {teacherOptions.length > 0
                      ? "Host teachers are filtered by the selected class, subject, and sections."
                      : "Pick class and subject first to resolve eligible hosts."}
                  </p>
                </div>
              </div>
            </section>

            <section className="app-section">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Schedule</p>
                  <p className="text-xs text-muted-foreground">
                    Set the session window and notification timing.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group">
                  <Label htmlFor="live-session-start">Start time</Label>
                  <Input
                    id="live-session-start"
                    type="datetime-local"
                    value={scheduledStartAt}
                    onChange={(event) => setScheduledStartAt(event.target.value)}
                    disabled={isSaving}
                  />
                </div>

                <div className="app-field-group">
                  <Label htmlFor="live-session-end">End time</Label>
                  <Input
                    id="live-session-end"
                    type="datetime-local"
                    value={scheduledEndAt}
                    onChange={(event) => setScheduledEndAt(event.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </section>

            <section className="app-section">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Join details</p>
                  <p className="text-xs text-muted-foreground">
                    Meeting links, optional access codes, and student guidance.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group md:col-span-2">
                  <Label htmlFor="live-session-student-link">Student join link</Label>
                  <Input
                    id="live-session-student-link"
                    value={studentJoinUrl}
                    onChange={(event) => setStudentJoinUrl(event.target.value)}
                    placeholder="https://youtube.com/live/... or https://zoom.us/j/..."
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Zoom, Meet, and YouTube Live links are supported. YouTube Live links embed automatically on the teacher and student live-class pages.
                  </p>
                </div>

                <div className="app-field-group md:col-span-2">
                  <Label htmlFor="live-session-host-link">Host join link</Label>
                  <Input
                    id="live-session-host-link"
                    value={hostJoinUrl}
                    onChange={(event) => setHostJoinUrl(event.target.value)}
                    placeholder="Optional separate teacher or control-room link"
                    disabled={isSaving}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave this empty when the teacher and students should use the same stream or meeting link.
                  </p>
                </div>

                <div className="app-field-group">
                  <Label htmlFor="live-session-meeting-code">Meeting code</Label>
                  <Input
                    id="live-session-meeting-code"
                    value={meetingCode}
                    onChange={(event) => setMeetingCode(event.target.value)}
                    placeholder="Optional"
                    disabled={isSaving}
                  />
                </div>

                <div className="app-field-group">
                  <Label htmlFor="live-session-passcode">Meeting passcode</Label>
                  <Input
                    id="live-session-passcode"
                    value={meetingPasscode}
                    onChange={(event) => setMeetingPasscode(event.target.value)}
                    placeholder="Optional"
                    disabled={isSaving}
                  />
                </div>

                <div className="app-field-group md:col-span-2">
                  <Label htmlFor="live-session-join-instructions">
                    Join instructions
                  </Label>
                  <Textarea
                    id="live-session-join-instructions"
                    value={joinInstructions}
                    onChange={(event) => setJoinInstructions(event.target.value)}
                    placeholder="Optional prep notes, notebook reminders, or camera guidance."
                    rows={4}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </section>

            <section className="app-section">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Publish state</p>
                  <p className="text-xs text-muted-foreground">
                    Scheduled sessions notify students and send reminders.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="app-field-group">
                  <Label>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) =>
                      setStatus(value === "draft" ? "draft" : "scheduled")
                    }
                    disabled={isSaving || initialSession?.status === "scheduled"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Scheduled live classes trigger in-app student notifications and a 15-minute reminder.
                  </p>
                </div>
              </div>
            </section>
          </div>

          {error ? (
            <div className="app-feedback app-feedback-error">{error}</div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit" className="app-button-page" disabled={isSaving}>
              {isSaving
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create live class"
                  : "Save changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
