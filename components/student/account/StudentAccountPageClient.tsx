"use client";

import { useEffect, useMemo, useState } from "react";

import PageHero from "@/components/layout/PageHero";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchApiJson } from "@/lib/client/api";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import type {
  StudentAccountProfile,
  StudentAccountReleasedReport,
} from "@/lib/student-account/types";

type StudentAccountPageClientProps = {
  initialStudent: StudentAccountProfile | null;
  initialReportTests: StudentAccountReleasedReport[];
  initialError?: string | null;
  initialReportsError?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatTitleCase(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "—";

  return normalized
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAttemptStatusLabel(status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "Submitted";
  if (normalized === "auto_submitted") return "Auto Submitted";
  if (normalized === "in_progress") return "In Progress";
  if (normalized === "submitted") return "Submitted";
  return formatTitleCase(normalized);
}

function getAttemptStatusVariant(status?: string | null) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "submitted") return "success" as const;
  if (normalized === "auto_submitted") return "warning" as const;
  if (normalized === "in_progress") return "default" as const;
  return "secondary" as const;
}

export default function StudentAccountPageClient({
  initialStudent,
  initialReportTests,
  initialError = null,
  initialReportsError = null,
}: StudentAccountPageClientProps) {
  const [student, setStudent] = useState<StudentAccountProfile | null>(initialStudent);
  const [profileForm, setProfileForm] = useState(() => ({
    name: String(initialStudent?.name || ""),
    email: String(initialStudent?.email || ""),
    mobileNumber: String(initialStudent?.mobileNumber || ""),
  }));
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reportTests, setReportTests] = useState<StudentAccountReleasedReport[]>(
    initialReportTests,
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [reportsError, setReportsError] = useState<string | null>(
    initialReportsError,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setStudent(initialStudent);
    setProfileForm({
      name: String(initialStudent?.name || ""),
      email: String(initialStudent?.email || ""),
      mobileNumber: String(initialStudent?.mobileNumber || ""),
    });
    setReportTests(initialReportTests);
    setError(initialError);
    setReportsError(initialReportsError);
  }, [initialError, initialReportTests, initialReportsError, initialStudent]);

  const latestReportHref = useMemo(() => {
    const latestResponseId = reportTests[0]?.attempt?._id;
    if (!latestResponseId) return null;
    return buildHrefWithReturnTo(
      `/student/reports/${latestResponseId}`,
      "/student/account",
    );
  }, [reportTests]);
  const latestReportPrefetches = useMemo(() => {
    const latestResponseId = reportTests[0]?.attempt?._id;
    if (!latestResponseId) return undefined;
    return [`/api/analytics/student-tag-report/${latestResponseId}?groupFields=1`];
  }, [reportTests]);

  async function handleProfileSave(event: React.FormEvent) {
    event.preventDefault();
    setProfileSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await fetchApiJson<any>("/api/student/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
          mobileNumber: profileForm.mobileNumber,
        }),
        fallbackMessage: "Failed to update your profile.",
      });

      const nextStudent = data.student || null;
      setStudent(nextStudent);
      setProfileForm({
        name: String(nextStudent?.name || ""),
        email: String(nextStudent?.email || ""),
        mobileNumber: String(nextStudent?.mobileNumber || ""),
      });
      setSuccessMessage(data.message || "Profile updated successfully.");
    } catch (submitError: any) {
      setError(submitError?.message || "Failed to update your profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordChange(event: React.FormEvent) {
    event.preventDefault();
    setPasswordSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
        throw new Error("Fill in all password fields.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation do not match.");
      }

      const data = await fetchApiJson<any>("/api/student/account/password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
        fallbackMessage: "Failed to update your password.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage(data.message || "Password updated successfully.");
    } catch (submitError: any) {
      setError(submitError?.message || "Failed to update your password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="Student Portal"
        title="Student Account"
        description="Update your contact details, keep your login secure, and jump straight into analysis reports for completed online tests."
        actions={
          latestReportHref ? (
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="app-student-action-secondary"
            >
              <AppPrefetchLink
                href={latestReportHref}
                relatedApiPrefetches={latestReportPrefetches}
              >
                Open Latest Analysis Report
              </AppPrefetchLink>
            </Button>
          ) : undefined
        }
        meta={
          <>
            <span className="app-meta-chip">Roll number login</span>
            <span className="app-meta-chip">Online-test report access</span>
            <span className="app-meta-chip">Self-service account updates</span>
          </>
        }
        stats={[
          {
            label: "Username",
            value: student?.rollNumber || "—",
            meta: "Your roll number stays the username for online tests and portal access.",
          },
          {
            label: "Class",
            value: student?.className || "Not assigned",
            meta: "Class placement controls online-test eligibility.",
          },
          {
            label: "Section",
            value: student?.academicSectionName || "Not assigned",
            meta: "Section placement is used when a test is section-specific.",
          },
          {
            label: "Completed online tests",
            value: String(reportTests.length),
            meta: "Each completed online test here can open its analysis report.",
          },
        ]}
      >
        <div className="sm:hidden">
          <StudentPortalNav />
        </div>
      </PageHero>

      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="app-feedback app-feedback-success">{successMessage}</div>
      ) : null}

      <div className="app-student-card-grid items-start">
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="app-detail-grid">
              <div className="app-detail-item">
                <p className="app-detail-label">Username</p>
                <p className="app-detail-value">{student?.rollNumber || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This roll number is used for online-test sign-in.
                </p>
              </div>
              <div className="app-detail-item">
                <p className="app-detail-label">Placement</p>
                <p className="app-detail-value">
                  {student?.className || "Not assigned"}
                  {student?.academicSectionName
                    ? ` • ${student.academicSectionName}`
                    : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Class and section are managed by your school admin.
                </p>
              </div>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="studentName">Student Name</Label>
                  <Input
                    id="studentName"
                    type="text"
                    value={profileForm.name}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studentEmail">Email</Label>
                  <Input
                    id="studentEmail"
                    type="email"
                    value={profileForm.email}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    placeholder="Enter your email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional, but useful for account recovery communication.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="studentMobileNumber">Phone Number</Label>
                  <Input
                    id="studentMobileNumber"
                    type="tel"
                    value={profileForm.mobileNumber}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        mobileNumber: event.target.value,
                      }))
                    }
                    placeholder="Enter your phone number"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The digits saved here become your fallback password if a
                    school admin resets your account.
                  </p>
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={profileSaving}
                className="app-student-action-secondary"
              >
                {profileSaving ? "Saving..." : "Save Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Choose a new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use at least 6 characters, or set the saved phone-number digits
                exactly as stored to return to the default password. If you
                forget a custom password later, ask your school admin to reset
                it to these saved phone digits.
              </p>
              <Button
                type="submit"
                size="lg"
                disabled={passwordSaving}
                className="app-student-action-secondary"
              >
                {passwordSaving ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="app-surface">
        <CardHeader className="app-section-header">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Online-Test Analysis Reports</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Browse your completed tests and reopen each analysis report from one list.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {reportTests.length} report{reportTests.length === 1 ? "" : "s"} ready
              </Badge>
              {reportTests[0]?.attempt?.submittedAt ? (
                <span className="app-meta-chip">
                  Latest {formatDateTime(reportTests[0].attempt.submittedAt)}
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reportsError ? (
            <div className="p-4">
              <div className="app-feedback app-feedback-error">{reportsError}</div>
            </div>
          ) : reportTests.length === 0 ? (
            <div className="app-empty-state rounded-none border-0 py-12">
              No submitted online-test reports are available yet.
            </div>
          ) : (
            <div className="app-table-wrap rounded-none border-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[24rem]">Test</TableHead>
                    <TableHead className="w-[13rem]">Submitted</TableHead>
                    <TableHead className="w-[11rem]">Status</TableHead>
                    <TableHead className="w-[13rem]">Score</TableHead>
                    <TableHead className="text-right min-w-[10rem]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportTests.map((test, index) => {
                    const responseId = test.attempt?._id;
                    if (!responseId) return null;

                    const reportHref = buildHrefWithReturnTo(
                      `/student/reports/${responseId}`,
                      "/student/account",
                    );
                    const statusLabel = getAttemptStatusLabel(
                      test.attempt?.status || test.status,
                    );
                    const scoreLabel =
                      typeof test.attempt?.totalMarksAwarded === "number"
                        ? String(test.attempt.totalMarksAwarded)
                        : "Pending";
                    const subjectLabel = test.subject?.name
                      ? formatTitleCase(test.subject.name)
                      : "Subject Pending";
                    const windowLabel = test.onlineEndsAt
                      ? formatDateTime(test.onlineEndsAt)
                      : "Available now";
                    const submittedLabel = formatDateTime(test.attempt?.submittedAt);

                    return (
                      <TableRow key={responseId}>
                        <TableCell>
                          <div className="min-w-[18rem] space-y-2">
                            {index === 0 ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="info">Most Recent</Badge>
                              </div>
                            ) : null}
                            <div className="space-y-1">
                              <div className="app-list-title">
                                {test.title || "Online Test"}
                              </div>
                              <div className="app-list-meta">
                                Completed analysis report
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {test.subject?.name ? (
                                  <Badge variant="outline">{subjectLabel}</Badge>
                                ) : (
                                  <span className="app-list-meta">{subjectLabel}</span>
                                )}
                                <span className="app-list-meta">
                                  Window end {windowLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[11rem] space-y-1">
                            <div className="app-list-value">{submittedLabel}</div>
                            <div className="app-list-meta">
                              {index === 0 ? "Latest submission" : "Submitted"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[10rem] space-y-2">
                            <Badge
                              variant={getAttemptStatusVariant(
                                test.attempt?.status || test.status,
                              )}
                            >
                              {statusLabel}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[11rem] space-y-1">
                            <div className="app-list-value">{scoreLabel}</div>
                            <div className="app-list-meta">Marks awarded</div>
                            <div className="app-list-meta">
                              Window end {windowLabel}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            asChild
                            size="md"
                            variant="secondary"
                            className="app-student-action-compact"
                          >
                            <AppPrefetchLink
                              href={reportHref}
                              relatedApiPrefetches={[
                                `/api/analytics/student-tag-report/${responseId}?groupFields=1`,
                              ]}
                            >
                              Open Report
                            </AppPrefetchLink>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
