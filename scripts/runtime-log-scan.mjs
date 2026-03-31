import { existsSync, readFileSync } from "node:fs";

const UNEXPECTED_RUNTIME_PATTERNS = [
  /\bTypeError:\s+/i,
  /\bReferenceError:\s+/i,
  /\bSyntaxError:\s+/i,
  /\bRangeError:\s+/i,
  /\bUnhandled Runtime Error\b/i,
  /\bHydration failed\b/i,
  /\bCannot read properties of undefined\b/i,
  /\bCannot destructure property\b/i,
  /\bCannot access ['"`].+['"`] before initialization\b/i,
];

const IGNORED_RUNTIME_PATTERNS = [
  /The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set\./i,
];

function matchesAny(value, patterns) {
  return patterns.some((pattern) => pattern.test(value));
}

export function collectUnexpectedRuntimeLogEntries(logText) {
  const text = String(logText || "");
  if (!text.trim()) {
    return [];
  }

  const lines = text.split(/\r?\n/);
  const entries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || "");
    if (!line.trim()) {
      continue;
    }

    if (!matchesAny(line, UNEXPECTED_RUNTIME_PATTERNS)) {
      continue;
    }

    if (matchesAny(line, IGNORED_RUNTIME_PATTERNS)) {
      continue;
    }

    const context = [line, lines[index + 1], lines[index + 2]]
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!entries.some((entry) => entry.context === context)) {
      entries.push({
        line: index + 1,
        context,
      });
    }
  }

  return entries;
}

export function formatUnexpectedRuntimeLogEntries(entries, maxEntries = 5) {
  return entries
    .slice(0, maxEntries)
    .map((entry) => `line ${entry.line}\n${entry.context}`)
    .join("\n\n");
}

export function assertNoUnexpectedRuntimeErrorsInLogFile(
  logPath,
  label = "runtime log",
) {
  if (!existsSync(logPath)) {
    return;
  }

  const logText = readFileSync(logPath, "utf8");
  const entries = collectUnexpectedRuntimeLogEntries(logText);
  if (!entries.length) {
    return;
  }

  throw new Error(
    [
      `Unexpected runtime errors detected in ${label}: ${logPath}`,
      formatUnexpectedRuntimeLogEntries(entries),
    ].join("\n\n"),
  );
}
