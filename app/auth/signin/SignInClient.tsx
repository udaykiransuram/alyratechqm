"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  School,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import {
  SearchableCommandSelect,
  type SearchableCommandOption,
} from "@/components/ui/searchable-command-select";
import { getDefaultRouteForRole } from "@/lib/auth-types";
import { getAuthErrorMessage } from "@/lib/auth-runtime";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import {
  getSchoolKeyFromCookie,
  setSchoolSelectionCookies,
} from "@/lib/client/school";
import type { PublicSchoolOption } from "@/lib/server/public-school-data";

type SchoolOption = PublicSchoolOption;

type SchoolsResponse = {
  success?: boolean;
  schools?: Array<{ key?: string; displayName?: string }>;
  message?: string;
};

type SignInClientProps = {
  initialSchools?: SchoolOption[];
  initialSchoolKey?: string;
  requestedCallbackUrl?: string;
  pageError?: string;
};

function normalizeSchoolKey(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSchoolOptions(
  schools: SchoolOption[] | undefined,
): SchoolOption[] {
  if (!Array.isArray(schools)) {
    return [];
  }

  return schools
    .map((school) => ({
      key: normalizeSchoolKey(school?.key),
      displayName: String(school?.displayName || "").trim(),
    }))
    .filter((school) => school.key && school.displayName);
}

export default function SignInClient({
  initialSchools = [],
  initialSchoolKey = "",
  requestedCallbackUrl = "",
  pageError = "",
}: SignInClientProps) {
  const normalizedInitialSchools = useMemo(
    () => normalizeSchoolOptions(initialSchools),
    [initialSchools],
  );
  const normalizedInitialSchoolKey = normalizeSchoolKey(initialSchoolKey);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [schoolKey, setSchoolKey] = useState(
    normalizedInitialSchoolKey ||
      (normalizedInitialSchools.length === 1
        ? normalizedInitialSchools[0].key
        : ""),
  );
  const [schools, setSchools] =
    useState<SchoolOption[]>(normalizedInitialSchools);
  const [schoolsLoading, setSchoolsLoading] = useState(
    normalizedInitialSchools.length === 0,
  );
  const [schoolsError, setSchoolsError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const callbackUrl = requestedCallbackUrl || "/workspace";
  const pageErrorMessage = getAuthErrorMessage(
    pageError,
    "school",
  );
  const trimmedIdentifier = identifier.trim();
  const isStudentStyleIdentifier =
    trimmedIdentifier.length > 0 && !trimmedIdentifier.includes("@");
  const selectedSchool = schools.find((school) => school.key === schoolKey);
  const showStudentPasswordShortcut =
    isStudentStyleIdentifier &&
    Boolean(trimmedIdentifier) &&
    password !== trimmedIdentifier;
  const identifierHint = !trimmedIdentifier
    ? "Students: roll number. Staff: email."
    : isStudentStyleIdentifier
      ? "Roll number sign in."
      : "Email sign in.";
  const passwordHint = isStudentStyleIdentifier
    ? "Default password is the same as the roll number unless it was changed."
    : "";

  useEffect(() => {
    let mounted = true;

    if (normalizedInitialSchools.length > 0) {
      setSchools(normalizedInitialSchools);
      setSchoolsError("");
      setSchoolsLoading(false);

      const rememberedSchoolKey = normalizeSchoolKey(getSchoolKeyFromCookie());
      const rememberedSchool = normalizedInitialSchools.find(
        (school: SchoolOption) => school.key === rememberedSchoolKey,
      );
      const resolvedSchool =
        rememberedSchool ||
        normalizedInitialSchools.find(
          (school: SchoolOption) => school.key === normalizedInitialSchoolKey,
        ) ||
        (normalizedInitialSchools.length === 1
          ? normalizedInitialSchools[0]
          : null);

      if (resolvedSchool) {
        setSchoolKey((currentSchoolKey) =>
          currentSchoolKey || resolvedSchool.key,
        );
        setSchoolSelectionCookies(
          resolvedSchool.key,
          resolvedSchool.displayName,
        );
      }

      return () => {
        mounted = false;
      };
    }

    async function loadSchools() {
      try {
        setSchoolsLoading(true);
        setSchoolsError("");

        const data = await fetchApiJson<SchoolsResponse>("/api/public/schools", {
          cache: "no-store",
          includeSchoolQuery: false,
          fallbackMessage: "We couldn't load the school list.",
        });

        if (!mounted) return;

        const nextSchools = Array.isArray(data.schools)
          ? normalizeSchoolOptions(
              data.schools.map((school) => ({
                key: String(school?.key || ""),
                displayName: String(school?.displayName || ""),
              })),
            )
          : [];

        setSchools(nextSchools);

        const rememberedSchoolKey = normalizeSchoolKey(getSchoolKeyFromCookie());
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
          getClientRequestErrorMessage(
            error,
            "We couldn't load the school list.",
          ),
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
  }, [normalizedInitialSchoolKey, normalizedInitialSchools]);

  const schoolOptions: SearchableCommandOption[] = schools.map((school) => ({
    value: school.key,
    label: school.displayName,
  }));

  const handleSchoolChange = (nextSchoolKey: string) => {
    const normalizedSchoolKey = nextSchoolKey.trim().toLowerCase();
    setSubmitError("");
    setSchoolKey(normalizedSchoolKey);
    const selectedSchool = schools.find(
      (school) => school.key === normalizedSchoolKey,
    );
    if (selectedSchool) {
      setSchoolSelectionCookies(
        normalizedSchoolKey,
        selectedSchool.displayName,
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedSchoolKey = schoolKey.trim().toLowerCase();
    const submittedIdentifier = identifier.trim();
    setSubmitError("");

    if (!trimmedSchoolKey) {
      setSubmitError(
        "Choose your school from the list before signing in.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("school-user", {
        redirect: false,
        identifier: submittedIdentifier,
        password,
        schoolKey: trimmedSchoolKey,
        callbackUrl,
      });

      if (!result || !result.ok) {
        const errorMessage =
          getAuthErrorMessage(result?.error, "school") ||
          (isStudentStyleIdentifier
            ? "We couldn't sign in with that roll number and password. If this is your first login, try using the roll number as the password."
            : "We couldn't sign you in. Check your credentials and try again.");
        setSubmitError(errorMessage);
        return;
      }

      const selectedSchool = schools.find((school) => school.key === trimmedSchoolKey);
      setSchoolSelectionCookies(
        trimmedSchoolKey,
        selectedSchool?.displayName,
      );

      if (requestedCallbackUrl) {
        window.location.assign(result.url || requestedCallbackUrl);
        return;
      }

      try {
        const session = await getSession();
        const role = session?.user?.role;
        if (role) {
          window.location.assign(getDefaultRouteForRole(role));
          return;
        }
      } catch {}

      window.location.assign(result.url || callbackUrl);
    } catch (error: unknown) {
      setSubmitError(
        getClientRequestErrorMessage(error, "We couldn't sign you in."),
      );
    } finally {
      setIsLoading(false);
    }
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
                Administrator
              </Link>
            </div>

            <div className="space-y-4">
              <div className="app-auth-icon">
                <School className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <p className="app-auth-kicker">School Access</p>
                <h1 className="app-auth-title">School sign in</h1>
                <p className="app-auth-copy">
                  Students use roll number. Staff use email.
                </p>
              </div>
            </div>
          </section>

          <section className="app-auth-panel app-auth-panel-form">
            <div className="space-y-1">
              <p className="app-auth-kicker">Login</p>
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                Sign in
              </h2>
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

              {schoolsError ? (
                <FeedbackNotice variant="error">
                  {schoolsError}
                </FeedbackNotice>
              ) : null}

              {submitError ? (
                <FeedbackNotice variant="error">
                  {submitError}
                </FeedbackNotice>
              ) : null}

              <div className="app-field-group">
                <label className="app-field-label" htmlFor="schoolKey">
                  School
                </label>
                <SearchableCommandSelect
                  value={schoolKey}
                  options={schoolOptions}
                  onValueChange={handleSchoolChange}
                  placeholder={schoolsLoading ? "Loading schools..." : schools.length > 0 ? "Search and select your school" : "No schools available"}
                  searchPlaceholder="Search schools..."
                  emptyText="No schools found."
                  disabled={schoolsLoading || schools.length === 0}
                />
                {selectedSchool ? (
                  <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Signing in to{" "}
                    <span className="font-semibold text-foreground">
                      {selectedSchool.displayName}
                    </span>
                    .
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Choose the school first so student roll-number sign in uses
                    the right records.
                  </p>
                )}
              </div>

              <div className="app-field-group">
                <label className="app-field-label" htmlFor="identifier">
                  Username
                </label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder={
                    isStudentStyleIdentifier
                      ? "Roll number"
                      : "Email or roll number"
                  }
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setSubmitError("");
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="username"
                  className="h-11"
                  autoFocus={Boolean(selectedSchool) || schools.length === 1}
                  required
                />
                <p className="text-xs text-muted-foreground">{identifierHint}</p>
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
                    onChange={(e) => {
                      setPassword(e.target.value);
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
                {showStudentPasswordShortcut ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(trimmedIdentifier);
                      setSubmitError("");
                    }}
                    className="w-fit text-xs font-medium text-foreground underline-offset-4 transition hover:underline"
                  >
                    Use the roll number as the password
                  </button>
                ) : null}
                {passwordHint ? (
                  <p className="text-xs text-muted-foreground">{passwordHint}</p>
                ) : null}
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
              Need administrator access?{" "}
              <Link
                href="/auth/company-signin"
                className="font-semibold text-foreground underline-offset-4 hover:underline"
              >
                Use administrator sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
