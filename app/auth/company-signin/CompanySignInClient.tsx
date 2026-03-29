"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

import {
  AuthFormHeader,
  AuthHeroPanel,
  AuthShell,
} from "@/components/auth/AuthShell";
import { clearSchoolKeyCookie } from "@/lib/client/school";
import { getAuthErrorMessage } from "@/lib/auth-runtime";
import { getClientRequestErrorMessage } from "@/lib/client/api";
import { performCredentialSignIn } from "@/lib/client/next-auth-client";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";

type CompanySignInClientProps = {
  initialCallbackUrl?: string;
  pageError?: string;
  signedOut?: boolean;
};

export default function CompanySignInClient({
  initialCallbackUrl = "/company/schools",
  pageError = "",
  signedOut = false,
}: CompanySignInClientProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pageErrorMessage = getAuthErrorMessage(
    pageError,
    "company",
  );
  const callbackUrl = String(initialCallbackUrl || "").trim() || "/company/schools";
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError("");
    setIsLoading(true);

    try {
      const result = await performCredentialSignIn({
        provider: "company-admin",
        callbackUrl,
        credentials: {
          email,
          password,
        },
      });

      if (!result || !result.ok) {
        setSubmitError(
          getAuthErrorMessage(result?.error, "company") ||
            "We couldn't sign you in to the company admin workspace. Please check your credentials and try again.",
        );
        return;
      }

      clearSchoolKeyCookie();
      window.location.assign(result.url || callbackUrl);
    } catch (error: unknown) {
      setSubmitError(
        getClientRequestErrorMessage(
          error,
          "We couldn't sign you in to the company admin workspace.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell
      activeRoute="company"
      hero={
        <AuthHeroPanel
          icon={Building2}
          eyebrow="Company sign in"
          title="Sign in to the company portal"
          copy=""
        />
      }
    >
      <AuthFormHeader
        eyebrow="Company sign in"
        title="Sign in"
        copy=""
      />

      <form
        onSubmit={handleSubmit}
        className="app-auth-form"
        aria-busy={isLoading}
      >
        {signedOut && !pageErrorMessage ? (
          <FeedbackNotice variant="success">
            You have been signed out of the company admin portal.
          </FeedbackNotice>
        ) : null}

        {pageErrorMessage ? (
          <FeedbackNotice variant="error">
            {pageErrorMessage}
          </FeedbackNotice>
        ) : null}

        {submitError ? (
          <FeedbackNotice variant="error">
            {submitError}
          </FeedbackNotice>
        ) : null}

        <div className="app-field-group">
          <label className="app-field-label" htmlFor="email">
            Company email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="admin@yourcompany.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setSubmitError("");
            }}
            autoComplete="email"
            autoFocus
            className="h-12"
            required
          />
          <p className="app-auth-field-note">
            Use the email address attached to your company-admin account.
          </p>
        </div>

        <div className="app-field-group">
          <div className="flex items-center justify-between gap-3">
            <label className="app-field-label" htmlFor="password">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setSubmitError("");
              }}
              autoComplete="current-password"
              className="h-12 pr-12"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground transition hover:text-foreground"
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
          size="lg"
          disabled={isLoading}
          className="app-auth-submit"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in
            </>
          ) : (
            "Enter company portal"
          )}
        </Button>
      </form>

      <p className="app-auth-footer">
        Need school access?{" "}
        <Link
          href="/auth/signin"
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Use school sign in
        </Link>
      </p>
    </AuthShell>
  );
}
