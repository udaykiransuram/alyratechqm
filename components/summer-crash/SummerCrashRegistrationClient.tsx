"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import { performCredentialSignIn } from "@/lib/client/next-auth-client";
import { setSchoolSelectionCookies } from "@/lib/client/school";
import {
  SUMMER_CRASH_DISPLAY_NAME,
  SUMMER_CRASH_HELP_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
  SUMMER_CRASH_SIGNIN_PATH,
} from "@/lib/summer-crash/constants";
import {
  buildSummerCrashWelcomeHref,
  formatSummerCrashPrice,
} from "@/lib/summer-crash/shared";

type SummerCrashRegistrationClientProps = {
  title: string;
  supportContact: string;
  classBands: Array<{
    classBand: string;
    className: string;
  }>;
  isActive: boolean;
  price: number;
  currency: string;
  entrySource?: "diagnostic" | "direct_registration";
};

type SummerCrashRegisterResponse = {
  success?: boolean;
  message?: string;
  registration?: {
    title?: string;
    supportContact?: string;
    studentName?: string;
    guardianName?: string;
    classBand?: string;
    summerId?: string;
    autoSignInAllowed?: boolean;
    bootstrapPassword?: string;
    signInPath?: string;
    destinationHref?: string;
    entrySource?: "diagnostic" | "direct_registration";
  };
};

const INITIAL_FORM_STATE = {
  studentName: "",
  classBand: "",
  sourceSchoolName: "",
  guardianName: "",
  phone: "",
  consent: false,
};

