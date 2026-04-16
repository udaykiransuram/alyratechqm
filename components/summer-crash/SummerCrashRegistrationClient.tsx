"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

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

type SummerCrashRegistrationClientProps = {
  title: string;
  supportContact: string;
  classBands: Array<{
    classBand: string;
    className: string;
  }>;
  isActive: boolean;
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
}: SummerCrashRegistrationClientProps) {
  const [form, setForm] = useState(INITIAL_FORM_STATE);
  const [step, setStep] = useState<1 | 2>(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [summerId, setSummerId] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setStudentPortalSignInPath(SUMMER_CRASH_SIGNIN_PATH);
  }, []);

  const selectedClassBand = useMemo(
    () =>
      classBands.find((option) => option.classBand === form.classBand) || null,
    [classBands, form.classBand],
  );

  const handleNextStep = () => {
    if (!form.studentName.trim()) {
      setErrorMessage("Enter the student's name to continue.");
      return;
    }

    if (!form.classBand.trim()) {
      setErrorMessage("Choose the class band for this student.");
      return;
    }

    setErrorMessage("");
    setStep(2);
  };

  const handleRegister = () => {
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
              }),
              includeSchoolQuery: false,
              fallbackMessage:
                "We couldn't complete Summer Crash Course registration.",
            },
          );

          if (!response?.success || !response.registration?.summerId) {
            throw new Error(
              response?.message ||
                "We couldn't complete Summer Crash Course registration.",
            );
          }

          const nextSummerId = String(
            response.registration.summerId || "",
          ).trim();
          setSummerId(nextSummerId);
          setSuccessMessage(
            `Registration completed for ${response.registration.studentName || form.studentName}.`,
          );

          if (
            response.registration.autoSignInAllowed &&
            response.registration.bootstrapPassword
          ) {
            setStudentPortalSignInPath(
              response.registration.signInPath || SUMMER_CRASH_SIGNIN_PATH,
            );

            const signInResult = await performCredentialSignIn({
              provider: "school-user",
              callbackUrl: SUMMER_CRASH_WELCOME_PATH,
              credentials: {
                identifier: nextSummerId,
                password: String(
                  response.registration.bootstrapPassword || "",
                ),
                schoolKey: SUMMER_CRASH_SCHOOL_KEY,
              },
            });

            if (signInResult?.ok) {
              window.location.assign(
                signInResult.url || SUMMER_CRASH_WELCOME_PATH,
              );
              return;
            }
          }
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
        <div className="public-flow-badge mx-auto w-fit">Free Registration</div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Register once. The student gets a separate Summer ID and enters only
          the summer portal.
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
          <div>
            <p className="public-flow-label">Summer ID</p>
            <p className="mt-2 text-2xl font-bold tracking-[0.08em] text-foreground">
              {summerId}
            </p>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Keep this Summer ID safe. Use it on the summer sign-in page. The
            first sign-in uses the phone digits once and then asks the student
            to set a new password.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={`${SUMMER_CRASH_SIGNIN_PATH}?summerId=${encodeURIComponent(
                summerId,
              )}`}
              className="public-flow-button-primary w-full justify-center sm:flex-1"
            >
              Go to Sign In
            </Link>
            <Link
              href={SUMMER_CRASH_HELP_PATH}
              className="public-flow-button-secondary w-full justify-center sm:flex-1"
            >
              Find Summer ID
            </Link>
          </div>
        </div>
      ) : null}

      {!summerId && isActive ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="public-flow-stat-card">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Step
              </p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {step} of 2
              </p>
            </div>
            <div className="public-flow-stat-card">
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Selected batch
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {selectedClassBand?.classBand || "Choose class band"}
              </p>
            </div>
          </div>

          {step === 1 ? (
            <div className="space-y-5">
              <div className="public-flow-section">
                <div className="flex items-center gap-3">
                  <span className="public-flow-step">1</span>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      Student details
                    </p>
                    <p className="public-flow-helper">
                      Start with the student name and class band.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
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
                  <label
                    className="public-flow-label"
                    htmlFor="sourceSchoolName"
                  >
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
              </div>

              <Button
                type="button"
                className="public-flow-button-primary w-full justify-center"
                onClick={handleNextStep}
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="public-flow-section">
                <div className="flex items-center gap-3">
                  <span className="public-flow-step">2</span>
                  <div>
                    <p className="text-lg font-semibold text-foreground">
                      Parent contact
                    </p>
                    <p className="public-flow-helper">
                      Add the parent name and phone number for access and
                      recovery.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
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
                    I confirm that these student and parent details are correct
                    and may be used for the Summer Crash Course access flow.
                  </span>
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="public-flow-button-secondary w-full justify-center sm:flex-1"
                  onClick={() => {
                    setErrorMessage("");
                    setStep(1);
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  disabled={isPending}
                  className="public-flow-button-primary w-full justify-center sm:flex-1"
                  onClick={handleRegister}
                >
                  {isPending ? "Registering..." : "Register Free"}
                </Button>
              </div>
            </div>
          )}
        </>
      ) : null}

      <div className="public-flow-card-soft space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          Already registered?
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={SUMMER_CRASH_SIGNIN_PATH} className="public-flow-text-link">
            Go to Sign In
          </Link>
          <Link href={SUMMER_CRASH_HELP_PATH} className="public-flow-text-link">
            Find my Summer ID
          </Link>
        </div>
      </div>
    </div>
  );
}

