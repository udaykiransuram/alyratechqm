import {
  getSchoolKeyFromCookie,
  withSchool,
  withSchoolHeaders,
} from '@/lib/client/school';

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

type ClientApiCacheEntry = {
  payload: ApiPayload<any>;
  expiresAt: number;
};

const clientApiCache = new Map<string, ClientApiCacheEntry>();
const clientApiInflight = new Map<string, Promise<ApiPayload<any>>>();
const DEFAULT_CLIENT_API_CACHE_TTL_MS = 30_000;

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
  const apiMessage =
    payload.data && typeof (payload.data as any)?.message === 'string'
      ? String((payload.data as any).message).trim()
      : '';

  if (apiMessage) {
    return apiMessage;
  }

  const trimmed = String(payload.rawText || '').trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
    return `${fallback} The server returned an HTML error page instead of JSON.`;
  }

  if (!payload.ok) {
    return `${fallback} (HTTP ${payload.status})`;
  }

  return fallback;
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
  const { fallbackMessage = 'Request failed.', ...rest } = options;
  const payload = await fetchApiPayload<T>(url, rest);

  if (
    !payload.ok ||
    (payload.data &&
      typeof payload.data === 'object' &&
      'success' in payload.data &&
      !(payload.data as any).success)
  ) {
    throw new Error(getApiErrorMessage(payload, fallbackMessage));
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
