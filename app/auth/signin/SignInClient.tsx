"use client";

import Link from "next/link";
import { useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { Building2, Eye, EyeOff, Loader2, School } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDefaultRouteForRole } from "@/lib/auth-types";
import { setSchoolKeyCookie } from "@/lib/client/school";
import { toast } from "@/components/ui/use-toast";

export default function SignInClient() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [schoolKey, setSchoolKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const trimmedSchoolKey = schoolKey.trim();
    const result = await signIn("school-user", {
      redirect: false,
      identifier,
      password,
      schoolKey: trimmedSchoolKey,
    });

    setIsLoading(false);

    if (!result || !result.ok) {
      const errorMessage =
        result?.error ||
        "Login failed. Please check your credentials and try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    setSchoolKeyCookie(trimmedSchoolKey);
    const session = await getSession();
    const nextPath = session?.user?.role
      ? getDefaultRouteForRole(session.user.role)
      : "/";
    window.location.assign(nextPath);
  };

  return (
    <div className="app-auth-shell">
      <div className="app-auth-frame">
        <div className="app-auth-card">
          <section className="app-auth-panel app-auth-panel-strong">
            <div className="app-auth-switcher">
              <span className="app-auth-switcher-item app-auth-switcher-item-active">
                <School className="h-4 w-4" />
                School
              </span>
              <Link
                href="/auth/company-signin"
                className="app-auth-switcher-item"
              >
                <Building2 className="h-4 w-4" />
                Company
              </Link>
            </div>

            <div className="space-y-4">
              <div className="app-auth-icon">
                <School className="h-6 w-6" />
              </div>
              <div className="space-y-3">
                <p className="app-auth-kicker">School Workspace Access</p>
                <h1 className="app-auth-title">Sign in to your school portal</h1>
                <p className="app-auth-copy">
                  Admins and teachers continue with email and password. Students
                  use their roll number as the username, with the default first
                  password matching that roll number until it is changed.
                </p>
              </div>
            </div>

            <div className="app-chip-cloud">
              <span className="app-meta-chip">School key required</span>
              <span className="app-meta-chip">Student roll-number login</span>
              <span className="app-meta-chip">Role-based redirect</span>
            </div>

            <div className="app-auth-feature-grid">
              <div className="app-auth-feature-card">
                <p className="app-auth-feature-title">School-scoped access</p>
                <p className="app-auth-feature-copy">
                  The school key ensures every sign-in stays inside the correct
                  tenant workspace.
                </p>
              </div>
              <div className="app-auth-feature-card">
                <p className="app-auth-feature-title">Student-ready credentials</p>
                <p className="app-auth-feature-copy">
                  Roll numbers work as usernames, which keeps student login easy
                  for tests and portal access.
                </p>
              </div>
              <div className="app-auth-feature-card">
                <p className="app-auth-feature-title">Same workspace flow</p>
                <p className="app-auth-feature-copy">
                  After login, each role lands on the right page for school
                  operations or assigned tests.
                </p>
              </div>
              <div className="app-auth-feature-card">
                <p className="app-auth-feature-title">Company admin available</p>
                <p className="app-auth-feature-copy">
                  Use the alternate company sign-in only for school creation and
                  company-level maintenance work.
                </p>
              </div>
            </div>
          </section>

          <section className="app-auth-panel app-auth-panel-form">
            <div className="space-y-2">
              <p className="app-auth-kicker">School Sign In</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                Continue to the quality workspace
              </h2>
              <p className="app-auth-copy max-w-none">
                Enter the school key first, then use email or roll number with
                the matching password.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="app-auth-form"
              aria-busy={isLoading}
            >
              <div className="app-field-group">
                <label className="app-field-label" htmlFor="schoolKey">
                  School Key
                </label>
                <Input
                  id="schoolKey"
                  type="text"
                  placeholder="alpha-high"
                  value={schoolKey}
                  onChange={(e) => setSchoolKey(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-11"
                  required
                />
              </div>

              <div className="app-field-group">
                <label className="app-field-label" htmlFor="identifier">
                  Email or Roll Number
                </label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="you@school.com or STU-1024"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  className="h-11"
                  required
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  Students sign in with their roll number. Their first password
                  usually matches that same roll number.
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
                    onChange={(e) => setPassword(e.target.value)}
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

              <div className="app-feedback app-feedback-info">
                Use the company sign-in only for company-level school
                management. School users should always stay on this login flow.
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
              Need company access?{" "}
              <Link
                href="/auth/company-signin"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Use company admin sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
