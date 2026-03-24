"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Building2, Eye, EyeOff, Loader2, School } from "lucide-react";

import { clearSchoolKeyCookie } from "@/lib/client/school";
import { getAuthErrorMessage } from "@/lib/auth-runtime";
import { getClientRequestErrorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";

export default function CompanySignInClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pageErrorMessage = getAuthErrorMessage(
    searchParams.get("error"),
    "company",
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError("");
    setIsLoading(true);

    const callbackUrl =
      searchParams.get("callbackUrl")?.trim() || "/company/schools";

    try {
      const result = await signIn("company-admin", {
        redirect: false,
        email,
        password,
        callbackUrl,
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
    <div className="app-auth-shell">
      <div className="app-auth-frame">
        <div className="app-auth-card">
          <section className="app-auth-panel app-auth-panel-strong">
            <div className="app-auth-switcher">
              <Link href="/auth/signin" className="app-auth-switcher-item">
                <School className="h-4 w-4" />
                School
              </Link>
              <span className="app-auth-switcher-item app-auth-switcher-item-active">
                <Building2 className="h-4 w-4" />
                Company
              </span>
            </div>

            <div className="space-y-4">
              <div className="app-auth-icon">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="space-y-3">
                <p className="app-auth-kicker">Company Administration</p>
                <h1 className="app-auth-title">Manage schools from one place</h1>
                <p className="app-auth-copy">
                  Company admins use a separate login to create schools, seed
                  the first school admin, and handle company-level maintenance
                  without mixing into tenant-scoped school user sessions.
                </p>
              </div>
            </div>
          </section>

          <section className="app-auth-panel app-auth-panel-form">
            <div className="space-y-2">
              <p className="app-auth-kicker">Company Admin Sign In</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                Continue to school operations
              </h2>
              <p className="app-auth-copy max-w-none">
                Use the bootstrap or existing company-admin account to reach the
                school management workspace.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="app-auth-form"
              aria-busy={isLoading}
            >
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
                  Email
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
                  className="h-11"
                  required
                />
              </div>

              <div className="app-field-group">
                <div className="flex items-center justify-between gap-3">
                  <label className="app-field-label" htmlFor="password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
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
                    className="h-11 pr-12"
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

              <Button type="submit" disabled={isLoading} className="h-11 w-full text-sm">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in
                  </>
                ) : (
                  "Sign In"
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
          </section>
        </div>
      </div>
    </div>
  );
}
