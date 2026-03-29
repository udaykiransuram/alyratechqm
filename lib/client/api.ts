import {
  getSchoolKeyFromCookie,
  withSchool,
  withSchoolHeaders,
} from '@/lib/client/school';
import { performNextAuthSignOut } from '@/lib/client/next-auth-client';

export type ApiPayload<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  rawText: string;
};

export type FetchApiOptions = RequestInit & {
  schoolKey?: string | null;
  includeSchoolQuery?: boolean;
  clientCacheTtlMs?: number;
  preferClientCache?: boolean;
};

export type FetchApiJsonOptions = FetchApiOptions & {
  fallbackMessage?: string;
};

type ApiErrorData = {
  code?: string;
  retryable?: boolean;
  httpStatus?: number;
  message?: string;
  [key: string]: unknown;
};

export class ApiRequestError extends Error {
  code: string | null;
  retryable: boolean;
  httpStatus: number;
  payload: unknown;

  constructor(params: {
    message: string;
    code?: string | null;
    retryable?: boolean;
    httpStatus?: number;
    payload?: unknown;
    cause?: unknown;
  }) {
    super(String(params.message || 'Request failed.'));
    this.name = 'ApiRequestError';
    this.code = params.code ? String(params.code) : null;
    this.retryable = Boolean(params.retryable);
    this.httpStatus = Number.isFinite(params.httpStatus)
      ? Number(params.httpStatus)
      : 0;
    this.payload = params.payload;
    if (typeof params.cause !== 'undefined') {
      (this as Error & { cause?: unknown }).cause = params.cause;
    }
  }
}

type ClientApiCacheEntry = {
  payload: ApiPayload<any>;
  expiresAt: number;
};

const clientApiCache = new Map<string, ClientApiCacheEntry>();
const clientApiInflight = new Map<string, Promise<ApiPayload<any>>>();
const DEFAULT_CLIENT_API_CACHE_TTL_MS = 30_000;
const STUDENT_SESSION_EXPIRED_CODE = 'StudentSessionExpired';
const STUDENT_SESSION_EXPIRED_MESSAGE =
  'This student session is no longer active. Please sign in again.';

let studentSessionRedirectPromise: Promise<never> | null = null;

function stripTerminalPunctuation(message: string) {
  return String(message || '').trim().replace(/[.!?]+$/, '');
}

function ensureTerminalPunctuation(message: string) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return '';
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normalizeLeadingErrorPhrase(message: string) {
  const trimmed = String(message || '').trim();
  if (!trimmed) {
    return '';
  }

  const gerundReplacements: Array<[RegExp, string]> = [
    [/^error\s+creating\b/i, "We couldn't create"],
    [/^error\s+loading\b/i, "We couldn't load"],
    [/^error\s+saving\b/i, "We couldn't save"],
    [/^error\s+updating\b/i, "We couldn't update"],
    [/^error\s+deleting\b/i, "We couldn't delete"],
    [/^error\s+archiving\b/i, "We couldn't archive"],
    [/^error\s+uploading\b/i, "We couldn't upload"],
    [/^error\s+submitting\b/i, "We couldn't submit"],
    [/^error\s+starting\b/i, "We couldn't start"],
    [/^error\s+fetching\b/i, "We couldn't fetch"],
    [/^error\s+reading\b/i, "We couldn't read"],
    [/^error\s+generating\b/i, "We couldn't generate"],
    [/^error\s+processing\b/i, "We couldn't process"],
    [/^error\s+sending\b/i, "We couldn't send"],
  ];

  for (const [pattern, replacement] of gerundReplacements) {
    if (pattern.test(trimmed)) {
      return trimmed.replace(pattern, replacement);
    }
  }

  return trimmed
    .replace(/^failed to\s+/i, "We couldn't ")
    .replace(/^unable to\s+/i, "We couldn't ")
    .replace(/^error while\s+/i, "We couldn't ")
    .replace(/^an error occurred while\s+/i, "We couldn't ");
}

export function normalizeUserFacingErrorMessage(
  message: unknown,
  fallbackMessage = "We couldn't complete that request.",
) {
  const fallback =
    ensureTerminalPunctuation(String(fallbackMessage || '').trim()) ||
    "We couldn't complete that request.";
  const raw = typeof message === 'string' ? String(message || '').trim() : '';
  const candidate = raw || fallback;

  const normalized = normalizeLeadingErrorPhrase(candidate);
  if (!normalized) {
    return fallback;
  }

  const sentence = ensureTerminalPunctuation(normalized);
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        (error as { name?: string }).name === 'AbortError';
}

function isNavigatorOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function isLikelyTimeoutMessage(message: string) {
  return /timed out|timeout/i.test(message);
}

function isLikelyNetworkMessage(message: string) {
  return /failed to fetch|fetch failed|load failed|networkerror|network request failed|network error|failed to execute 'fetch'/i.test(
    message,
  );
}

function getClientRequestErrorCode(error: unknown) {
  const rawMessage = error instanceof Error ? String(error.message || '').trim() : '';
  if (isNavigatorOffline()) {
    return 'CLIENT_OFFLINE';
  }
  if (rawMessage && isLikelyTimeoutMessage(rawMessage)) {
    return 'CLIENT_TIMEOUT';
  }
  if (rawMessage && isLikelyNetworkMessage(rawMessage)) {
    return 'CLIENT_NETWORK_ERROR';
  }
  return 'CLIENT_REQUEST_FAILED';
}

export function getClientRequestErrorMessage(
  error: unknown,
  fallbackMessage = "We couldn't complete that request.",
) {
  const fallback = normalizeUserFacingErrorMessage(fallbackMessage);
  const fallbackLead = stripTerminalPunctuation(fallback);
  const rawMessage = error instanceof Error ? String(error.message || '').trim() : '';

  if (isNavigatorOffline()) {
    return normalizeUserFacingErrorMessage(
      `${fallbackLead}. You appear to be offline. Reconnect to the internet and try again.`,
      fallback,
    );
  }

  if (rawMessage && isLikelyTimeoutMessage(rawMessage)) {
    return normalizeUserFacingErrorMessage(
      `${fallbackLead}. The connection is too weak or the server took too long to respond. Please try again when your internet is stable.`,
      fallback,
    );
  }

  if (rawMessage && isLikelyNetworkMessage(rawMessage)) {
    return normalizeUserFacingErrorMessage(
      `${fallbackLead}. We could not reach the server. Check your internet connection and try again.`,
      fallback,
    );
  }

  return normalizeUserFacingErrorMessage(rawMessage || fallback, fallback);
}

function resolveRetryableByStatus(status: number) {
  return status >= 500 || status === 408 || status === 409 || status === 425 || status === 429;
}

function resolveRequestMethod(init?: RequestInit) {
  return String(init?.method || 'GET').trim().toUpperCase() || 'GET';
}

function isCacheableRequest(method: string, ttlMs?: number) {
  return typeof window !== 'undefined' && ttlMs !== undefined && ttlMs > 0 && (method === 'GET' || method === 'HEAD');
}

function isSuccessfulApiPayload(payload: ApiPayload<any>) {
  return (
    payload.ok &&
    !(
      payload.data &&
      typeof payload.data === 'object' &&
      'success' in payload.data &&
      !(payload.data as any).success
    )
  );
}

function buildClientApiRequestUrl(
  url: string,
  includeSchoolQuery: boolean,
  resolvedSchoolKey: string,
) {
  return includeSchoolQuery && resolvedSchoolKey ? withSchool(url, resolvedSchoolKey) : url;
}

function buildClientApiCacheKey(
  url: string,
  includeSchoolQuery: boolean,
  resolvedSchoolKey: string,
  method: string,
) {
  return `${method}::${buildClientApiRequestUrl(url, includeSchoolQuery, resolvedSchoolKey)}`;
}

function readFreshClientApiCacheEntry(cacheKey: string) {
  const entry = clientApiCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    clientApiCache.delete(cacheKey);
    return null;
  }

  return entry;
}

function writeClientApiCacheEntry(
  cacheKey: string,
  payload: ApiPayload<any>,
  ttlMs: number,
) {
  clientApiCache.set(cacheKey, {
    payload,
    expiresAt: Date.now() + ttlMs,
  });
}

export function resolveClientSchoolKey(schoolKey?: string | null) {
  return String(schoolKey ?? getSchoolKeyFromCookie() ?? '').trim();
}

export function requireClientSchoolKey(
  schoolKey?: string | null,
  fallbackMessage = 'Please select a school in the navbar first.',
) {
  const resolved = resolveClientSchoolKey(schoolKey);
  if (!resolved) {
    throw new Error(fallbackMessage);
  }
  return resolved;
}

