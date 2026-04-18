"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import { setSchoolSelectionCookies } from "@/lib/client/school";
import { setStudentPortalSignInPath } from "@/lib/client/student-portal-signin-path";
import {
  SUMMER_CRASH_DISPLAY_NAME,
  SUMMER_CRASH_SCHOOL_KEY,
  SUMMER_CRASH_SIGNIN_PATH,
} from "@/lib/summer-crash/constants";

type SummerCrashWelcomeClientProps = {
  title: string;
  supportContact: string;
  studentName: string;
  guardianName: string;
  classBand: string;
  summerId: string;
  courseTitle: string;
  nextDestinationHref?: string | null;
};

type SummerCrashCompleteSetupResponse = {
  success?: boolean;
  message?: string;
  state?: {
    destinationHref?: string;
  };
};

export default function SummerCrashWelcomeClient({
  title,
  supportContact,
  studentName,
  guardianName,
  classBand,
  summerId,
  courseTitle,
  nextDestinationHref = null,
}: SummerCrashWelcomeClientProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStudentPortalSignInPath(SUMMER_CRASH_SIGNIN_PATH);
    setSchoolSelectionCookies(
      SUMMER_CRASH_SCHOOL_KEY,
      SUMMER_CRASH_DISPLAY_NAME,
    );
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newPassword.trim()) {
      setErrorMessage("Choose a new password to continue.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The password confirmation does not match.");
      return;
    }

    setErrorMessage("");

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetchApiJson<SummerCrashCompleteSetupResponse>(
            "/api/summer-crash/complete-setup",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                newPassword,
                nextDestinationHref,
              }),
              schoolKey: SUMMER_CRASH_SCHOOL_KEY,
              includeSchoolQuery: false,
              fallbackMessage:
                "We couldn't finish the Summer Crash Course setup.",
            },
          );

          if (!response?.success) {
            throw new Error(
              response?.message ||
                "We couldn't finish the Summer Crash Course setup.",
            );
          }

          window.location.assign(
            response.state?.destinationHref || "/student/crash-course",
          );
        } catch (error) {
          setErrorMessage(
            getClientRequestErrorMessage(
              error,
              "We couldn't finish the Summer Crash Course setup.",
            ),
          );
        }
      })();
    });
  };

  return (
    <div className="public-flow-surface space-y-6">
      <div className="space-y-2 text-center">
        <div className="public-flow-badge mx-auto w-fit">One quick step</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Set your password
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {studentName}, create a password once to open your summer account.
        </p>
      </div>

      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      <div className="public-flow-card-soft space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="app-meta-chip">{classBand}</span>
          <span className="app-meta-chip">
            {courseTitle || "Summer Crash Course"}
          </span>
        </div>
        {guardianName ? (
          <p className="text-sm font-medium text-foreground">
            Parent: {guardianName}
          </p>
        ) : null}
        <p className="text-sm leading-6 text-muted-foreground">
          Later sign-ins use the parent phone number and this new password.
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          Backup ID (only if support asks):{" "}
          <span className="font-semibold tracking-[0.06em] text-foreground">
            {summerId}
          </span>
        </p>
        {supportContact ? (
          <p className="text-sm font-medium text-foreground">
            Support: {supportContact}
          </p>
        ) : null}
      </div>

      <form className="public-flow-card space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="public-flow-label" htmlFor="newPassword">
            Create password
          </label>
          <Input
            id="newPassword"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value);
              setErrorMessage("");
            }}
            className="public-flow-input"
            type="password"
            placeholder="Create new password"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="public-flow-label" htmlFor="confirmPassword">
            Confirm password
          </label>
          <Input
            id="confirmPassword"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setErrorMessage("");
            }}
            className="public-flow-input"
            type="password"
            placeholder="Re-enter password"
            autoComplete="new-password"
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="public-flow-button-primary w-full justify-center"
        >
          {isPending ? "Saving..." : "Save and Continue"}
        </Button>
      </form>
    </div>
  );
}
