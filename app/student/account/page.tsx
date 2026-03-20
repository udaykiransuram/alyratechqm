"use client";

import { useEffect, useState } from "react";

import PageHero from "@/components/layout/PageHero";
import StudentPortalNav from "@/components/student/StudentPortalNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageLoadingState from "@/components/ui/page-loading-state";
import { fetchApiJson } from "@/lib/client/api";

type StudentProfile = {
  _id: string;
  name: string;
  email?: string;
  rollNumber?: string;
  mobileNumber?: string;
};

export default function StudentAccountPage() {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadStudent() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchApiJson<any>("/api/student/account", {
          cache: "no-store",
          fallbackMessage: "Failed to load your student account.",
        });
        if (!mounted) return;
        setStudent(data.student || null);
      } catch (loadError: any) {
        if (!mounted) return;
        setError(loadError?.message || "Failed to load your student account.");
        setStudent(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadStudent();

    return () => {
      mounted = false;
    };
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
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
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageLoadingState
        title="Loading account"
        description="Preparing your student login details and password settings."
      />
    );
  }

  return (
    <div className="app-page-shell max-w-5xl px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="Student Portal"
        title="Student Account"
        description="Review your login username and update the default password whenever you are ready."
        meta={
          <>
            <span className="app-meta-chip">Roll number login</span>
            <span className="app-meta-chip">Self-service password change</span>
          </>
        }
        stats={[
          {
            label: "Username",
            value: student?.rollNumber || "—",
            meta: "Students sign in with roll number, not email.",
          },
          {
            label: "Email",
            value: student?.email || "Not set",
            meta: "Optional contact field for the student account.",
          },
          {
            label: "Password flow",
            value: "Self managed",
            meta: "You can change the default password from this page.",
          },
          {
            label: "Access mode",
            value: "School portal",
            meta: "This account stays inside your school workspace.",
          },
        ]}
      >
        <StudentPortalNav />
      </PageHero>

      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
      {successMessage ? (
        <div className="app-feedback app-feedback-success">{successMessage}</div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle>Login Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Student Name
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {student?.name || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Username
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {student?.rollNumber || "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Students sign in with roll number, not email.
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Email
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {student?.email || "Not set"}
              </p>
            </div>
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
                  onChange={(e) => setCurrentPassword(e.target.value)}
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
                  onChange={(e) => setNewPassword(e.target.value)}
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
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
