"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import { setStudentPortalSignInPath } from "@/lib/client/student-portal-signin-path";
import {
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
}: SummerCrashWelcomeClientProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStudentPortalSignInPath(SUMMER_CRASH_SIGNIN_PATH);
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
              }),
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
        <div className="public-flow-badge mx-auto w-fit">Welcome</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Set a new password once before entering the summer course.
        </p>
      </div>

      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="public-flow-card space-y-3">
          <div>
            <p className="public-flow-label">Student</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {studentName}
            </p>
          </div>
          <div>
            <p className="public-flow-label">Class band</p>
            <p className="mt-2 text-base font-medium text-foreground">
              {classBand}
            </p>
          </div>
          <div>
            <p className="public-flow-label">Summer ID</p>
            <p className="mt-2 text-2xl font-bold tracking-[0.08em] text-foreground">
              {summerId}
            </p>
          </div>
          {guardianName ? (
            <div>
              <p className="public-flow-label">Parent / guardian</p>
              <p className="mt-2 text-base font-medium text-foreground">
                {guardianName}
              </p>
            </div>
          ) : null}
        </div>

        <div className="public-flow-card-soft space-y-3">
          <div>
            <p className="public-flow-label">Assigned course</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {courseTitle || "Summer Crash Course"}
            </p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            After the password is updated, the student goes directly into the
            summer learning space.
          </p>
          {supportContact ? (
            <p className="text-sm font-medium text-foreground">
              Support: {supportContact}
            </p>
          ) : null}
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="public-flow-label" htmlFor="newPassword">
            New password
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
          {isPending ? "Saving..." : "Continue to Summer Course"}
        </Button>
      </form>
    </div>
  );
}

