"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  School,
} from "lucide-react";

import {
  AuthFormHeader,
  AuthHeroPanel,
  AuthShell,
} from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";
import { getAuthErrorMessage } from "@/lib/auth-runtime";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import {
  fetchNextAuthCsrfToken,
  performCredentialSignIn,
} from "@/lib/client/next-auth-client";
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
  initialSchoolsPartial?: boolean;
  signedOut?: boolean;
};

const SearchableCommandSelect = dynamic(
  () =>
    import("@/components/ui/searchable-command-select").then(
      (mod) => mod.SearchableCommandSelect,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-12 w-full rounded-[1.15rem] border border-input bg-background" />
    ),
  },
);

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
  initialSchoolsPartial = false,
  signedOut = false,
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
  const [hasLoadedFullSchoolDirectory, setHasLoadedFullSchoolDirectory] =
    useState(
      normalizedInitialSchools.length > 0 && !initialSchoolsPartial,
    );
  const [shouldLoadAllSchools, setShouldLoadAllSchools] = useState(
    normalizedInitialSchools.length === 0,
  );
  const [schoolsError, setSchoolsError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [csrfToken, setCsrfToken] = useState("");
  const [readyStatus, setReadyStatus] = useState<"false" | "true" | "error">(
    "false",
  );
  const pageErrorMessage = getAuthErrorMessage(
    pageError,
    "school",
  );
  const trimmedIdentifier = identifier.trim();
  const isStudentStyleIdentifier =
    trimmedIdentifier.length > 0 && !trimmedIdentifier.includes("@");
  const selectedSchool = schools.find((school) => school.key === schoolKey);
  const identifierHint = !trimmedIdentifier
    ? "Students use roll number. Staff use email."
    : isStudentStyleIdentifier
      ? "Using roll number."
      : "Using email.";
  const passwordHint = isStudentStyleIdentifier
    ? "First student login uses the saved phone-number digits. If the password was changed and later forgotten, ask your school admin to reset it to those saved digits."
    : "";
  const showStaticSelectedSchool =
    initialSchoolsPartial &&
    Boolean(selectedSchool) &&
    !hasLoadedFullSchoolDirectory &&
    !shouldLoadAllSchools;
  const callbackUrl =
    requestedCallbackUrl ||
    (isStudentStyleIdentifier ? "/student/tests" : "/workspace");
  useEffect(() => {
    let cancelled = false;

    setReadyStatus("false");
    void fetchNextAuthCsrfToken()
      .then((nextCsrfToken) => {
        if (cancelled) {
          return;
        }

        setCsrfToken(nextCsrfToken);
        setReadyStatus("true");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setReadyStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const syncSelectedSchool = useCallback((nextSchools: SchoolOption[]) => {
    const rememberedSchoolKey = normalizeSchoolKey(getSchoolKeyFromCookie());
    const rememberedSchool = nextSchools.find(
      (school: SchoolOption) => school.key === rememberedSchoolKey,
    );
    const resolvedSchool =
      rememberedSchool ||
      nextSchools.find(
        (school: SchoolOption) => school.key === normalizedInitialSchoolKey,
      ) ||
      (nextSchools.length === 1
        ? nextSchools[0]
        : null);

    if (!resolvedSchool) {
      return;
    }

    setSchoolKey((currentSchoolKey) =>
      currentSchoolKey || resolvedSchool.key,
    );
    setSchoolSelectionCookies(
      resolvedSchool.key,
      resolvedSchool.displayName,
    );
  }, [normalizedInitialSchoolKey]);

  useEffect(() => {
    if (normalizedInitialSchools.length === 0) {
      return;
    }

    setSchools((currentSchools) =>
      currentSchools.length > normalizedInitialSchools.length
        ? currentSchools
        : normalizedInitialSchools,
    );
    setSchoolsError("");
    setSchoolsLoading(false);
    if (!initialSchoolsPartial) {
      setHasLoadedFullSchoolDirectory(true);
    }
    syncSelectedSchool(normalizedInitialSchools);
  }, [
    initialSchoolsPartial,
    normalizedInitialSchoolKey,
    normalizedInitialSchools,
    syncSelectedSchool,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!shouldLoadAllSchools || hasLoadedFullSchoolDirectory) {
      return () => {
        cancelled = true;
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

        if (cancelled) return;

        const nextSchools = Array.isArray(data.schools)
          ? normalizeSchoolOptions(
              data.schools.map((school) => ({
                key: String(school?.key || ""),
                displayName: String(school?.displayName || ""),
              })),
            )
          : [];

        setSchools(nextSchools);
        setHasLoadedFullSchoolDirectory(true);
        syncSelectedSchool(nextSchools);
      } catch (error: unknown) {
        if (cancelled) return;
        setSchoolsError(
          getClientRequestErrorMessage(
            error,
            "We couldn't load the school list.",
          ),
        );
      } finally {
        if (!cancelled) {
          setSchoolsLoading(false);
          setShouldLoadAllSchools(false);
        }
      }
    }

    void loadSchools();

    return () => {
      cancelled = true;
    };
  }, [
    hasLoadedFullSchoolDirectory,
    normalizedInitialSchoolKey,
    shouldLoadAllSchools,
    syncSelectedSchool,
  ]);

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

  const handleSchoolDirectoryOpenChange = (open: boolean) => {
    if (
      !open ||
      !initialSchoolsPartial ||
      hasLoadedFullSchoolDirectory ||
      shouldLoadAllSchools
    ) {
      return;
    }

    setShouldLoadAllSchools(true);
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
      const result = await performCredentialSignIn({
        provider: "school-user",
        callbackUrl,
        credentials: {
          identifier: submittedIdentifier,
          password,
          schoolKey: trimmedSchoolKey,
        },
      });

      if (!result || !result.ok) {
        const errorMessage =
          getAuthErrorMessage(result?.error, "school") ||
          (isStudentStyleIdentifier
            ? "We couldn't sign in with that roll number and password. If this is your first login, try using the saved phone-number digits exactly as stored (including country code digits, if saved). If the password was changed and forgotten, ask your school admin to reset it to those saved digits."
            : "We couldn't sign you in. Check your credentials and try again.");
        setSubmitError(errorMessage);
        return;
      }

      const selectedSchool = schools.find((school) => school.key === trimmedSchoolKey);
      setSchoolSelectionCookies(
        trimmedSchoolKey,
        selectedSchool?.displayName,
      );

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
    <AuthShell
      activeRoute="school"
      hero={
        <AuthHeroPanel
          icon={School}
          eyebrow="School sign in"
          title="Sign in to your school"
          copy=""
        />
      }
    >
      <AuthFormHeader
        eyebrow="Sign in"
        title="Sign in"
        copy=""
      />

      <form
        onSubmit={handleSubmit}
        className="app-auth-form"
        aria-busy={isLoading}
        action="/api/auth/callback/school-user"
        method="post"
        data-school-signin-form="school-user"
        data-school-signin-ready={readyStatus}
      >
        {signedOut && !pageErrorMessage ? (
          <FeedbackNotice variant="success">
            You have been signed out successfully. Sign back in whenever you
            are ready.
          </FeedbackNotice>
        ) : null}

        <input
          type="hidden"
          name="csrfToken"
          value={csrfToken}
          data-school-signin-csrf="true"
          readOnly
        />
        <input
          type="hidden"
          name="callbackUrl"
          value={callbackUrl}
          data-school-signin-callback="true"
          readOnly
        />
        <input type="hidden" name="schoolKey" value={schoolKey} />

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
          {showStaticSelectedSchool ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex min-h-12 flex-1 items-center rounded-[1.15rem] border border-border/72 bg-[hsl(var(--background)/0.92)] px-4 text-sm font-medium text-foreground shadow-[0_14px_24px_-24px_hsl(var(--app-shadow-deep)/0.1)]">
                {selectedSchool?.displayName}
              </div>
              <Button
                type="button"
                variant="outline"
                className="app-auth-secondary-button sm:w-auto sm:px-4"
                onClick={() => setShouldLoadAllSchools(true)}
              >
                Change school
              </Button>
            </div>
          ) : (
            <SearchableCommandSelect
              value={schoolKey}
              options={schoolOptions}
              onValueChange={handleSchoolChange}
              onOpenChange={handleSchoolDirectoryOpenChange}
              placeholder={
                schoolsLoading
                  ? "Loading schools..."
                  : schools.length > 0
                    ? "Search and select your school"
                    : "No schools available"
              }
              searchPlaceholder="Search schools..."
              emptyText="No schools found."
              disabled={schoolsLoading || schools.length === 0}
            />
          )}
          {selectedSchool ? (
            <p className="app-auth-field-note">
              Selected: {selectedSchool.displayName}
            </p>
          ) : (
            <p className="app-auth-field-note">
              Choose the school first so roll numbers and staff records resolve
              against the correct directory.
            </p>
          )}
        </div>

        <div className="app-field-group">
          <label className="app-field-label" htmlFor="identifier">
            Email / Roll No
          </label>
          <Input
            id="identifier"
            name="identifier"
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
            className="h-12"
            autoFocus={Boolean(selectedSchool) || schools.length === 1}
            required
          />
          <p className="app-auth-field-note">{identifierHint}</p>
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
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
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
          {passwordHint ? (
            <p className="app-auth-field-note">{passwordHint}</p>
          ) : null}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isLoading || schoolsLoading || schools.length === 0}
          className="app-auth-submit"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in
            </>
          ) : (
            "Continue securely"
          )}
        </Button>
      </form>

      <p className="app-auth-footer">
        Need administrator access?{" "}
        <Link
          href="/auth/company-signin"
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Use company sign in
        </Link>
      </p>
    </AuthShell>
  );
}