export async function readApiPayload<T = any>(
  response: Response,
): Promise<ApiPayload<T>> {
  const rawText = await response.text();
  let data: T | null = null;

  if (rawText) {
    try {
      data = JSON.parse(rawText) as T;
    } catch {
      data = null;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    rawText,
  };
}

export function getApiErrorMessage(
  payload: Pick<ApiPayload<any>, 'ok' | 'status' | 'data' | 'rawText'>,
  fallback: string,
) {
  const fallbackMessage = normalizeUserFacingErrorMessage(fallback);
  const fallbackLead = stripTerminalPunctuation(fallbackMessage);
  const apiMessage =
    payload.data && typeof (payload.data as any)?.message === 'string'
      ? String((payload.data as any).message).trim()
      : '';

  if (apiMessage) {
    return normalizeUserFacingErrorMessage(apiMessage, fallbackMessage);
  }

  const trimmed = String(payload.rawText || '').trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return normalizeUserFacingErrorMessage(
      `${fallbackLead}. The server returned an HTML error page instead of JSON.`,
      fallbackMessage,
    );
  }

  if (!payload.ok) {
    return normalizeUserFacingErrorMessage(
      `${fallbackLead}. (HTTP ${payload.status})`,
      fallbackMessage,
    );
  }

  return fallbackMessage;
}

function getApiMessage(payload: Pick<ApiPayload<any>, 'data'>) {
  return payload.data && typeof (payload.data as any)?.message === 'string'
    ? String((payload.data as any).message).trim()
    : '';
}

function getApiCode(payload: Pick<ApiPayload<any>, 'data'>) {
  return payload.data && typeof (payload.data as any)?.code === 'string'
    ? String((payload.data as any).code).trim()
    : '';
}

function getApiRetryable(payload: Pick<ApiPayload<any>, 'status' | 'data'>) {
  if (
    payload.data &&
    typeof payload.data === 'object' &&
    'retryable' in payload.data &&
    typeof (payload.data as ApiErrorData).retryable === 'boolean'
  ) {
    return Boolean((payload.data as ApiErrorData).retryable);
  }

  return resolveRetryableByStatus(Number(payload.status || 0));
}

function getApiHttpStatus(payload: Pick<ApiPayload<any>, 'status' | 'data'>) {
  if (
    payload.data &&
    typeof payload.data === 'object' &&
    'httpStatus' in payload.data &&
    Number.isFinite(Number((payload.data as ApiErrorData).httpStatus))
  ) {
    return Number((payload.data as ApiErrorData).httpStatus);
  }

  return Number(payload.status || 0);
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

export function getApiRequestErrorCode(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.code;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return String((error as { code: string }).code);
  }

  return null;
}

export function isRetryableApiError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.retryable;
  }
  return false;
}

export function getApiRequestErrorPayload<T = unknown>(
  error: unknown,
): T | null {
  if (error instanceof ApiRequestError) {
    return (error.payload as T) ?? null;
  }
  return null;
}

function isExpiredStudentSessionPayload(
  payload: Pick<ApiPayload<any>, 'status' | 'data'>,
) {
  if (payload.status !== 401) {
    return false;
  }

  const code = getApiCode(payload);
  if (code === STUDENT_SESSION_EXPIRED_CODE) {
    return true;
  }

  return getApiMessage(payload) === STUDENT_SESSION_EXPIRED_MESSAGE;
}

async function redirectToExpiredStudentSessionSignIn(): Promise<never> {
  if (typeof window === 'undefined') {
    throw new Error(STUDENT_SESSION_EXPIRED_MESSAGE);
  }

  if (!studentSessionRedirectPromise) {
    studentSessionRedirectPromise = (async () => {
      const signInUrl = new URL('/auth/signin', window.location.origin);
      signInUrl.searchParams.set('error', STUDENT_SESSION_EXPIRED_CODE);
      signInUrl.searchParams.set('signedOut', '1');
      signInUrl.searchParams.set('callbackUrl', window.location.href);

      try {
        await performNextAuthSignOut({
          callbackUrl: signInUrl.toString(),
        });
      } catch {}

      window.location.assign(signInUrl.toString());

      return await new Promise<never>(() => {});
    })();
  }

  return studentSessionRedirectPromise;
}


export function buildPartialLoadMessage(
  labels: string[],
  continuation = 'You can continue with available data and refresh to retry.',
): string | null {
  const cleanedLabels = labels
    .map((label) => String(label || '').trim())
    .filter(Boolean);

  if (cleanedLabels.length === 0) {
    return null;
  }

  if (cleanedLabels.length === 1) {
    return `${cleanedLabels[0]} could not be loaded. ${continuation}`;
  }

  const head = cleanedLabels.slice(0, -1).join(', ');
  const tail = cleanedLabels[cleanedLabels.length - 1];
  return `${head} and ${tail} could not be loaded. ${continuation}`;
}

