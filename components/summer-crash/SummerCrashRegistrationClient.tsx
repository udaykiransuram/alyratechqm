"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, MessageCircleMore } from "lucide-react";
import { useState, useTransition } from "react";

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
  entrySource,
}: SummerCrashRegistrationClientProps) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isPending, startTransition] = useTransition();

  const resolvedEntrySource =
    entrySource ||
    (String(searchParams.get("entry") || "").trim() === "diagnostic"
      ? "diagnostic"
      : "direct_registration");

  const isDiagnosticEntry = resolvedEntrySource === "diagnostic";
  const campaignTitle =
    String(title || SUMMER_CRASH_DISPLAY_NAME).trim() ||
    SUMMER_CRASH_DISPLAY_NAME;
  const pageTitle = "Create account";
  const pageSummary = isDiagnosticEntry
    ? "Create the family sign-in and open the free diagnostic next."
    : "Use the parent phone number for future sign-ins.";
  const submitLabel = "Create account";
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
    <div className="public-flow-shell-narrow public-summer-register-shell">
      {!isActive ? (
        <div className="public-flow-surface public-summer-register-panel space-y-5 text-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {campaignTitle}
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Registration is closed
            </h1>
          </div>
          <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Existing families can still sign in. For help, contact support.
          </p>
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
        </div>
      ) : (
        <div className="public-flow-surface public-summer-register-panel space-y-5 sm:space-y-6">
          <div className="public-summer-register-header">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {campaignTitle}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                {pageTitle}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
                {pageSummary}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Already registered?{" "}
              <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
                Sign in
              </Link>
            </div>
          </div>

          {errorMessage ? (
            <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
          ) : null}

          <form
            className="space-y-4 sm:space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              handleRegister();
            }}
          >
            <section className="public-flow-card-soft space-y-4">
              <div className="flex items-start gap-3">
                <span className="public-flow-step">1</span>
                <p className="pt-0.5 text-lg font-semibold text-foreground">
                  Student
                </p>
              </div>

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
                    placeholder="Student full name"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="public-flow-label" htmlFor="classBand">
                    Class
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
                    <option value="">Select class</option>
                    {classBands.map((option) => (
                      <option key={option.classBand} value={option.classBand}>
                        {option.classBand}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
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
            </section>

            <section className="public-flow-card-soft space-y-4">
              <div className="flex items-start gap-3">
                <span className="public-flow-step">2</span>
                <p className="pt-0.5 text-lg font-semibold text-foreground">
                  Parent
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
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

                <div>
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
            </section>

            <section className="public-flow-card-soft space-y-4">
              <div className="flex items-start gap-3">
                <span className="public-flow-step">3</span>
                <p className="pt-0.5 text-lg font-semibold text-foreground">
                  Password
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
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
                  <p className="public-flow-helper">
                    Minimum 6 characters.
                  </p>
                </div>

                <div>
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
            </section>

            <label className="flex items-start gap-3 rounded-2xl border border-[hsl(var(--public-border)/0.62)] bg-[hsl(var(--public-surface)/0.9)] px-4 py-4 sm:px-5">
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

            <div className="rounded-2xl border border-[hsl(var(--public-border)/0.62)] bg-[hsl(var(--public-surface)/0.94)] p-4 shadow-[0_22px_42px_-34px_hsl(var(--public-shadow)/0.14)] sm:p-5">
              <Button
                type="submit"
                disabled={isPending}
                className="public-flow-button-primary w-full justify-center"
              >
                {isPending ? "Creating account..." : submitLabel}
                {!isPending ? <ArrowRight className="h-4 w-4" /> : null}
              </Button>

              {supportWhatsappHref ? (
                <div className="mt-3 text-center text-sm">
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
                <div className="mt-3 text-center text-sm text-muted-foreground">
                  Need help? {supportText}
                </div>
              ) : (
                <div className="mt-3 text-center text-sm">
                  <Link
                    href={SUMMER_CRASH_HELP_PATH}
                    className="public-flow-text-link inline-flex items-center gap-1"
                  >
                    Need help?
                  </Link>
                </div>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
