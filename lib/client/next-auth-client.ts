"use client";

import { NEXT_AUTH_CSRF_GLOBAL } from "@/lib/auth-school-signin-bootstrap";

type NextAuthResult = {
  ok: boolean;
  status: number;
  url: string | null;
  error: string | null;
};

type CredentialSignInOptions = {
  provider: string;
  callbackUrl: string;
  credentials: Record<string, string>;
};

type SignOutOptions = {
  callbackUrl?: string;
};

type CsrfResponse = {
  csrfToken?: string;
  url?: string;
};

let csrfTokenCache: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

type NextAuthClientWindow = Window &
  typeof globalThis & {
    [NEXT_AUTH_CSRF_GLOBAL]?: string;
  };

function parseMaybeJson(text: string) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveAbsoluteUrl(rawUrl: string | null | undefined, fallbackUrl: string) {
  const candidate = String(rawUrl || "").trim() || String(fallbackUrl || "").trim();
  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, window.location.origin).toString();
  } catch {
    return null;
  }
}

function getErrorFromAuthUrl(rawUrl: string | null | undefined) {
  const resolvedUrl = resolveAbsoluteUrl(rawUrl, "");
  if (!resolvedUrl) {
    return null;
  }

  try {
    return new URL(resolvedUrl).searchParams.get("error");
  } catch {
    return null;
  }
}

async function readNextAuthJsonResponse<T extends Record<string, unknown>>(
  response: Response,
) {
  const rawText = await response.text();
  const data = parseMaybeJson(rawText) as T | null;

  if (data) {
    return data;
  }

  throw new Error(
    rawText.trim() || `Authentication request failed (HTTP ${response.status}).`,
  );
}

function readBootstrappedCsrfToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const authWindow = window as NextAuthClientWindow;
  const csrfToken = String(authWindow[NEXT_AUTH_CSRF_GLOBAL] || "").trim();

  return csrfToken || null;
}

export async function fetchNextAuthCsrfToken() {
  const bootstrappedToken = readBootstrappedCsrfToken();
  if (bootstrappedToken) {
    csrfTokenCache = bootstrappedToken;
    return bootstrappedToken;
  }

  if (csrfTokenCache) {
    return csrfTokenCache;
  }

  if (!csrfTokenPromise) {
    csrfTokenPromise = (async () => {
      const response = await fetch("/api/auth/csrf", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await readNextAuthJsonResponse<CsrfResponse>(response);
      const csrfToken = String(data.csrfToken || "").trim();

      if (!response.ok || !csrfToken) {
        throw new Error("We couldn't prepare the secure sign-in request.");
      }

      csrfTokenCache = csrfToken;
      if (typeof window !== "undefined") {
        const authWindow = window as NextAuthClientWindow;
        authWindow[NEXT_AUTH_CSRF_GLOBAL] = csrfToken;
      }
      return csrfToken;
    })().finally(() => {
      csrfTokenPromise = null;
    });
  }

  return csrfTokenPromise;
}

export async function performCredentialSignIn({
  provider,
  callbackUrl,
  credentials,
}: CredentialSignInOptions): Promise<NextAuthResult> {
  const csrfToken = await fetchNextAuthCsrfToken();
  const response = await fetch(`/api/auth/callback/${encodeURIComponent(provider)}?json=true`, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      ...credentials,
      csrfToken,
      callbackUrl,
      json: "true",
    }),
  });

  const data = await readNextAuthJsonResponse<CsrfResponse>(response);
  const url = resolveAbsoluteUrl(
    typeof data.url === "string" ? data.url : null,
    callbackUrl,
  );
  const error = getErrorFromAuthUrl(url);

  return {
    ok: response.ok && !error,
    status: response.status,
    url: error ? null : url,
    error,
  };
}

export async function performNextAuthSignOut(
  options: SignOutOptions = {},
): Promise<NextAuthResult> {
  const callbackUrl = resolveAbsoluteUrl(
    options.callbackUrl,
    typeof window === "undefined" ? "/" : window.location.href,
  );
  const csrfToken = await fetchNextAuthCsrfToken();

  const response = await fetch("/api/auth/signout?json=true", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      csrfToken,
      callbackUrl: callbackUrl || "/",
      json: "true",
    }),
  });

  const data = await readNextAuthJsonResponse<CsrfResponse>(response);
  const url = resolveAbsoluteUrl(
    typeof data.url === "string" ? data.url : null,
    callbackUrl || "/",
  );

  return {
    ok: response.ok,
    status: response.status,
    url,
    error: getErrorFromAuthUrl(url),
  };
}
