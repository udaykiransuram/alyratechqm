"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, RefreshCcw } from "lucide-react";

import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import type { StudentPasswordAdminInfo } from "@/lib/user-credentials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import FeedbackNotice from "@/components/ui/feedback-notice";

type StudentPasswordAdminPanelProps = {
  studentId: string;
  schoolKey?: string;
  initialInfo?: StudentPasswordAdminInfo;
};

export default function StudentPasswordAdminPanel({
  studentId,
  schoolKey,
  initialInfo,
}: StudentPasswordAdminPanelProps) {
  const credentialActionButtonClassName =
    "h-auto min-h-12 w-full justify-center whitespace-normal px-4 py-3 text-center sm:min-w-[15rem]";

  const [passwordInfo, setPasswordInfo] = useState<StudentPasswordAdminInfo | undefined>(
    initialInfo,
  );
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "reset_to_default" | "generate_temporary" | null
  >(null);

  useEffect(() => {
    setPasswordInfo(initialInfo);
    setRevealedPassword(null);
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [initialInfo, studentId]);

  const displayPassword = revealedPassword || passwordInfo?.currentPassword || "";
  const passwordLabel = revealedPassword
    ? "Current password (revealed in this session)"
    : passwordInfo?.state === "default_phone"
      ? "Current password"
      : "Current password";
  const hasDisplayPassword = Boolean(displayPassword);

  const canResetToDefault = Boolean(passwordInfo?.defaultPasswordAvailable);
  const statusToneClass = useMemo(() => {
    if (passwordInfo?.state === "default_phone") {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (passwordInfo?.state === "custom") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-slate-200 bg-slate-50 text-slate-700";
  }, [passwordInfo?.state]);

  const handleCopyPassword = async () => {
    if (!displayPassword || typeof navigator === "undefined") {
      return;
    }

    try {
      await navigator.clipboard.writeText(displayPassword);
      setSuccessMessage("Password copied to the clipboard.");
      setErrorMessage(null);
    } catch {
      setErrorMessage("Could not copy the password automatically.");
    }
  };

  const handleReset = async (
    action: "reset_to_default" | "generate_temporary",
  ) => {
    try {
      const resolvedSchoolKey = resolveClientSchoolKey(schoolKey);
      if (!resolvedSchoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      setPendingAction(action);
      setErrorMessage(null);

      const data = await fetchApiJson<{
        credentials?: StudentPasswordAdminInfo;
        password?: string;
        message?: string;
      }>(`/api/users/${studentId}/student-password`, {
        method: "POST",
        schoolKey: resolvedSchoolKey,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        fallbackMessage: "Failed to update the student password.",
      });

      setPasswordInfo(data.credentials);
      setRevealedPassword(String(data.password || "").trim() || null);
      setSuccessMessage(
        data.message ||
          (action === "reset_to_default"
            ? "Student password reset to the saved phone-number digits."
            : "Temporary student password generated successfully."),
      );
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Failed to update the student password.",
      );
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <Card className="app-surface overflow-hidden">
      <CardHeader className="app-section-header">
        <CardTitle>Student Credentials</CardTitle>
      </CardHeader>
      <CardContent className="app-section-body space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Admins can see the current password only when the student still uses
          the default saved-phone-number-digits password. Custom passwords are
          stored only as secure hashes and cannot be recovered.
        </p>

        {successMessage ? (
          <FeedbackNotice variant="success">
            <div className="space-y-2">
              <p>{successMessage}</p>
              {revealedPassword ? (
                <div className="flex flex-wrap items-center gap-2">
                  <code className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800">
                    {revealedPassword}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPassword}
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
              ) : null}
            </div>
          </FeedbackNotice>
        ) : null}

        {errorMessage ? (
          <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${statusToneClass}`}
              >
                {passwordInfo?.label || "Credential state unavailable"}
              </span>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {passwordInfo?.detail ||
                "Open this page again after the student record loads to inspect the current credential state."}
            </p>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className={credentialActionButtonClassName}
              onClick={() => handleReset("reset_to_default")}
              disabled={!canResetToDefault || pendingAction !== null}
            >
              <RefreshCcw className="h-4 w-4" />
              <span className="text-center leading-5">
                {pendingAction === "reset_to_default"
                  ? "Resetting..."
                  : "Reset to Phone Digits"}
              </span>
            </Button>
            <Button
              type="button"
              size="lg"
              className={credentialActionButtonClassName}
              onClick={() => handleReset("generate_temporary")}
              disabled={pendingAction !== null}
            >
              <KeyRound className="h-4 w-4" />
              <span className="text-center leading-5">
                {pendingAction === "generate_temporary"
                  ? "Generating..."
                  : "Generate Temporary Password"}
              </span>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {passwordLabel}
          </p>
          {hasDisplayPassword ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-lg border border-border/70 bg-background px-3 py-2 text-sm font-semibold text-foreground">
                {displayPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyPassword}
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              The current password cannot be shown because the student is using a
              custom password and only its secure hash is stored.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
