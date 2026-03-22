export const APP_API_TIMING_EVENT = "app:api-timing";

const MAX_API_TIMING_SAMPLES = 200;
const SLOW_API_THRESHOLD_MS = 450;

export type ClientApiTimingEntry = {
  key: string;
  method: string;
  pathname: string;
  url: string;
  status: number | null;
  ok: boolean;
  durationMs: number;
  startedAt: string;
  errorMessage?: string | null;
};

export type ClientApiTimingSummary = {
  key: string;
  method: string;
  pathname: string;
  count: number;
  failures: number;
  lastMs: number;
  maxMs: number;
  avgMs: number;
  lastStatus: number | null;
  lastStartedAt: string;
};

declare global {
  interface Window {
    __APP_API_TIMINGS__?: ClientApiTimingEntry[];
    __APP_API_TIMINGS_SUMMARY__?: ClientApiTimingSummary[];
    __APP_API_TIMINGS_PRINT__?: (limit?: number) => void;
  }
}

function shouldLogTiming(entry: ClientApiTimingEntry) {
  if (!entry.ok) {
    return true;
  }

  if (entry.durationMs >= SLOW_API_THRESHOLD_MS) {
    return true;
  }

  try {
    return window.localStorage.getItem("app:log-api-timings") === "1";
  } catch {
    return false;
  }
}

function buildTimingSummary(entries: ClientApiTimingEntry[]) {
  const summaryByKey = new Map<string, ClientApiTimingSummary>();

  entries.forEach((entry) => {
    const existing = summaryByKey.get(entry.key);

    if (!existing) {
      summaryByKey.set(entry.key, {
        key: entry.key,
        method: entry.method,
        pathname: entry.pathname,
        count: 1,
        failures: entry.ok ? 0 : 1,
        lastMs: entry.durationMs,
        maxMs: entry.durationMs,
        avgMs: entry.durationMs,
        lastStatus: entry.status,
        lastStartedAt: entry.startedAt,
      });
      return;
    }

    const nextCount = existing.count + 1;
    existing.count = nextCount;
    existing.failures += entry.ok ? 0 : 1;
    existing.lastMs = entry.durationMs;
    existing.maxMs = Math.max(existing.maxMs, entry.durationMs);
    existing.avgMs = Number(
      ((existing.avgMs * (nextCount - 1) + entry.durationMs) / nextCount).toFixed(1),
    );
    existing.lastStatus = entry.status;
    existing.lastStartedAt = entry.startedAt;
  });

  return Array.from(summaryByKey.values()).sort((left, right) => {
    if (right.maxMs !== left.maxMs) {
      return right.maxMs - left.maxMs;
    }
    if (right.avgMs !== left.avgMs) {
      return right.avgMs - left.avgMs;
    }
    return right.count - left.count;
  });
}

export function recordClientApiTiming(entry: ClientApiTimingEntry) {
  if (typeof window === "undefined") {
    return;
  }

  const nextEntries = [entry, ...(window.__APP_API_TIMINGS__ ?? [])].slice(
    0,
    MAX_API_TIMING_SAMPLES,
  );
  const summary = buildTimingSummary(nextEntries);

  window.__APP_API_TIMINGS__ = nextEntries;
  window.__APP_API_TIMINGS_SUMMARY__ = summary;
  window.__APP_API_TIMINGS_PRINT__ = (limit = 10) => {
    console.table(
      summary.slice(0, limit).map((item) => ({
        route: `${item.method} ${item.pathname}`,
        requests: item.count,
        failures: item.failures,
        avgMs: item.avgMs,
        maxMs: Math.round(item.maxMs),
        lastMs: Math.round(item.lastMs),
        status: item.lastStatus ?? "-",
        lastStartedAt: item.lastStartedAt,
      })),
    );
  };

  window.dispatchEvent(
    new CustomEvent<ClientApiTimingEntry>(APP_API_TIMING_EVENT, {
      detail: entry,
    }),
  );

  if (!shouldLogTiming(entry)) {
    return;
  }

  const durationLabel = `${Math.round(entry.durationMs)}ms`;
  const statusLabel = entry.status === null ? "network-error" : String(entry.status);
  const message = `[api-perf] ${entry.method} ${entry.pathname} ${durationLabel} (${statusLabel})`;

  if (entry.ok) {
    console.info(message);
    return;
  }

  console.warn(entry.errorMessage ? `${message} ${entry.errorMessage}` : message);
}
