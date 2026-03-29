import { once } from "node:events";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

export type OnlineTestServerMode = "external" | "dev" | "prod";

type StartOnlineTestServerOptions = {
  baseUrl: string;
  mode: OnlineTestServerMode;
  readinessPath?: string;
  startupTimeoutMs?: number;
};

type StartedOnlineTestServer = {
  baseUrl: string;
  mode: OnlineTestServerMode;
  managed: boolean;
  stop: () => Promise<void>;
};

const DEFAULT_READINESS_PATH = "/auth/company-signin";
const DEFAULT_STARTUP_TIMEOUT_MS = 240_000;
const STOP_TIMEOUT_MS = 15_000;
const DEFAULT_MANAGED_PORT_SEARCH_SPAN = 20;

function resolveCommand(name: string) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function isLoopbackHost(hostname: string) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "0.0.0.0"
  );
}

function getBaseUrlPort(url: URL) {
  if (url.port) {
    return Number(url.port);
  }

  return url.protocol === "https:" ? 443 : 80;
}

async function canBindPort(hostname: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    server.once("error", () => {
      finish(false);
    });

    server.listen({ host: hostname, port, exclusive: true }, () => {
      server.close(() => finish(true));
    });
  });
}

export function resolveOnlineTestServerMode(
  baseUrl: string,
  rawMode?: string,
): OnlineTestServerMode {
  const normalizedMode = String(rawMode || "").trim().toLowerCase();
  if (normalizedMode) {
    if (
      normalizedMode !== "external" &&
      normalizedMode !== "dev" &&
      normalizedMode !== "prod"
    ) {
      throw new Error(
        `Invalid --server-mode value: ${rawMode}. Expected external, dev, or prod.`,
      );
    }
    return normalizedMode as OnlineTestServerMode;
  }

  const hostname = new URL(baseUrl).hostname;
  return isLoopbackHost(hostname) ? "prod" : "external";
}

export async function resolveManagedOnlineTestBaseUrl(
  baseUrl: string,
  mode: OnlineTestServerMode,
) {
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!normalizedBaseUrl || mode === "external") {
    return normalizedBaseUrl;
  }

  const parsedUrl = new URL(normalizedBaseUrl);
  if (!isLoopbackHost(parsedUrl.hostname)) {
    return normalizedBaseUrl;
  }

  const initialPort = getBaseUrlPort(parsedUrl);
  const finalPort = Math.min(
    65_535,
    initialPort + DEFAULT_MANAGED_PORT_SEARCH_SPAN,
  );

  for (let candidatePort = initialPort; candidatePort <= finalPort; candidatePort += 1) {
    const available = await canBindPort(parsedUrl.hostname, candidatePort);
    if (!available) {
      continue;
    }

    if (candidatePort !== initialPort) {
      const resolvedUrl = new URL(normalizedBaseUrl);
      resolvedUrl.port = String(candidatePort);
      console.log(
        `Managed server port ${initialPort} is busy; using ${resolvedUrl.toString()} instead.`,
      );
      return resolvedUrl.toString().replace(/\/$/, "");
    }

    return normalizedBaseUrl;
  }

  throw new Error(
    `Could not find an available managed loopback port between ${initialPort} and ${finalPort}.`,
  );
}

function buildServerEnv(baseUrl: string, mode: OnlineTestServerMode) {
  return {
    ...process.env,
    BROWSERSLIST_IGNORE_OLD_DATA:
      process.env.BROWSERSLIST_IGNORE_OLD_DATA || "1",
    // Managed local runs must use the exact resolved loopback origin so auth
    // redirects and cookies stay on the same host/port as the browser harness.
    NEXTAUTH_URL: baseUrl,
    NEXT_PUBLIC_SITE_URL: baseUrl,
    NODE_ENV:
      process.env.NODE_ENV || (mode === "prod" ? "production" : "development"),
  };
}

function runBuildIfNeeded(baseUrl: string) {
  const env = buildServerEnv(baseUrl, "prod");
  const buildResult = spawnSync(resolveCommand("npm"), ["run", "build"], {
    stdio: "inherit",
    env,
  });
  const exitCode = buildResult.status === null ? 1 : buildResult.status;
  if (exitCode !== 0) {
    throw new Error(`Managed production build failed with exit code ${exitCode}.`);
  }
}

async function waitForServerReady(
  readyUrl: string,
  child: ChildProcess,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  let nextProgressLogAt = Date.now();

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Managed Next server exited before becoming ready.${lastError ? ` Last error: ${lastError}` : ""}`,
      );
    }

    try {
      const response = await fetch(readyUrl, {
        redirect: "manual",
        cache: "no-store",
      });
      if (response.status < 500) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (Date.now() >= nextProgressLogAt) {
      console.log(
        `Waiting for managed server readiness at ${readyUrl}${lastError ? ` (${lastError})` : ""}`,
      );
      nextProgressLogAt = Date.now() + 10_000;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }

  throw new Error(
    `Managed Next server did not become ready at ${readyUrl} within ${timeoutMs}ms.${lastError ? ` Last error: ${lastError}` : ""}`,
  );
}

async function stopManagedServer(child: ChildProcess) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");

  const exited = once(child, "exit").then(() => undefined);
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), STOP_TIMEOUT_MS);
  });

  const result = await Promise.race([exited, timeout]);
  if (result === "timeout" && child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "exit").catch(() => undefined);
  }
}

export async function startOnlineTestServer(
  options: StartOnlineTestServerOptions,
): Promise<StartedOnlineTestServer> {
  const baseUrl = String(options.baseUrl || "").trim().replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("A baseUrl is required to start the online test server.");
  }

  if (options.mode === "external") {
    return {
      baseUrl,
      mode: options.mode,
      managed: false,
      stop: async () => {},
    };
  }

  if (options.mode === "prod") {
    console.log("\n== Build managed production server ==");
    runBuildIfNeeded(baseUrl);
  }

  const parsedBaseUrl = new URL(baseUrl);
  const hostname = parsedBaseUrl.hostname || "127.0.0.1";
  const port = parsedBaseUrl.port || "3000";
  const env = buildServerEnv(baseUrl, options.mode);
  const command = resolveCommand("npx");
  const commandArgs =
    options.mode === "prod"
      ? ["next", "start", "--hostname", hostname, "--port", port]
      : ["next", "dev", "--hostname", hostname, "--port", port];

  console.log(
    `\n== Start managed Next ${options.mode === "prod" ? "production" : "dev"} server ==`,
  );
  console.log(`Base URL: ${baseUrl}`);

  const child = spawn(command, commandArgs, {
    stdio: "inherit",
    env,
  });

  try {
    await waitForServerReady(
      new URL(
        options.readinessPath || DEFAULT_READINESS_PATH,
        baseUrl,
      ).toString(),
      child,
      options.startupTimeoutMs || DEFAULT_STARTUP_TIMEOUT_MS,
    );
    console.log("Managed server is ready.");
  } catch (error) {
    await stopManagedServer(child).catch(() => undefined);
    throw error;
  }

  return {
    baseUrl,
    mode: options.mode,
    managed: true,
    stop: async () => {
      await stopManagedServer(child);
    },
  };
}

export async function withOnlineTestServer<T>(
  options: StartOnlineTestServerOptions,
  work: () => Promise<T>,
) {
  const server = await startOnlineTestServer(options);
  try {
    return await work();
  } finally {
    await server.stop().catch(() => undefined);
  }
}
