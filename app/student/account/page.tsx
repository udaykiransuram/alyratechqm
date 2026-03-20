"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import PageHero from "@/components/layout/PageHero";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageLoadingState from "@/components/ui/page-loading-state";
import { fetchApiJson } from "@/lib/client/api";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";

type StudentProfile = {
  _id: string;
  name: string;
  email?: string;
  rollNumber?: string;
  mobileNumber?: string;
  className?: string;
  academicSectionName?: string;
};

type StudentOnlineTest = {
  _id: string;
  title: string;
  status: string;
  subject?: { _id: string; name: string } | null;
  onlineEndsAt?: string | null;
  attempt?: {
    _id: string;
    submittedAt?: string | null;
    status?: string;
    totalMarksAwarded?: number;
  } | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default function StudentAccountPage() {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    mobileNumber: "",
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [reportTests, setReportTests] = useState<StudentOnlineTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStudentWorkspace() {
      try {
        setLoading(true);
        setError(null);
        setReportsError(null);

        const [studentResult, testsResult] = await Promise.allSettled([
          fetchApiJson<any>("/api/student/account", {
            cache: "no-store",
            fallbackMessage: "Failed to load your student account.",
          }),
          fetchApiJson<any>("/api/student/tests", {
            cache: "no-store",
            fallbackMessage: "Failed to load your online tests.",
          }),
        ]);

        if (!mounted) return;

        if (studentResult.status !== "fulfilled") {
          throw studentResult.reason;
        }

        const nextStudent = studentResult.value.student || null;
        setStudent(nextStudent);
        setProfileForm({
          name: String(nextStudent?.name || ""),
          email: String(nextStudent?.email || ""),
          mobileNumber: String(nextStudent?.mobileNumber || ""),
        });

        if (testsResult.status === "fulfilled") {
          const tests = Array.isArray(testsResult.value.tests)
            ? testsResult.value.tests
            : [];
          const completedOnlineTests = tests
            .filter((test: StudentOnlineTest) => {
              const status = String(test.status || "");
              return (
                (status === "submitted" || status === "auto_submitted") &&
                Boolean(test.attempt?._id)
              );
            })
            .sort((left: StudentOnlineTest, right: StudentOnlineTest) => {
              const leftTime = left.attempt?.submittedAt
                ? new Date(left.attempt.submittedAt).getTime()
                : 0;
              const rightTime = right.attempt?.submittedAt
                ? new Date(right.attempt.submittedAt).getTime()
                : 0;
              return rightTime - leftTime;
            });
          setReportTests(completedOnlineTests);
        } else {
          setReportTests([]);
          setReportsError(
            testsResult.reason?.message || "Failed to load your online-test reports.",
          );
        }
      } catch (loadError: any) {
        if (!mounted) return;
        setError(loadError?.message || "Failed to load your student account.");
        setStudent(null);
        setReportTests([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadStudentWorkspace();

    return () => {
      mounted = false;
    };
  }, []);

  const latestReportHref = useMemo(() => {
    const latestResponseId = reportTests[0]?.attempt?._id;
    if (!latestResponseId) return null;
    return buildHrefWithReturnTo(
      `/student/reports/${latestResponseId}`,
      "/student/account",
    );
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

  if (loading) {
    return (
      <PageLoadingState
        title="Loading account"
        description="Preparing your student details, online-test report links, and password settings."
      />
    );
  }

  return (
    <div className="app-page-shell max-w-6xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Student Portal"
        title="Student Account"
        description="Update your contact details, keep your login secure, and jump straight into analysis reports for completed online tests."
        actions={
          latestReportHref ? (
            <Button asChild variant="outline">
              <Link href={latestReportHref}>Open Latest Online-Test Report</Link>
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
        <StudentPortalNav />
      </PageHero>

      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="app-feedback app-feedback-success">{successMessage}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle>Profile Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Username
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {student?.rollNumber || "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This roll number is used for online-test sign-in.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Placement
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
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
                  Email is optional, but it helps keep your student account details current.
                </p>
              </div>

              <div className="space-y-2">
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
              </div>

              <Button type="submit" disabled={profileSaving} className="w-full sm:w-auto">
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
                <p className="text-xs text-muted-foreground">
                  Use at least 6 characters, or reuse your roll number if you want to return to the default password.
                </p>
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
              <Button type="submit" disabled={passwordSaving} className="w-full sm:w-auto">
                {passwordSaving ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="app-surface">
        <CardHeader className="app-section-header">
          <CardTitle>Online-Test Analysis Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              Completed online tests
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Open the analysis report for any submitted online test directly from your account page.
            </p>
          </div>

          {reportsError ? (
            <div className="app-feedback app-feedback-error">{reportsError}</div>
          ) : reportTests.length === 0 ? (
            <div className="app-empty-state">
              No submitted online-test reports are available yet.
            </div>
          ) : (
            <div className="space-y-3">
              {reportTests.map((test) => {
                const responseId = test.attempt?._id;
                if (!responseId) return null;

                const reportHref = buildHrefWithReturnTo(
                  `/student/reports/${responseId}`,
                  "/student/account",
                );

                return (
                  <div
                    key={responseId}
                    className="rounded-2xl border border-border/60 bg-background/95 px-4 py-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1.5">
                        <p className="text-base font-semibold text-foreground">
                          {test.title || "Online Test"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {test.subject?.name || "Subject pending"} • Submitted{" "}
                          {formatDateTime(test.attempt?.submittedAt)}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="app-meta-chip">
                            Status: {test.attempt?.status || test.status || "Submitted"}
                          </span>
                          <span className="app-meta-chip">
                            Score: {typeof test.attempt?.totalMarksAwarded === "number"
                              ? test.attempt.totalMarksAwarded
                              : 0}
                          </span>
                          <span className="app-meta-chip">
                            Window ended: {formatDateTime(test.onlineEndsAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button asChild>
                          <Link href={reportHref}>Open Analysis Report</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
