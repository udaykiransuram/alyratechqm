"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, MessageCircleMore } from "lucide-react";
import { useState, useTransition } from "react";

import SummerCrashEarlyBirdOffer from "@/components/summer-crash/SummerCrashEarlyBirdOffer";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { SummerCrashEarlyBirdOffer as SummerCrashEarlyBirdOfferData } from "@/lib/summer-crash/offer";

type SummerCrashRegistrationClientProps = {
  title: string;
  supportContact: string;
  supportHref?: string;
  classBands: Array<{
    classBand: string;
    className: string;
  }>;
  isActive: boolean;
  price: number;
  currency: string;
  earlyBirdOffer?: SummerCrashEarlyBirdOfferData | null;
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
    signInPassword?: string;
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
  password: "",
  confirmPassword: "",
  consent: false,
};

export default function SummerCrashRegistrationClient({
  title,
  supportContact,
  supportHref = "",
  classBands,
  isActive,
  price,
  earlyBirdOffer = null,
  entrySource,
}: SummerCrashRegistrationClientProps) {
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isPending, startTransition] = useTransition();

  const resolvedEntrySource =
    entrySource === "diagnostic" ? "diagnostic" : "direct_registration";

  const isDiagnosticEntry = resolvedEntrySource === "diagnostic";
  const hasPaidCourseAccess = Number(price) > 0;
  const campaignTitle =
    String(title || SUMMER_CRASH_DISPLAY_NAME).trim() ||
    SUMMER_CRASH_DISPLAY_NAME;
  const pageTitle = isDiagnosticEntry
    ? "Register & start test"
    : "Create parent account";
  const pageSummary = isDiagnosticEntry
    ? "Free diagnostic opens right after signup."
    : hasPaidCourseAccess
      ? "Use one parent sign-in for the full Summer Crash flow. Payment opens right after signup."
      : "Use one parent sign-in for the full Summer Crash flow.";
  const submitLabel = isDiagnosticEntry
    ? "Create account & start test"
    : hasPaidCourseAccess
      ? "Create account & pay course fee"
      : "Create account";
  const supportLabel = supportContact || "";
  const supportWhatsappHref = String(supportHref || "").trim();
  const supportText = supportWhatsappHref
    ? "WhatsApp support"
    : supportLabel || "Get help";

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

    if (!form.password.trim()) {
      setErrorMessage("Create a password to continue.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setErrorMessage("The password confirmation does not match.");
      return;
    }

    if (!form.consent) {
      setErrorMessage("Please confirm that the details are correct.");
      return;
    }

    setErrorMessage("");
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
                password: form.password,
                entrySource: resolvedEntrySource,
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

          if (
            registration?.autoSignInAllowed &&
            resolvedSummerId &&
            registration.signInPassword
          ) {
            const result = await performCredentialSignIn({
              provider: "school-user",
              callbackUrl: destinationHref,
              credentials: {
                identifier: resolvedSummerId,
                password: registration.signInPassword,
                schoolKey: SUMMER_CRASH_SCHOOL_KEY,
              },
            });

            if (result?.ok) {
              setSchoolSelectionCookies(
                SUMMER_CRASH_SCHOOL_KEY,
                SUMMER_CRASH_DISPLAY_NAME,
              );
              window.location.assign(result.url || destinationHref);
              return;
            }
          }

          window.location.assign(signInHref);
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
    <div className="public-flow-surface public-summer-flow-surface public-summer-register-panel public-summer-flow-stack">
      {!isActive ? (
        <>
          <div className="public-summer-flow-stack text-center">
            <div className="public-flow-badge mx-auto w-fit">{campaignTitle}</div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Registration is closed
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Existing families can still sign in. For help, contact support.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={SUMMER_CRASH_SIGNIN_PATH}
              className="public-flow-button-secondary inline-flex items-center justify-center"
            >
              Sign in
            </Link>
            {supportWhatsappHref ? (
              <a
                href={supportWhatsappHref}
                target="_blank"
                rel="noreferrer"
                className="public-flow-button-secondary inline-flex items-center justify-center"
              >
                <MessageCircleMore className="h-4 w-4" />
                Get help
              </a>
            ) : (
              <Link
                href={SUMMER_CRASH_HELP_PATH}
                className="public-flow-button-secondary inline-flex items-center justify-center"
              >
                Get help
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          {supportContact ? (
            <div className="flex flex-wrap justify-center gap-2 text-sm font-medium text-foreground">
              {supportWhatsappHref ? (
                <a
                  href={supportWhatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-foreground underline-offset-4 transition hover:text-foreground/80 hover:underline"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  WhatsApp support
                </a>
              ) : (
                <>
                  <span>Support:</span>
                  <span>{supportContact}</span>
                </>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="space-y-3 border-b border-[hsl(var(--public-register-border)/0.56)] pb-4 text-center sm:text-left">
            <div className="public-flow-badge mx-auto w-fit sm:mx-0">
              {campaignTitle}
            </div>
            <h1 className="public-summer-register-title">{pageTitle}</h1>
            <p className="public-summer-register-summary mx-auto sm:mx-0">
              {pageSummary}
            </p>
            <p className="text-sm text-muted-foreground">
              Already registered?{" "}
              <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
                Sign in
              </Link>
            </p>
          </div>

          {earlyBirdOffer ? (
            <SummerCrashEarlyBirdOffer
              offer={earlyBirdOffer}
              variant="soft"
              compact
              className="mt-2 mx-auto w-full max-w-[34rem] sm:mx-0"
              title="Early bird course price"
              subtitle={
                isDiagnosticEntry
                  ? "Start the free diagnostic now and keep this course price."
                  : "Create the parent account now and keep this course price."
              }
            />
          ) : null}

          {errorMessage ? (
            <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
          ) : null}

          <form
            className="public-summer-flow-stack"
            onSubmit={(event) => {
              event.preventDefault();
              handleRegister();
            }}
          >
            <div className="public-summer-flow-grid public-summer-flow-grid-2">
              <div className="public-summer-register-field">
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
                  placeholder="Student full name"
                  autoComplete="name"
                />
              </div>

              <div className="public-summer-register-field">
                <label className="public-flow-label" htmlFor="classBand">
                  Class
                </label>
                <Select
                  value={form.classBand}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      classBand: value,
                    }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="classBand"
                    aria-label="Class"
                    className="public-summer-register-select-trigger"
                  >
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent className="public-summer-register-select-content">
                    {classBands.map((option) => (
                      <SelectItem key={option.classBand} value={option.classBand}>
                        {option.classBand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="public-summer-flow-stack">
              <div className="public-summer-register-field">
                <label className="public-flow-label" htmlFor="sourceSchoolName">
                  School name
                  <span className="text-muted-foreground"> (optional)</span>
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
                  placeholder="Current school"
                  autoComplete="organization"
                />
              </div>
            </div>

            <div className="public-summer-flow-grid public-summer-flow-grid-2">
              <div className="public-summer-register-field">
                <label className="public-flow-label" htmlFor="guardianName">
                  Parent name
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
                  placeholder="Parent or guardian name"
                  autoComplete="name"
                />
              </div>

              <div className="public-summer-register-field">
                <label className="public-flow-label" htmlFor="phone">
                  Phone number
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
                  autoComplete="tel"
                  placeholder="Active phone number"
                />
              </div>
            </div>

            <div className="public-summer-flow-grid public-summer-flow-grid-2">
              <div className="public-summer-register-field">
                <label className="public-flow-label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    className="public-flow-input pr-12"
                    type={showPasswords ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Create password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPasswords((current) => !current)}
                    aria-label={showPasswords ? "Hide password" : "Show password"}
                  >
                    {showPasswords ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="public-flow-helper">Minimum 6 characters.</p>
              </div>

              <div className="public-summer-register-field">
                <label className="public-flow-label" htmlFor="confirmPassword">
                  Confirm password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    value={form.confirmPassword}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                    className="public-flow-input pr-12"
                    type={showPasswords ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPasswords((current) => !current)}
                    aria-label={
                      showPasswords
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showPasswords ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <label className="public-summer-register-consent">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    consent: event.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--public-accent))]"
              />
              <span className="text-sm leading-6 text-foreground">
                I confirm these details are correct.
              </span>
            </label>

            <div className="public-summer-register-submit public-summer-flow-stack">
              <Button
                type="submit"
                disabled={isPending}
                className="public-flow-button-primary w-full justify-center"
              >
                {isPending ? "Creating account..." : submitLabel}
                {!isPending ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>

              {isDiagnosticEntry ? (
                <p className="public-summer-register-submit-note">
                  The free diagnostic opens right after account creation.
                </p>
              ) : null}

              {supportWhatsappHref ? (
                <div className="public-summer-register-support">
                  <a
                    href={supportWhatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    className="public-flow-text-link inline-flex items-center gap-1"
                  >
                    <MessageCircleMore className="h-4 w-4" />
                    {supportText}
                  </a>
                </div>
              ) : supportLabel ? (
                <div className="public-summer-register-support text-muted-foreground">
                  Need help? {supportText}
                </div>
              ) : (
                <div className="public-summer-register-support">
                  <Link
                    href={SUMMER_CRASH_HELP_PATH}
                    className="public-flow-text-link inline-flex items-center gap-1"
                  >
                    Find registered account
                  </Link>
                </div>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
