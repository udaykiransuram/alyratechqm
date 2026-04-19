"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, MessageCircleMore } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import {
  ChartBarIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

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
import { formatSummerCrashPrice } from "@/lib/summer-crash/shared";

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
  price,
  currency,
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
  const hasPaidCourseAccess = Number(price) > 0;
  const priceLabel = formatSummerCrashPrice(price, currency);
  const pageDescription = isDiagnosticEntry
    ? "Register once to open the class-matched free diagnostic and keep future sign-ins simple."
    : "Register once to enter the Summer flow with the same phone number and password each time.";
  const submitLabel = isDiagnosticEntry
    ? "Register & Start Test"
    : hasPaidCourseAccess
      ? "Register"
      : "Register Free";
  const supportLabel = supportContact || "";
  const supportWhatsappHref = useMemo(
    () => String(supportHref || "").trim(),
    [supportHref],
  );
  const introBadgeLabel = isDiagnosticEntry
    ? "Free diagnostic first"
    : hasPaidCourseAccess
      ? "Summer course registration"
      : "Free summer registration";
  const accessSummary = hasPaidCourseAccess
    ? `Free diagnostic first. Guided lessons unlock after payment (${priceLabel}).`
    : "The free diagnostic and the Summer lessons are both open right now.";
  const registrationHighlights = useMemo(
    () => [
      {
        title: "One family login",
        copy:
          "Use the parent phone number and the password created here for every Summer sign-in.",
        icon: DevicePhoneMobileIcon,
      },
      {
        title: isDiagnosticEntry ? "Class-matched diagnostic" : "Direct Summer access",
        copy: isDiagnosticEntry
          ? "After sign-in, the child goes straight to the free diagnostic for the selected class."
          : "After sign-in, the child goes straight to the Summer home. The diagnostic stays available there too.",
        icon: ShieldCheckIcon,
      },
      {
        title: "Simple parent report",
        copy:
          "Parents see weak areas and the next best step in a simpler, easier-to-read format.",
        icon: ChartBarIcon,
      },
    ],
    [isDiagnosticEntry],
  );

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
    <div className="public-flow-shell-narrow space-y-5 sm:space-y-6">
      <section className="public-flow-hero text-left">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="public-flow-badge">{introBadgeLabel}</span>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Summer Crash Course
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                {pageDescription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {["Phone-first sign-in", "Class-matched", "Parent-friendly"].map(
                (pill) => (
                  <span
                    key={pill}
                    className="inline-flex items-center rounded-full border border-[hsl(var(--public-border)/0.72)] bg-white/72 px-3.5 py-1.5 text-xs font-semibold text-[hsl(var(--public-ink))] shadow-[0_16px_30px_-26px_rgba(15,23,42,0.16)]"
                  >
                    {pill}
                  </span>
                ),
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            <Link
              href={SUMMER_CRASH_SIGNIN_PATH}
              className="public-flow-button-secondary inline-flex min-w-[12rem] items-center justify-center"
            >
              Already registered? Sign In
            </Link>
            <Link
              href={SUMMER_CRASH_HELP_PATH}
              className="public-flow-text-link inline-flex items-center gap-2"
            >
              Need help finding the account?
            </Link>
          </div>
        </div>
      </section>

      {!isActive ? (
        <div className="public-flow-card space-y-4 text-center">
          <h2 className="text-2xl font-semibold text-foreground">
            Registrations are closed right now
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Summer registrations are temporarily closed. Families who already
            registered can still sign in, and new families can contact support
            for the next available batch.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href={SUMMER_CRASH_SIGNIN_PATH}
              className="public-flow-button-secondary inline-flex items-center justify-center"
            >
              Go to Sign In
            </Link>
            <Link
              href={SUMMER_CRASH_HELP_PATH}
              className="public-flow-text-link inline-flex items-center justify-center gap-2"
            >
              Need sign-in help?
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {supportContact ? (
            <div className="flex flex-wrap justify-center gap-2 text-sm font-medium text-foreground">
              <span>Support:</span>
              {supportWhatsappHref ? (
                <a
                  href={supportWhatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-foreground underline-offset-4 transition hover:text-foreground/80 hover:underline"
                >
                  <MessageCircleMore className="h-4 w-4" />
                  {supportContact}
                </a>
              ) : (
                <span>{supportContact}</span>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="public-summer-register-grid">
          <aside className="public-summer-register-side">
            <div className="public-flow-card-soft space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  What parents can expect
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                  One simple Summer setup for the family
                </h2>
                <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                  Register once. Then use the same phone number and password for
                  the diagnostic, report, and all future Summer sign-ins.
                </p>
              </div>

              <div className="public-summer-register-list">
                {registrationHighlights.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div key={item.title} className="public-summer-register-list-item">
                      <span className="public-summer-register-icon">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          {item.copy}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="public-summer-register-callout space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Access note
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">
                {hasPaidCourseAccess
                  ? `${priceLabel} guided course access`
                  : "Free Summer access right now"}
              </h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {accessSummary}
              </p>
              {supportLabel ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  <span className="font-medium">Need help?</span>
                  {supportWhatsappHref ? (
                    <a
                      href={supportWhatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 font-semibold text-foreground underline-offset-4 transition hover:text-foreground/80 hover:underline"
                    >
                      <MessageCircleMore className="h-4 w-4" />
                      {supportLabel}
                    </a>
                  ) : (
                    <span>{supportLabel}</span>
                  )}
                </div>
              ) : null}
            </div>
          </aside>

          <div className="public-flow-surface public-summer-register-form space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Registration form
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Start in about a minute
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Enter the child&apos;s details, the parent phone number, and a
                password the family will remember.
              </p>
            </div>

            {errorMessage ? (
              <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
            ) : null}

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                handleRegister();
              }}
            >
              <section className="public-summer-register-form-section">
                <div className="public-summer-register-section-head">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Child details
                    </h3>
                    <p className="public-flow-helper">
                      Add the child&apos;s name and choose the right class band.
                    </p>
                  </div>
                </div>

                <div className="public-summer-register-field-grid">
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
              </section>

              <section className="public-summer-register-form-section">
                <div className="public-summer-register-section-head">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Parent details
                    </h3>
                    <p className="public-flow-helper">
                      This phone number becomes the main Summer sign-in.
                    </p>
                  </div>
                </div>

                <div className="public-summer-register-field-grid">
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
              </section>

              <section className="public-summer-register-form-section">
                <div className="public-summer-register-section-head">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Create password
                    </h3>
                    <p className="public-flow-helper">
                      Choose one password the family can remember easily.
                    </p>
                  </div>
                </div>

                <div className="public-summer-register-field-grid">
                  <div>
                    <label className="public-flow-label" htmlFor="password">
                      Create password
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
                    <p className="public-flow-helper mt-2">
                      Use at least 6 characters.
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
                  className="mt-1 h-4 w-4"
                />
                <span className="text-sm leading-6 text-muted-foreground">
                  I confirm that these student and parent details are correct
                  for the Summer Crash Course registration.
                </span>
              </label>

              <div className="public-summer-register-submit">
                <Button
                  type="submit"
                  disabled={isPending}
                  className="public-flow-button-primary w-full justify-center text-base"
                >
                  {isPending ? "Registering..." : submitLabel}
                </Button>
                <p className="text-xs leading-6 text-muted-foreground sm:text-sm">
                  One registration sets up future Summer sign-ins for the family.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
