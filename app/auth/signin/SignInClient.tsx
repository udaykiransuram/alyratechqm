"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  School,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from "@/components/ui/searchable-command-select";
import { getAuthErrorMessage } from "@/lib/auth-runtime";
import {
  getSchoolKeyFromCookie,
  setSchoolSelectionCookies,
} from "@/lib/client/school";
import { toast } from "@/components/ui/use-toast";

type SchoolOption = {
  key: string;
  displayName: string;
};

type SchoolsResponse = {
  success?: boolean;
  schools?: Array<{ key?: string; displayName?: string }>;
  message?: string;
};

export default function SignInClient() {
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [schoolKey, setSchoolKey] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const callbackUrl = searchParams.get("callbackUrl")?.trim() || "/workspace";
  const pageErrorMessage = getAuthErrorMessage(
    searchParams.get("error"),
    "school",
  );
  useEffect(() => {
    let mounted = true;

    async function loadSchools() {
      try {
        setSchoolsLoading(true);
        setSchoolsError("");

        const response = await fetch("/api/public/schools", {
          cache: "no-store",
        });
        const data: SchoolsResponse = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.message || "Failed to load schools.");
        }

        if (!mounted) return;

        const nextSchools = Array.isArray(data.schools)
          ? data.schools
              .map((school) => ({
                key: String(school?.key || "").trim(),
                displayName: String(school?.displayName || "").trim(),
              }))
              .filter(
                (school: SchoolOption) => school.key && school.displayName,
              )
          : [];

        setSchools(nextSchools);

        const rememberedSchoolKey = getSchoolKeyFromCookie();
        const rememberedSchool = nextSchools.find(
          (school: SchoolOption) => school.key === rememberedSchoolKey,
        );
        if (
          rememberedSchoolKey &&
          rememberedSchool
        ) {
          setSchoolKey(rememberedSchoolKey);
          setSchoolSelectionCookies(
            rememberedSchoolKey,
            rememberedSchool.displayName,
          );
          return;
        }

        if (nextSchools.length === 1) {
          setSchoolKey(nextSchools[0].key);
          setSchoolSelectionCookies(
            nextSchools[0].key,
            nextSchools[0].displayName,
          );
        }
      } catch (error: unknown) {
        if (!mounted) return;
        setSchools([]);
        setSchoolsError(
          error instanceof Error
            ? error.message
            : "Failed to load schools. Please refresh and try again.",
        );
      } finally {
        if (mounted) {
          setSchoolsLoading(false);
        }
      }
    }

    void loadSchools();

    return () => {
      mounted = false;
    };
  }, []);

  const schoolOptions: SearchableCommandOption[] = schools.map((school) => ({
    value: school.key,
    label: school.displayName,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedSchoolKey = schoolKey.trim();
    if (!trimmedSchoolKey) {
      toast({
        title: "Select your school",
        description: "Choose your school from the list before signing in.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const result = await signIn("school-user", {
      redirect: false,
      identifier,
      password,
      schoolKey: trimmedSchoolKey,
      callbackUrl,
    });

    setIsLoading(false);

    if (!result || !result.ok) {
      const errorMessage = getAuthErrorMessage(result?.error, "school")
        || "Login failed. Please check your credentials and try again.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    const selectedSchool = schools.find((school) => school.key === trimmedSchoolKey);
    setSchoolSelectionCookies(
      trimmedSchoolKey,
      selectedSchool?.displayName,
    );
    window.location.assign(result.url || callbackUrl);
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
          </section>

          <section className="app-auth-panel app-auth-panel-form">
            <div className="space-y-2">
              <p className="app-auth-kicker">School Sign In</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                Continue to the quality workspace
              </h2>
              <p className="app-auth-copy max-w-none">
                Choose your school first, then use email or roll number with the
                matching password.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="app-auth-form"
              aria-busy={isLoading}
            >
              {pageErrorMessage ? (
                <div className="app-feedback app-feedback-error">
                  {pageErrorMessage}
                </div>
              ) : null}

              {schoolsError ? (
                <div className="app-feedback app-feedback-error">
                  {schoolsError}
                </div>
              ) : null}

              <div className="app-field-group">
                <label className="app-field-label" htmlFor="schoolKey">
                  School
                </label>
                <SearchableCommandSelect
                  value={schoolKey}
                  options={schoolOptions}
                  onValueChange={setSchoolKey}
                  placeholder={schoolsLoading ? "Loading schools..." : schools.length > 0 ? "Search and select your school" : "No schools available"}
                  searchPlaceholder="Search schools..."
                  emptyText="No schools found."
                  disabled={schoolsLoading || schools.length === 0}
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

              <Button
                type="submit"
                disabled={isLoading || schoolsLoading || schools.length === 0}
                className="h-11 w-full text-sm"
              >
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
