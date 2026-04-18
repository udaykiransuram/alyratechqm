"use client";

import Link from "next/link";
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
  SUMMER_CRASH_REGISTER_PATH,
  SUMMER_CRASH_SIGNIN_PATH,
} from "@/lib/summer-crash/constants";
import {
  normalizeSummerCrashLookupMatches,
  type NormalizedSummerCrashLookupMatch,
  type SummerCrashLookupMatch,
} from "@/lib/summer-crash/shared";

type SummerCrashLookupClientProps = {
  title: string;
  supportContact: string;
};

type SummerCrashLookupResponse = {
  success?: boolean;
  message?: string;
  matches?: SummerCrashLookupMatch[];
};

export default function SummerCrashLookupClient({
  title,
  supportContact,
}: SummerCrashLookupClientProps) {
  const [phone, setPhone] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [results, setResults] = useState<NormalizedSummerCrashLookupMatch[]>(
    [],
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStudentPortalSignInPath(SUMMER_CRASH_SIGNIN_PATH);
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phone.trim()) {
      setErrorMessage("Enter the parent phone number to continue.");
      return;
    }

    setErrorMessage("");

    startTransition(() => {
      void (async () => {
        try {
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

          const nextResults = normalizeSummerCrashLookupMatches(response.matches);
          if (nextResults.length === 0) {
            throw new Error(
              "We couldn't find any Summer Crash Course students for that phone number.",
            );
          }

          setResults(nextResults);
        } catch (error) {
          setResults([]);
          setErrorMessage(
            getClientRequestErrorMessage(
              error,
              "We couldn't find any Summer Crash Course students for that phone number.",
            ),
          );
        }
      })();
    });
  };

  return (
    <div className="public-flow-surface space-y-6">
      <div className="space-y-2 text-center">
        <div className="public-flow-badge mx-auto w-fit">Sign-in Help</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Enter the parent phone number used during registration. We will show
          the linked summer student accounts.
        </p>
      </div>

      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="public-flow-label" htmlFor="lookupPhone">
            Parent phone / WhatsApp number
          </label>
          <Input
            id="lookupPhone"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setResults([]);
              setErrorMessage("");
            }}
            className="public-flow-input"
            inputMode="tel"
            placeholder="Enter registered phone number"
          />
        </div>

        <Button
          type="submit"
          disabled={isPending}
          className="public-flow-button-primary w-full justify-center"
        >
          {isPending ? "Finding..." : "Find Student"}
        </Button>
      </form>

      {results.length > 0 ? (
        <div className="space-y-4">
          {results.map((match) => (
            <div key={`${match.summerId}-${match.studentName}`} className="public-flow-card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {match.studentName}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {match.classBand}
                  </p>
                  {match.guardianName ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Parent: {match.guardianName}
                    </p>
                  ) : null}
                </div>
                <div className="sm:text-right">
                  <p className="public-flow-label">Backup ID</p>
                  <p className="mt-2 text-xl font-bold tracking-[0.08em] text-foreground">
                    {match.summerId}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Masked reference: {match.maskedSummerId}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  href={`${SUMMER_CRASH_SIGNIN_PATH}?phone=${encodeURIComponent(
                    phone,
                  )}&summerId=${encodeURIComponent(String(match.summerId || ""))}`}
                  className="public-flow-button-secondary w-full justify-center sm:inline-flex sm:w-auto"
                >
                  Continue to Sign In
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {results.length === 0 && !errorMessage ? (
        <div className="public-flow-card-soft space-y-2 text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            If you already registered, the linked summer student accounts will
            appear here.
          </p>
          {supportContact ? (
            <p className="text-sm font-medium text-foreground">
              Support: {supportContact}
            </p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
              Go to Sign In
            </Link>
            <Link href={SUMMER_CRASH_REGISTER_PATH} className="public-flow-text-link">
              Register Free
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
