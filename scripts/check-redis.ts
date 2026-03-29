type RedisCommandValue = string | number | boolean;

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

type CheckStep<T = unknown> = {
  ok: boolean;
  status: number | null;
  durationMs: number;
  result?: T | null;
  error?: string;
};

type ArgOptions = {
  json: boolean;
};

function parseArgs(argv: string[]): ArgOptions {
  return {
    json: argv.some((arg) => String(arg || "").trim() === "--json"),
  };
}

function getRedisUrl() {
  return String(process.env.UPSTASH_REDIS_REST_URL || "").trim();
}

function getRedisToken() {
  return String(process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
}

async function runRedisCommand<T = unknown>(
  command: RedisCommandValue[],
): Promise<CheckStep<T>> {
  const url = getRedisUrl();
  const token = getRedisToken();
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(command),
    });

    const payload = (await response
      .json()
      .catch(() => ({}))) as UpstashResponse<T>;

    if (!response.ok || payload.error) {
      return {
        ok: false,
        status: response.status,
        durationMs: Date.now() - startedAt,
        result:
          typeof payload.result === "undefined" ? null : (payload.result as T),
        error: payload.error || `HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      status: response.status,
      durationMs: Date.now() - startedAt,
      result:
        typeof payload.result === "undefined" ? null : (payload.result as T),
    };
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    const cause =
      normalizedError.cause instanceof Error
        ? normalizedError.cause.message
        : normalizedError.cause
          ? String(normalizedError.cause)
          : "";

    return {
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      error: cause ? `${normalizedError.message} (${cause})` : normalizedError.message,
    };
  }
}

function sanitizeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function printHumanReport(params: {
  configured: boolean;
  host: string;
  ping?: CheckStep<string>;
  set?: CheckStep<string>;
  get?: CheckStep<string>;
  del?: CheckStep<number>;
  getValueMatches?: boolean;
}) {
  console.log(`[redis-check] configured=${params.configured} host=${params.host}`);

  if (!params.configured) {
    console.log("[redis-check] missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
    return;
  }

  const rows = [
    ["PING", params.ping],
    ["SET", params.set],
    ["GET", params.get],
    ["DEL", params.del],
  ] as const;

  for (const [label, step] of rows) {
    if (!step) continue;
    const statusPart = step.status === null ? "no-http-status" : `http=${step.status}`;
    const resultPart =
      typeof step.result === "undefined"
        ? ""
        : ` result=${JSON.stringify(step.result)}`;
    const errorPart = step.error ? ` error=${step.error}` : "";
    console.log(
      `[redis-check] ${label} ok=${step.ok} ${statusPart} durationMs=${step.durationMs}${resultPart}${errorPart}`,
    );
  }

  if (typeof params.getValueMatches === "boolean") {
    console.log(`[redis-check] GET value matches expected=${params.getValueMatches}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const url = getRedisUrl();
  const token = getRedisToken();
  const configured = Boolean(url && token);
  const host = sanitizeHost(url);

  if (!configured) {
    const payload = {
      ok: false,
      configured,
      host,
      message: "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN.",
    };
    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      printHumanReport({ configured, host });
    }
    process.exitCode = 1;
    return;
  }

  const key = `codex:redis-health:${Date.now()}`;
  const ping = await runRedisCommand<string>(["PING"]);
  const set = await runRedisCommand<string>(["SET", key, "ok", "EX", 30]);
  const get = await runRedisCommand<string>(["GET", key]);
  const del = await runRedisCommand<number>(["DEL", key]);
  const getValueMatches = get.result === "ok";
  const ok =
    ping.ok &&
    ping.result === "PONG" &&
    set.ok &&
    set.result === "OK" &&
    get.ok &&
    getValueMatches &&
    del.ok &&
    Number(del.result || 0) >= 1;

  const payload = {
    ok,
    configured,
    host,
    checks: {
      ping,
      set,
      get,
      del,
      getValueMatches,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHumanReport({
      configured,
      host,
      ping,
      set,
      get,
      del,
      getValueMatches,
    });
  }

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const normalizedError =
    error instanceof Error ? error : new Error(String(error));
  console.error(`[redis-check] fatal error: ${normalizedError.message}`);
  process.exitCode = 1;
});
