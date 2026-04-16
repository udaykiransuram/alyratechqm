"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { performCredentialSignIn } from "@/lib/client/next-auth-client";
import { setStudentPortalSignInPath } from "@/lib/client/student-portal-signin-path";
import {
  SUMMER_CRASH_HELP_PATH,
  SUMMER_CRASH_REGISTER_PATH,
  SUMMER_CRASH_SIGNIN_PATH,
  SUMMER_CRASH_WELCOME_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
} from "@/lib/summer-crash/constants";

type SummerCrashSignInClientProps = {
  summerId?: string;
  pageError?: string;
};

function getSummerCrashAuthErrorMessage(error: string | null | undefined) {
  const normalized = String(error || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized === "StudentRollNumberNotFound") {
    return "We couldn't find a Summer Crash Course account with that Summer ID.";
  }

  if (normalized === "StudentSignInFailed") {
    return "We couldn't sign in with that Summer ID and password. If this is the first sign-in, use the saved phone digits once and then create a new password.";
  }

  if (normalized === "StudentAlreadySignedIn") {
    return "This Summer Crash Course account is already active on another device or browser.";
  }

  if (normalized === "StudentSignInRateLimited") {
    return "Too many Summer Crash Course sign-in attempts were made. Please wait a little and retry.";
  }

  if (normalized === "SchoolNotFound") {
    return "Summer Crash Course sign-in is not ready yet. Please try again shortly.";
  }

  return "We couldn't complete Summer Crash Course sign-in.";
}

export default function SummerCrashSignInClient({
  summerId = "",
  pageError = "",
}: SummerCrashSignInClientProps) {
  const [identifier, setIdentifier] = useState(String(summerId || "").trim());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState(
    getSummerCrashAuthErrorMessage(pageError),
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStudentPortalSignInPath(SUMMER_CRASH_SIGNIN_PATH);
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedIdentifier = identifier.trim().toUpperCase();
    if (!trimmedIdentifier) {
      setSubmitError("Enter the Summer ID to continue.");
      return;
    }

    if (!password.trim()) {
      setSubmitError("Enter the password to continue.");
      return;
    }

    setSubmitError("");

    startTransition(() => {
      void (async () => {
        const result = await performCredentialSignIn({
          provider: "school-user",
          callbackUrl: SUMMER_CRASH_WELCOME_PATH,
          credentials: {
            identifier: trimmedIdentifier,
            password,
            schoolKey: SUMMER_CRASH_SCHOOL_KEY,
          },
        });

        if (!result?.ok) {
          setSubmitError(getSummerCrashAuthErrorMessage(result?.error));
          return;
        }

        setStudentPortalSignInPath(SUMMER_CRASH_SIGNIN_PATH);
        window.location.assign(result.url || SUMMER_CRASH_WELCOME_PATH);
      })().catch(() => {
        setSubmitError("We couldn't complete Summer Crash Course sign-in.");
      });
    });
  };

  return (
    <div className="public-flow-surface space-y-6">
      <div className="space-y-2 text-center">
        <div className="public-flow-badge mx-auto w-fit">Summer Sign In</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Sign in to Summer Crash Course
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Use the Summer ID and password created for the summer batch only.
        </p>
      </div>

      {submitError ? (
        <FeedbackNotice variant="error">{submitError}</FeedbackNotice>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="public-flow-label" htmlFor="summerId">
            Summer ID
          </label>
          <Input
            id="summerId"
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value.toUpperCase());
              setSubmitError("");
            }}
            className="public-flow-input"
            placeholder="Enter Summer ID"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
          />
        </div>

        <div>
          <label className="public-flow-label" htmlFor="summerPassword">
            Password
          </label>
          <div className="relative">
            <Input
              id="summerPassword"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setSubmitError("");
              }}
              className="public-flow-input pr-12"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="public-flow-helper mt-2">
            First sign-in uses the saved phone digits once, then the student
            creates a new password.
          </p>
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="public-flow-button-primary w-full justify-center"
        >
          {isPending ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="public-flow-card-soft space-y-3 text-center">
        <p className="text-sm leading-6 text-muted-foreground">
          Need help?
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={SUMMER_CRASH_REGISTER_PATH} className="public-flow-text-link">
            Register Free
          </Link>
          <Link href={SUMMER_CRASH_HELP_PATH} className="public-flow-text-link">
            Find my Summer ID
          </Link>
        </div>
      </div>
    </div>
  );
}

