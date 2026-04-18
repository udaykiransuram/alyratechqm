"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  Eye,
  EyeOff,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

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
  classBands,
  isActive,
  price,
  currency,
  entrySource = "direct_registration",
}: SummerCrashRegistrationClientProps) {
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
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
    ? "Register & Start Test"
    : hasPaidCourseAccess
      ? "Register"
      : "Register Free";
  const accessLabel = isDiagnosticEntry
    ? "Free diagnostic first"
    : hasPaidCourseAccess
      ? "Lessons unlock after payment"
      : "Immediate summer access";
  const destinationLabel = isDiagnosticEntry
    ? "Diagnostic opens next"
    : hasPaidCourseAccess
      ? "Summer home opens next"
      : "Summer lessons open next";
  const supportLabel = supportContact || "Summer support available";
  const heroStats = [
    {
      label: "Class bands",
      value: String(classBands.length),
    },
    {
      label: "Access path",
      value: hasPaidCourseAccess ? priceLabel : accessLabel,
    },
    {
      label: "Sign-in",
      value: "Phone + password",
    },
  ];
  const nextSteps = [
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: "Complete one simple setup",
      description:
        "Add the student details, the parent phone number, and the class band in one place.",
    },
    {
      icon: <ShieldCheck className="h-4 w-4" />,
      title: "Create the family sign-in",
      description:
        "The same parent phone number and this password are used later to sign in again.",
    },
    {
      icon: <ArrowRight className="h-4 w-4" />,
      title: destinationLabel,
      description: isDiagnosticEntry
        ? "After registration, the child can move straight into the free class-matched diagnostic."
        : hasPaidCourseAccess
          ? "After registration, the family lands on the summer home where the diagnostic stays open and lessons unlock after payment."
          : "After registration, the child can enter the summer learning space without the normal school portal.",
    },
  ];
  const familyBenefits = [
    isDiagnosticEntry
      ? "Start with a class-matched free diagnostic and see the result right away."
      : hasPaidCourseAccess
        ? `Register once, keep the free diagnostic open, and unlock lessons later for ${priceLabel}.`
        : "Register once and open the summer learning space directly.",
    "Separate summer-only sign-in with no school picker or admin-style screens.",
    "Parent-friendly access using the same phone number and password each time.",
  ];
  const prepNotes = [
    "Keep the student’s full name ready before you begin.",
    "Use the parent phone number that will be used for future sign-ins.",
    "Choose the correct class band so the right diagnostic and summer lessons get linked.",
  ];

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
    <div className="space-y-8">
      <section className="public-flow-hero public-summer-hero">
        <div className="public-summer-hero-grid public-summer-register-hero-grid">
          <div className="space-y-6">
            <div className="public-flow-badge w-fit">{pageBadge}</div>
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Summer Crash Course
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {pageDescription}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {heroStats.map((stat) => (
                <div key={stat.label} className="public-flow-stat-card text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-foreground">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="public-summer-hero-card space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                What happens next
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                A clean family-first signup flow
              </h2>
            </div>

            <div className="public-summer-register-list">
              {nextSteps.map((step) => (
                <div key={step.title} className="public-summer-register-list-item">
                  <div className="public-summer-register-icon">{step.icon}</div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {step.title}
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="public-summer-register-callout">
              <div className="flex items-start gap-3">
                <PhoneCall className="mt-0.5 h-4 w-4 text-[hsl(var(--public-accent))]" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Need a hand while registering?
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {supportLabel}
                  </p>
                </div>
              </div>
            </div>
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
            <p className="text-sm font-medium text-foreground">
              Support: {supportContact}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="public-summer-register-grid">
          <aside className="public-summer-register-side">
            <div className="public-flow-card-soft space-y-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[hsl(var(--public-accent))]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Why families like this
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">
                    Less confusion, faster start
                  </h2>
                </div>
              </div>
              <div className="space-y-3">
                {familyBenefits.map((item) => (
                  <div key={item} className="public-summer-register-list-item">
                    <div className="public-summer-register-icon">
                      <BadgeCheck className="h-4 w-4" />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="public-flow-card space-y-4">
              <div className="flex items-center gap-3">
                <Clock3 className="h-5 w-5 text-[hsl(var(--public-accent))]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Before you start
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">
                    Keep these details ready
                  </h2>
                </div>
              </div>
              <div className="space-y-3">
                {prepNotes.map((note) => (
                  <div key={note} className="public-summer-register-list-item">
                    <div className="public-summer-register-icon">
                      <BadgeCheck className="h-4 w-4" />
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {note}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="public-flow-card-soft space-y-4">
              <div className="flex items-center gap-3">
                <PhoneCall className="h-5 w-5 text-[hsl(var(--public-accent))]" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Need help?
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">
                    Support stays close
                  </h2>
                </div>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {supportLabel}
              </p>
              <div className="flex flex-col gap-3">
                <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
                  Go to Sign In
                </Link>
                <Link href={SUMMER_CRASH_HELP_PATH} className="public-flow-text-link">
                  Need sign-in help?
                </Link>
              </div>
            </div>
          </aside>

          <div className="public-flow-surface public-summer-register-form space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Registration form
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">
                Register once and keep summer access simple
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Use the parent phone number and the password created here for
                future sign-ins. Keep the backup Summer ID only if support ever
                asks for it.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="app-meta-chip">{accessLabel}</span>
                <span className="app-meta-chip">
                  {selectedClassBand?.classBand || "Choose class band"}
                </span>
                <span className="app-meta-chip">{destinationLabel}</span>
              </div>
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
                  <span className="public-flow-step">1</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Student details
                    </h3>
                    <p className="public-flow-helper">
                      Add the child’s details and choose the correct class band.
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
                  <span className="public-flow-step">2</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Parent contact
                    </h3>
                    <p className="public-flow-helper">
                      This phone number becomes the main family sign-in path.
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
                  <span className="public-flow-step">3</span>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Create sign-in password
                    </h3>
                    <p className="public-flow-helper">
                      This password is used the next time the family signs in.
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
                      Choose a password with at least 6 characters.
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
                  and may be used for the Summer Crash Course access flow.
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
                  One registration sets up the family sign-in for all future
                  summer access.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