export default function SummerCrashRegistrationClient({
  title,
  supportContact,
  classBands,
  isActive,
  price,
  currency,
  entrySource = "direct_registration",
}: SummerCrashRegistrationClientProps) {
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [summerId, setSummerId] = useState("");
  const [nextHref, setNextHref] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedClassBand = useMemo(
    () =>
      classBands.find((option) => option.classBand === form.classBand) || null,
    [classBands, form.classBand],
  );

  const isDiagnosticEntry = entrySource === "diagnostic";
  const hasPaidCourseAccess = Number(price) > 0;
  const priceLabel = formatSummerCrashPrice(price, currency);
  const pageBadge = isDiagnosticEntry
    ? "Free Diagnostic"
    : hasPaidCourseAccess
      ? "Course Registration"
      : "Free Registration";
  const pageDescription = isDiagnosticEntry
    ? hasPaidCourseAccess
      ? "Register once to open the class-matched free diagnostic after sign-in. Lessons unlock later after payment."
      : "Register once to open the class-matched free diagnostic after sign-in."
    : hasPaidCourseAccess
      ? "Register once and go to the summer home after sign-in. The free diagnostic stays open there, and lessons unlock after payment."
      : "Register once and enter the summer learning space without using the normal school portal.";
  const submitLabel = isDiagnosticEntry
    ? "Register & Continue"
    : hasPaidCourseAccess
      ? "Register"
      : "Register Free";

  const handleRegister = () => {
    if (!form.studentName.trim()) {
      setErrorMessage("Enter the student's name to continue.");
      return;
    }

    if (!form.classBand.trim()) {
      setErrorMessage("Choose the class band for this student.");
      return;
    }

    if (!form.guardianName.trim()) {
      setErrorMessage("Enter the parent or guardian name to continue.");
      return;
    }

    if (!form.phone.trim()) {
      setErrorMessage("Enter a phone or WhatsApp number to continue.");
      return;
    }

    if (!form.consent) {
      setErrorMessage("Please confirm that the details are correct.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetchApiJson<SummerCrashRegisterResponse>(
            "/api/summer-crash/register",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                studentName: form.studentName,
                guardianName: form.guardianName,
                phone: form.phone,
                classBand: form.classBand,
                sourceSchoolName: form.sourceSchoolName,
                entrySource,
              }),
              schoolKey: SUMMER_CRASH_SCHOOL_KEY,
              includeSchoolQuery: false,
              fallbackMessage:
                "We couldn't complete Summer Crash Course registration.",
            },
          );

          const registration = response?.registration;
          const resolvedSummerId = String(registration?.summerId || "")
            .trim()
            .toUpperCase();
          const destinationHref =
            String(registration?.destinationHref || "").trim() ||
            "/student/crash-course";
          const signInHref = `${
            String(registration?.signInPath || SUMMER_CRASH_SIGNIN_PATH).trim() ||
            SUMMER_CRASH_SIGNIN_PATH
          }?phone=${encodeURIComponent(form.phone)}&summerId=${encodeURIComponent(
            resolvedSummerId,
          )}&next=${encodeURIComponent(destinationHref)}`;
          const welcomeHref = buildSummerCrashWelcomeHref(destinationHref);

          setSummerId(resolvedSummerId);
          setNextHref(signInHref);

          if (
            registration?.autoSignInAllowed &&
            resolvedSummerId &&
            registration.bootstrapPassword
          ) {
            const result = await performCredentialSignIn({
              provider: "school-user",
              callbackUrl: welcomeHref,
              credentials: {
                identifier: resolvedSummerId,
                password: registration.bootstrapPassword,
                schoolKey: SUMMER_CRASH_SCHOOL_KEY,
              },
            });

            if (result?.ok) {
              setSchoolSelectionCookies(
                SUMMER_CRASH_SCHOOL_KEY,
                SUMMER_CRASH_DISPLAY_NAME,
              );
              window.location.assign(result.url || welcomeHref);
              return;
            }
          }

          setSuccessMessage(
            isDiagnosticEntry
              ? "Registration complete. Continue to sign in and start the free diagnostic."
              : hasPaidCourseAccess
                ? "Registration complete. Continue to sign in, open the summer home, and unlock lessons after payment."
                : "Registration complete. Continue to sign in and open the learning space.",
          );
        } catch (error) {
          setErrorMessage(
            getClientRequestErrorMessage(
              error,
              "We couldn't complete Summer Crash Course registration.",
            ),
          );
        }
      })();
    });
  };

  return (
    <div className="public-flow-surface space-y-6">
      <div className="space-y-2 text-center">
        <div className="public-flow-badge mx-auto w-fit">{pageBadge}</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {pageDescription}
        </p>
      </div>

      {!isActive ? (
        <div className="public-flow-card space-y-3 text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Registrations are closed right now
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Contact the support team if you still need help with the summer
            batch.
          </p>
          {supportContact ? (
            <p className="text-sm font-medium text-foreground">
              Support: {supportContact}
            </p>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      {successMessage ? (
        <FeedbackNotice variant="success">{successMessage}</FeedbackNotice>
      ) : null}

      {summerId ? (
        <div className="public-flow-card space-y-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              Registration complete
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Sign in with the parent phone number below. Keep the backup ID
              only if support ever asks for it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="app-meta-chip">{form.phone}</span>
            <span className="app-meta-chip">{form.classBand}</span>
            {hasPaidCourseAccess ? (
              <span className="app-meta-chip">{priceLabel}</span>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Backup ID:{" "}
            <span className="font-semibold tracking-[0.06em] text-foreground">
              {summerId}
            </span>
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {isDiagnosticEntry
              ? "After sign-in, the student can start the free diagnostic right away."
              : hasPaidCourseAccess
                ? "After sign-in, the student goes to the summer home. The free diagnostic stays open there, and lessons unlock after payment."
                : "After sign-in, the student goes straight to the summer learning space."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={nextHref || SUMMER_CRASH_SIGNIN_PATH}
              className="public-flow-button-primary w-full justify-center sm:flex-1"
            >
              Continue to Sign In
            </Link>
            <Link
              href={SUMMER_CRASH_HELP_PATH}
              className="public-flow-button-secondary w-full justify-center sm:flex-1"
            >
              Need Help?
            </Link>
          </div>
        </div>
      ) : null}

      {!summerId && isActive ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            handleRegister();
          }}
        >
          <div className="public-flow-card-soft space-y-3">
            <p className="text-base font-semibold text-foreground">
              Easy sign-in for families
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Use the parent phone number later to sign in. Keep the backup ID
              only if support ever asks for it.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="app-meta-chip">
                {isDiagnosticEntry
                  ? "Free diagnostic first"
                  : hasPaidCourseAccess
                    ? "Course unlock after payment"
                    : "Course first, diagnostic later"}
              </span>
              <span className="app-meta-chip">
                {selectedClassBand?.classBand || "Choose class band"}
              </span>
              {hasPaidCourseAccess ? (
                <span className="app-meta-chip">{priceLabel}</span>
              ) : null}
            </div>
          </div>

          <div className="public-flow-card space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="public-flow-label" htmlFor="studentName">
                  Student name
                </label>
                <Input
                  id="studentName"
                  value={form.studentName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      studentName: event.target.value,
                    }))
                  }
                  className="public-flow-input"
                  placeholder="Enter the student's full name"
                />
              </div>

              <div>
                <label className="public-flow-label" htmlFor="classBand">
                  Class band / program
                </label>
                <select
                  id="classBand"
                  value={form.classBand}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      classBand: event.target.value,
                    }))
                  }
                  className="public-flow-input"
                >
                  <option value="">Choose class band</option>
                  {classBands.map((option) => (
                    <option key={option.classBand} value={option.classBand}>
                      {option.classBand}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="public-flow-label" htmlFor="guardianName">
                  Parent / guardian name
                </label>
                <Input
                  id="guardianName"
                  value={form.guardianName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      guardianName: event.target.value,
                    }))
                  }
                  className="public-flow-input"
                  placeholder="Enter parent or guardian name"
                />
              </div>

              <div>
                <label className="public-flow-label" htmlFor="phone">
                  Phone / WhatsApp number
                </label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="public-flow-input"
                  inputMode="tel"
                  placeholder="Enter active phone number"
                />
              </div>
            </div>

            <div>
              <label className="public-flow-label" htmlFor="sourceSchoolName">
                Current school name (optional)
              </label>
              <Input
                id="sourceSchoolName"
                value={form.sourceSchoolName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sourceSchoolName: event.target.value,
                  }))
                }
                className="public-flow-input"
                placeholder="School name"
              />
            </div>

            <label className="public-flow-card-soft flex items-start gap-3">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    consent: event.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4"
              />
              <span className="text-sm leading-6 text-muted-foreground">
                I confirm that these student and parent details are correct and
                may be used for the Summer Crash Course access flow.
              </span>
            </label>

            <Button
              type="submit"
              disabled={isPending}
              className="public-flow-button-primary w-full justify-center"
            >
              {isPending ? "Registering..." : submitLabel}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="public-flow-card-soft space-y-2 text-center">
        <p className="text-sm text-muted-foreground">Already registered?</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
            Go to Sign In
          </Link>
          <Link href={SUMMER_CRASH_HELP_PATH} className="public-flow-text-link">
            Need sign-in help?
          </Link>
        </div>
      </div>
    </div>
  );
}
