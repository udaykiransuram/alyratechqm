import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";

const isWindows = process.platform === "win32";
const npxCommand = isWindows ? "npx.cmd" : "npx";
const host = String(process.env.PLAYWRIGHT_MANAGED_SERVER_HOST || "127.0.0.1").trim();
const port = String(process.env.PLAYWRIGHT_MANAGED_SERVER_PORT || "3001").trim();
const mode =
  String(process.env.PLAYWRIGHT_MANAGED_SERVER_MODE || "development").trim() ===
  "production"
    ? "production"
    : "development";
const logPath = path.resolve(
  process.env.PLAYWRIGHT_MANAGED_SERVER_LOG_PATH ||
    "test-results/playwright-web-server.log",
);

mkdirSync(path.dirname(logPath), { recursive: true });

const logStream = createWriteStream(logPath, { flags: "w" });
let activeChild = null;

function closeLogStream() {
  if (!logStream.closed) {
    logStream.end();
  }
}

function writeLogLine(message) {
  logStream.write(`${new Date().toISOString()} ${message}\n`);
}

function pipeChildOutput(child) {
  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      logStream.write(chunk);
      process.stdout.write(chunk);
    });
  }

  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      logStream.write(chunk);
      process.stderr.write(chunk);
    });
  }
}

function spawnLoggedProcess(args, label) {
  writeLogLine(`[playwright-web-server] ${label}: ${npxCommand} ${args.join(" ")}`);

  const child = spawn(npxCommand, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BROWSERSLIST_IGNORE_OLD_DATA:
        process.env.BROWSERSLIST_IGNORE_OLD_DATA || "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  activeChild = child;
  pipeChildOutput(child);
  return child;
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

async function runBuildIfNeeded() {
  if (mode !== "production") {
    return;
  }

  const buildChild = spawnLoggedProcess(["next", "build"], "building production bundle");
  const result = await waitForExit(buildChild);
  if (result.code !== 0) {
    closeLogStream();
    process.exit(result.code ?? 1);
  }
}

function forwardSignal(signal) {
  if (activeChild && activeChild.exitCode === null && !activeChild.killed) {
    activeChild.kill(signal);
  } else {
    closeLogStream();
    process.exit(0);
  }
}

process.once("SIGINT", () => forwardSignal("SIGINT"));
process.once("SIGTERM", () => forwardSignal("SIGTERM"));
process.once("exit", closeLogStream);

async function main() {
  try {
    await runBuildIfNeeded();

    const serverArgs = [
      "next",
      mode === "production" ? "start" : "dev",
      "--hostname",
      host,
      "--port",
      port,
    ];
    const serverLabel =
      mode === "production" ? "starting production server" : "starting dev server";
    const serverChild = spawnLoggedProcess(serverArgs, serverLabel);

    serverChild.once("error", (error) => {
      writeLogLine(
        `[playwright-web-server] failed to start managed server: ${error.message}`,
      );
      closeLogStream();
      process.exit(1);
    });

    const result = await waitForExit(serverChild);
    closeLogStream();
    process.exit(result.code ?? 1);
  } catch (error) {
    const message =
      error instanceof Error ? error.stack || error.message : String(error);
    writeLogLine(`[playwright-web-server] fatal error:\n${message}`);
    process.stderr.write(`${message}\n`);
    closeLogStream();
    process.exit(1);
  }
}

void main();
