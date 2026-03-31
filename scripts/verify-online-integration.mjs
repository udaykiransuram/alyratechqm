import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const runtimeDatabaseUrl = String(
  process.env.EXAM_RUNTIME_DATABASE_URL || process.env.DATABASE_URL || "",
).trim();
const useExternalServer = process.env.PLAYWRIGHT_USE_EXTERNAL_SERVER === "1";

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  return `${(ms / 1000).toFixed(1)}s`;
}

async function runLane(label, envOverrides = {}) {
  const startedAt = Date.now();
  console.log(`\n[verify:integration] ${label}`);

  const child = spawn(npmCommand, ["run", "test:e2e:online-integration"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverrides,
    },
  });

  const result = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });

  if (result.code !== 0) {
    const reason = [
      typeof result.code === "number" ? `exit ${result.code}` : "",
      result.signal ? `signal ${result.signal}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `${label} failed after ${formatDuration(Date.now() - startedAt)}${
        reason ? ` (${reason})` : ""
      }.`,
    );
  }

  console.log(
    `[verify:integration] ${label} passed in ${formatDuration(
      Date.now() - startedAt,
    )}.`,
  );
}

async function main() {
  const startedAt = Date.now();

  if (useExternalServer) {
    await runLane("Student online-test integration against external server");
    if (runtimeDatabaseUrl) {
      console.log(
        "[verify:integration] Runtime on/off matrix skipped because PLAYWRIGHT_USE_EXTERNAL_SERVER=1; toggle the target server environment separately for that coverage.",
      );
    }
    return;
  }

  await runLane("Student online-test integration (exam runtime disabled)", {
    EXAM_RUNTIME_DATABASE_URL: "",
    DATABASE_URL: "",
  });

  if (!runtimeDatabaseUrl) {
    console.log(
      "[verify:integration] Exam runtime enabled lane skipped because EXAM_RUNTIME_DATABASE_URL is not configured.",
    );
    return;
  }

  await runLane("Student online-test integration (exam runtime enabled)", {
    EXAM_RUNTIME_DATABASE_URL: runtimeDatabaseUrl,
    DATABASE_URL: runtimeDatabaseUrl,
  });

  console.log(
    `\n[verify:integration] Completed all configured lanes in ${formatDuration(
      Date.now() - startedAt,
    )}.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n[verify:integration] ${message}`);
  process.exit(1);
});
