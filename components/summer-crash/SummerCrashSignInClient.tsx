"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import { performCredentialSignIn } from "@/lib/client/next-auth-client";
import { setStudentPortalSignInPath } from "@/lib/client/student-portal-signin-path";
import {
  SUMMER_CRASH_HELP_PATH,
  SUMMER_CRASH_REGISTER_PATH,
  SUMMER_CRASH_SIGNIN_PATH,
  SUMMER_CRASH_WELCOME_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
} from "@/lib/summer-crash/constants";
import {
  normalizeSummerCrashLookupMatches,
  resolveSummerCrashSelectedSummerId,
  type NormalizedSummerCrashLookupMatch,
  type SummerCrashLookupMatch,
} from "@/lib/summer-crash/shared";

type SummerCrashSignInClientProps = {
  phone?: string;
  summerId?: string;
  pageError?: string;
};

type SummerCrashLookupResponse = {
  success?: boolean;
  message?: string;
  matches?: SummerCrashLookupMatch[];
};

async function fetchSummerCrashLookupMatches(phone: string) {
  const response = await fetchApiJson<SummerCrashLookupResponse>(
    "/api/summer-crash/lookup-id",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone }),
      includeSchoolQuery: false,
      fallbackMessage:
        "We couldn't find any Summer Crash Course students for that phone number.",
    },
  );

  if (!response?.success) {
    throw new Error(
      response?.message ||
        "We couldn't find any Summer Crash Course students for that phone number.",
    );
  }

  const matches = normalizeSummerCrashLookupMatches(response.matches);
  if (matches.length === 0) {
    throw new Error(
      "We couldn't find any Summer Crash Course students for that phone number.",
    );
  }

  return matches;
}

