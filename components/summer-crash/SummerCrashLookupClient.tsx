"use client";

import Link from "next/link";
import { MessageCircleMore } from "lucide-react";
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
  campaignTitle: string;
  supportContact: string;
  supportHref?: string;
};

type SummerCrashLookupResponse = {
  success?: boolean;
  message?: string;
  matches?: SummerCrashLookupMatch[];
};

export default function SummerCrashLookupClient({
  campaignTitle,
  supportContact,
  supportHref = "",
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
    <div className="public-flow-surface public-summer-flow-surface public-summer-flow-stack">
      <div className="space-y-3 text-center">
        <div className="public-flow-badge mx-auto w-fit">Account Recovery</div>
        <h1 className="text-[clamp(2rem,4vw,2.7rem)] font-extrabold tracking-tight text-foreground">
          Find your child account
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-6 text-muted-foreground">
          Enter the parent phone number used during registration for{" "}
          {campaignTitle}. We will show the linked student accounts before you
          continue to sign in.
        </p>
      </div>

      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      <form className="public-summer-flow-stack" onSubmit={handleSubmit}>
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
          {isPending ? "Finding..." : "Find account"}
        </Button>
      </form>

      {results.length > 0 ? (
        <div className="public-summer-flow-stack">
          {results.map((match) => (
            <div
              key={`${match.summerId}-${match.studentName}`}
              className="public-flow-card public-summer-flow-stack"
            >
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
              <div>
                <Link
                  href={`${SUMMER_CRASH_SIGNIN_PATH}?phone=${encodeURIComponent(
                    phone,
                  )}&summerId=${encodeURIComponent(String(match.summerId || ""))}`}
                  className="public-flow-button-secondary w-full justify-center sm:inline-flex sm:w-auto"
                >
                  Continue to parent sign in
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {results.length === 0 && !errorMessage ? (
        <div className="public-flow-card-soft public-summer-flow-stack text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            If you already registered, the linked summer student accounts will
            appear here.
          </p>
          {supportContact ? (
            supportHref ? (
              <p className="text-sm font-medium text-foreground">
                <a
                  href={supportHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 underline-offset-4 transition hover:underline"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  WhatsApp support
                </a>
              </p>
            ) : (
              <p className="text-sm font-medium text-foreground">
                Support: {supportContact}
              </p>
            )
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
              Parent sign in
            </Link>
            <Link href={SUMMER_CRASH_REGISTER_PATH} className="public-flow-text-link">
              Create parent account
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