export async function fetchApiPayload<T = any>(
  url: string,
  options: FetchApiOptions = {},
): Promise<ApiPayload<T>> {
  const {
    schoolKey,
    includeSchoolQuery = true,
    clientCacheTtlMs = 0,
    preferClientCache = false,
    headers,
    ...init
  } = options;

  const method = resolveRequestMethod(init);
  const resolvedSchoolKey = resolveClientSchoolKey(schoolKey);
  const nextUrl = buildClientApiRequestUrl(url, includeSchoolQuery, resolvedSchoolKey);
  const cacheKey = isCacheableRequest(method, clientCacheTtlMs)
    ? buildClientApiCacheKey(url, includeSchoolQuery, resolvedSchoolKey, method)
    : null;

  if (cacheKey && preferClientCache) {
    const cachedEntry = readFreshClientApiCacheEntry(cacheKey);
    if (cachedEntry) {
      return cachedEntry.payload as ApiPayload<T>;
    }
  }

  if (cacheKey) {
    const inflightRequest = clientApiInflight.get(cacheKey);
    if (inflightRequest) {
      return inflightRequest as Promise<ApiPayload<T>>;
    }
  }

  const requestPromise = (async () => {
    const response = await fetch(
      nextUrl,
      withSchoolHeaders({ ...init, headers }, resolvedSchoolKey),
    );
    const payload = await readApiPayload<T>(response);

    if (cacheKey && isSuccessfulApiPayload(payload)) {
      writeClientApiCacheEntry(cacheKey, payload, clientCacheTtlMs);
    }

    return payload;
  })();

  if (cacheKey) {
    clientApiInflight.set(cacheKey, requestPromise as Promise<ApiPayload<any>>);
  }

  try {
    return await requestPromise;
  } finally {
    if (cacheKey) {
      clientApiInflight.delete(cacheKey);
    }
  }
}

export async function fetchApiJson<T = any>(
  url: string,
  options: FetchApiJsonOptions = {},
): Promise<T> {
  const {
    fallbackMessage = "We couldn't complete that request.",
    ...rest
  } = options;
  let payload: ApiPayload<T>;

  try {
    payload = await fetchApiPayload<T>(url, rest);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw new ApiRequestError({
      message: getClientRequestErrorMessage(error, fallbackMessage),
      code: getClientRequestErrorCode(error),
      retryable: true,
      httpStatus: 0,
      cause: error,
    });
  }

  if (
    !payload.ok ||
    (payload.data &&
      typeof payload.data === 'object' &&
      'success' in payload.data &&
      !(payload.data as any).success)
  ) {
    if (isExpiredStudentSessionPayload(payload)) {
      return await redirectToExpiredStudentSessionSignIn();
    }

    throw new ApiRequestError({
      message: getApiErrorMessage(payload, fallbackMessage),
      code: getApiCode(payload) || null,
      retryable: getApiRetryable(payload),
      httpStatus: getApiHttpStatus(payload),
      payload: payload.data,
    });
  }

  return payload.data as T;
}

export function peekCachedApiJson<T = any>(
  url: string,
  options: FetchApiOptions = {},
): T | null {
  const {
    schoolKey,
    includeSchoolQuery = true,
    clientCacheTtlMs = DEFAULT_CLIENT_API_CACHE_TTL_MS,
    ...init
  } = options;

  const method = resolveRequestMethod(init);
  if (!isCacheableRequest(method, clientCacheTtlMs)) {
    return null;
  }

  const resolvedSchoolKey = resolveClientSchoolKey(schoolKey);
  const cacheKey = buildClientApiCacheKey(url, includeSchoolQuery, resolvedSchoolKey, method);
  const cachedEntry = readFreshClientApiCacheEntry(cacheKey);

  if (!cachedEntry || !isSuccessfulApiPayload(cachedEntry.payload)) {
    return null;
  }

  return cachedEntry.payload.data as T;
}

export async function prefetchApiJson<T = any>(
  url: string,
  options: FetchApiJsonOptions = {},
): Promise<T | null> {
  try {
    return await fetchApiJson<T>(url, {
      ...options,
      clientCacheTtlMs: options.clientCacheTtlMs ?? DEFAULT_CLIENT_API_CACHE_TTL_MS,
      preferClientCache: true,
    });
  } catch {
    return null;
  }
}