function getSummerCrashAuthErrorMessage(error: string | null | undefined) {
  const normalized = String(error || "").trim();
  if (!normalized) {
    return "";
  }

  if (normalized === "StudentRollNumberNotFound") {
    return "We couldn't find that Summer Crash Course student account anymore. Search by phone again.";
  }

  if (normalized === "StudentSignInFailed") {
    return "We couldn't sign in with that password. If this is the first sign-in, use the saved phone digits once and then create a new password.";
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
  phone: initialPhone = "",
  summerId = "",
  pageError = "",
}: SummerCrashSignInClientProps) {
  const [phone, setPhone] = useState(String(initialPhone || "").trim());
  const [matches, setMatches] = useState<NormalizedSummerCrashLookupMatch[]>(
    [],
  );
  const [selectedSummerId, setSelectedSummerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState(
    getSummerCrashAuthErrorMessage(pageError),
  );
  const [isLookupPending, startLookupTransition] = useTransition();
  const [isSignInPending, startSignInTransition] = useTransition();
  const initialPhoneValue = String(initialPhone || "").trim();
  const initialSummerIdValue = String(summerId || "").trim().toUpperCase();
  const initialPageErrorMessage = getSummerCrashAuthErrorMessage(pageError);
  const selectedMatch =
    matches.find((match) => match.summerId === selectedSummerId) || null;

  useEffect(() => {
    setStudentPortalSignInPath(SUMMER_CRASH_SIGNIN_PATH);
  }, []);

  useEffect(() => {
    if (!initialPhoneValue) {
      return;
    }

    let cancelled = false;

    startLookupTransition(() => {
      void (async () => {
        try {
          const nextMatches = await fetchSummerCrashLookupMatches(
            initialPhoneValue,
          );
          if (cancelled) {
            return;
          }

          setMatches(nextMatches);
          setSelectedSummerId(
            resolveSummerCrashSelectedSummerId(
              nextMatches,
              initialSummerIdValue,
            ),
          );
          if (!initialPageErrorMessage) {
            setSubmitError("");
          }
        } catch (error) {
          if (cancelled) {
            return;
          }

          setMatches([]);
          setSelectedSummerId("");
          if (!initialPageErrorMessage) {
            setSubmitError(
              getClientRequestErrorMessage(
                error,
                "We couldn't find any Summer Crash Course students for that phone number.",
              ),
            );
          }
        }
      })();
    });

    return () => {
      cancelled = true;
    };
  }, [initialPageErrorMessage, initialPhoneValue, initialSummerIdValue]);

  const handleLookupSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!phone.trim()) {
      setSubmitError("Enter the parent phone number to continue.");
      return;
    }

    setSubmitError("");
    setPassword("");

    startLookupTransition(() => {
      void (async () => {
        try {
          const nextMatches = await fetchSummerCrashLookupMatches(phone);
          setMatches(nextMatches);
          setSelectedSummerId(
            resolveSummerCrashSelectedSummerId(nextMatches, selectedSummerId),
          );
        } catch (error) {
          setMatches([]);
          setSelectedSummerId("");
          setSubmitError(
            getClientRequestErrorMessage(
              error,
              "We couldn't find any Summer Crash Course students for that phone number.",
            ),
          );
        }
      })();
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedSummerId) {
      setSubmitError("Choose the student account to continue.");
      return;
    }

    if (!password.trim()) {
      setSubmitError("Enter the password to continue.");
      return;
    }

    setSubmitError("");

    startSignInTransition(() => {
      void (async () => {
        const result = await performCredentialSignIn({
          provider: "school-user",
          callbackUrl: SUMMER_CRASH_WELCOME_PATH,
          credentials: {
            identifier: selectedSummerId,
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
          Enter the parent phone number first. If more than one student is linked,
          pick the student and continue with the password.
        </p>
      </div>

      {submitError ? (
        <FeedbackNotice variant="error">{submitError}</FeedbackNotice>
      ) : null}

      <div className="public-flow-card-soft space-y-5">
        <div className="flex items-start gap-3">
          <span className="public-flow-step">1</span>
          <div>
            <p className="text-lg font-semibold text-foreground">
              Find the student account
            </p>
            <p className="public-flow-helper">
              Use the phone or WhatsApp number shared during summer registration.
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={handleLookupSubmit}>
          <div>
            <label className="public-flow-label" htmlFor="summerPhone">
              Parent phone / WhatsApp number
            </label>
            <Input
              id="summerPhone"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setMatches([]);
                setSelectedSummerId("");
                setPassword("");
                setSubmitError("");
              }}
              className="public-flow-input"
              placeholder="Enter registered phone number"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>

          <Button
            type="submit"
            disabled={isLookupPending}
            className="public-flow-button-secondary w-full justify-center"
          >
            {isLookupPending ? "Finding student..." : "Find Student"}
          </Button>
        </form>
      </div>

      {matches.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="public-flow-step">2</span>
            <div>
              <p className="text-lg font-semibold text-foreground">
                {matches.length === 1 ? "Student found" : "Choose the student"}
              </p>
              <p className="public-flow-helper">
                {matches.length === 1
                  ? "The linked student account is ready below."
                  : "Select the student who should enter the summer course."}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {matches.map((match) => {
              const isSelected = match.summerId === selectedSummerId;

              return (
                <button
                  key={`${match.summerId}-${match.studentName}`}
                  type="button"
                  className={[
                    "w-full rounded-[1.35rem] border p-4 text-left transition",
                    isSelected
                      ? "border-primary/70 bg-primary/[0.06] shadow-sm ring-2 ring-primary/15"
                      : "border-border/70 bg-background/80 hover:border-primary/40 hover:bg-background",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedSummerId(match.summerId);
                    setPassword("");
                    setSubmitError("");
                  }}
                  aria-pressed={isSelected}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {match.studentName}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {match.classBand || "Summer Crash Course"}
                      </p>
                      {match.guardianName ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Parent: {match.guardianName}
                        </p>
                      ) : null}
                    </div>
                    <div className="sm:text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {isSelected ? "Selected" : "Tap to select"}
                      </p>
                      <p className="mt-2 text-sm font-medium text-foreground">
                        Backup ID: {match.maskedSummerId}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {selectedMatch ? (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="public-flow-card space-y-5">
            <div className="flex items-start gap-3">
              <span className="public-flow-step">3</span>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  Enter password
                </p>
                <p className="public-flow-helper">
                  Sign in for {selectedMatch.studentName}. Summer ID stays only
                  as a backup reference.
                </p>
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-border/70 bg-background/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                {selectedMatch.studentName}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedMatch.classBand || "Summer Crash Course"}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Backup ID: {selectedMatch.maskedSummerId}
              </p>
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
              disabled={isSignInPending}
              className="public-flow-button-primary w-full justify-center"
            >
              {isSignInPending ? "Signing in..." : "Sign In"}
            </Button>
          </div>
        </form>
      ) : matches.length > 1 ? (
        <FeedbackNotice variant="info">
          Choose the student account above to continue.
        </FeedbackNotice>
      ) : null}

      <div className="public-flow-card-soft space-y-3 text-center">
        <p className="text-sm leading-6 text-muted-foreground">
          Need help?
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={SUMMER_CRASH_REGISTER_PATH} className="public-flow-text-link">
            Register Free
          </Link>
          <Link href={SUMMER_CRASH_HELP_PATH} className="public-flow-text-link">
            Sign-in Help
          </Link>
        </div>
      </div>
    </div>
  );
}
