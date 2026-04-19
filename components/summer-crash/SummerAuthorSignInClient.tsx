"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Rocket, ShieldCheck, Users } from "lucide-react";

import {
  AuthFormHeader,
  AuthHeroPanel,
  AuthShell,
} from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { getAuthErrorMessage } from "@/lib/auth-runtime";
import { performCredentialSignIn } from "@/lib/client/next-auth-client";
import { setSchoolSelectionCookies } from "@/lib/client/school";
import {
  SUMMER_CRASH_PUBLIC_TESTS_PATH,
  SUMMER_CRASH_SCHOOL_KEY,
} from "@/lib/summer-crash/constants";

type SummerAuthorSignInClientProps = {
  schoolLabel: string;
  requestedCallbackUrl?: string;
  pageError?: string;
};

export default function SummerAuthorSignInClient({
  schoolLabel,
  requestedCallbackUrl = SUMMER_CRASH_PUBLIC_TESTS_PATH,
  pageError = "",
}: SummerAuthorSignInClientProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    getAuthErrorMessage(pageError, "school"),
  );
  const [isPending, startTransition] = useTransition();

  const callbackUrl = requestedCallbackUrl || SUMMER_CRASH_PUBLIC_TESTS_PATH;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      setErrorMessage("Enter the summer-author email to continue.");
      return;
    }

    if (!password.trim()) {
      setErrorMessage("Enter the password to continue.");
      return;
    }

    setErrorMessage("");

    startTransition(() => {
      void (async () => {
        try {
          const result = await performCredentialSignIn({
            provider: "school-user",
            callbackUrl,
            credentials: {
              identifier: email.trim(),
              password,
              schoolKey: SUMMER_CRASH_SCHOOL_KEY,
            },
          });

          if (!result?.ok) {
            setErrorMessage(
              getAuthErrorMessage(result?.error, "school") ||
                "We couldn't sign in to the Summer author workspace.",
            );
            return;
          }

          setSchoolSelectionCookies(SUMMER_CRASH_SCHOOL_KEY, schoolLabel);
          window.location.assign(result.url || callbackUrl);
        } catch {
          setErrorMessage(
            "We couldn't sign in to the Summer author workspace.",
          );
        }
      })();
    });
  };

  return (
    <AuthShell
      activeRoute="school"
      hero={
        <AuthHeroPanel
          icon={Rocket}
          eyebrow="Summer Author Access"
          title="Manage summer live classes and diagnostics from the real workspace"
          copy="This sign-in opens the hidden Summer Crash workspace so internal authors can use the existing live-class, question, paper, class, and analytics tools without a duplicate admin surface."
          points={[
            {
              icon: ShieldCheck,
              title: "Hidden summer tenant",
              copy: "The school picker stays fixed to the Summer Crash workspace.",
            },
            {
              icon: Users,
              title: "Normal school-user auth",
              copy: "Admins and teachers sign in with their regular workspace credentials for the summer tenant.",
            },
          ]}
          noteTitle="Internal use only"
          noteCopy="Use this only for summer live classes, public diagnostics, and summer lead/result tracking."
        />
      }
    >
      <div className="space-y-6">
        <AuthFormHeader
          eyebrow="Summer Workspace"
          title="Sign in as a summer author"
          copy={`This route signs you into ${schoolLabel} directly.`}
          badges={["Summer tenant", "Workspace authoring"]}
        />

        {errorMessage ? (
          <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
        ) : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="app-field-label" htmlFor="summer-author-email">
              Email
            </label>
            <Input
              id="summer-author-email"
              type="email"
              autoComplete="username"
              placeholder="teacher@alyra.tech"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage("");
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="app-field-label" htmlFor="summer-author-password">
              Password
            </label>
            <div className="relative">
              <Input
                id="summer-author-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrorMessage("");
                }}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Open Summer Workspace"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
