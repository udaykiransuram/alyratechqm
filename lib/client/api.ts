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
};

export type FetchApiJsonOptions = FetchApiOptions & {
  fallbackMessage?: string;
};

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
    headers,
    ...init
  } = options;

  const resolvedSchoolKey = resolveClientSchoolKey(schoolKey);
  const nextUrl =
    includeSchoolQuery && resolvedSchoolKey ? withSchool(url, resolvedSchoolKey) : url;
  const response = await fetch(
    nextUrl,
    withSchoolHeaders({ ...init, headers }, resolvedSchoolKey),
  );

  return readApiPayload<T>(response);
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
