import os from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";

import bcrypt from "bcryptjs";

type PasswordCompareJob = {
  id: number;
  password: string;
  hash: string;
  resolve: (matched: boolean) => void;
  reject: (error: unknown) => void;
};

type PasswordCompareWorkerSlot = {
  worker: Worker;
  activeJobId: number | null;
};

type PasswordCompareRuntime = {
  disabled: boolean;
  initialized: boolean;
  nextJobId: number;
  queue: PasswordCompareJob[];
  pendingById: Map<number, PasswordCompareJob>;
  workers: PasswordCompareWorkerSlot[];
};

type PasswordCompareWorkerMessage = {
  id: number;
  matched?: boolean;
  error?: string;
};

const PASSWORD_COMPARE_WORKER_PATH = path.resolve(
  process.cwd(),
  "lib/server/password-compare-worker.cjs",
);

function resolvePasswordComparePoolSize() {
  const configuredSize = Number.parseInt(
    String(process.env.AUTH_PASSWORD_WORKER_POOL_MAX || "").trim(),
    10,
  );
  if (Number.isFinite(configuredSize)) {
    return Math.max(0, configuredSize);
  }

  const cpuCount =
    typeof os.availableParallelism === "function"
      ? os.availableParallelism()
      : os.cpus().length;

  return Math.min(8, Math.max(2, cpuCount - 1));
}

function getPasswordCompareRuntime() {
  const globalState = globalThis as typeof globalThis & {
    __passwordCompareRuntime?: PasswordCompareRuntime;
  };

  if (!globalState.__passwordCompareRuntime) {
    globalState.__passwordCompareRuntime = {
      disabled: false,
      initialized: false,
      nextJobId: 1,
      queue: [],
      pendingById: new Map(),
      workers: [],
    };
  }

  return globalState.__passwordCompareRuntime;
}

function removePasswordCompareWorker(
  runtime: PasswordCompareRuntime,
  slot: PasswordCompareWorkerSlot,
) {
  const index = runtime.workers.indexOf(slot);
  if (index >= 0) {
    runtime.workers.splice(index, 1);
  }
}

function dispatchPasswordCompareJobs(runtime: PasswordCompareRuntime) {
  if (runtime.disabled) {
    return;
  }

  for (const slot of runtime.workers) {
    if (slot.activeJobId !== null) {
      continue;
    }

    const nextJob = runtime.queue.shift();
    if (!nextJob) {
      return;
    }

    slot.activeJobId = nextJob.id;
    runtime.pendingById.set(nextJob.id, nextJob);
    slot.worker.postMessage({
      id: nextJob.id,
      password: nextJob.password,
      hash: nextJob.hash,
    });
  }
}

function settlePasswordCompareJob(
  runtime: PasswordCompareRuntime,
  slot: PasswordCompareWorkerSlot,
  message: PasswordCompareWorkerMessage,
) {
  slot.activeJobId = null;

  const job = runtime.pendingById.get(message.id);
  if (!job) {
    dispatchPasswordCompareJobs(runtime);
    return;
  }

  runtime.pendingById.delete(message.id);
  if (message.error) {
    job.reject(new Error(message.error));
  } else {
    job.resolve(Boolean(message.matched));
  }

  dispatchPasswordCompareJobs(runtime);
}

function rejectActivePasswordCompareJob(
  runtime: PasswordCompareRuntime,
  slot: PasswordCompareWorkerSlot,
  error: unknown,
) {
  const activeJobId = slot.activeJobId;
  slot.activeJobId = null;

  if (activeJobId === null) {
    return;
  }

  const job = runtime.pendingById.get(activeJobId);
  if (!job) {
    return;
  }

  runtime.pendingById.delete(activeJobId);
  job.reject(error);
}

function spawnPasswordCompareWorker(runtime: PasswordCompareRuntime) {
  try {
    const worker = new Worker(PASSWORD_COMPARE_WORKER_PATH);
    worker.unref();

    const slot: PasswordCompareWorkerSlot = {
      worker,
      activeJobId: null,
    };

    worker.on("message", (message) => {
      settlePasswordCompareJob(
        runtime,
        slot,
        message as PasswordCompareWorkerMessage,
      );
    });

    worker.on("error", (error) => {
      rejectActivePasswordCompareJob(runtime, slot, error);
      removePasswordCompareWorker(runtime, slot);
      dispatchPasswordCompareJobs(runtime);
    });

    worker.on("exit", (code) => {
      rejectActivePasswordCompareJob(
        runtime,
        slot,
        new Error(
          code === 0
            ? "Password compare worker stopped unexpectedly."
            : `Password compare worker exited with code ${code}.`,
        ),
      );
      removePasswordCompareWorker(runtime, slot);
      if (!runtime.disabled && code !== 0) {
        spawnPasswordCompareWorker(runtime);
      }
      dispatchPasswordCompareJobs(runtime);
    });

    runtime.workers.push(slot);
  } catch (error) {
    runtime.disabled = true;
    console.error(
      "Password compare worker pool failed to start. Falling back to the main thread:",
      error,
    );
  }
}

function ensurePasswordCompareWorkerPool(runtime: PasswordCompareRuntime) {
  if (runtime.initialized || runtime.disabled) {
    return;
  }

  runtime.initialized = true;
  const poolSize = resolvePasswordComparePoolSize();
  if (poolSize <= 0) {
    runtime.disabled = true;
    return;
  }

  for (let index = 0; index < poolSize; index += 1) {
    spawnPasswordCompareWorker(runtime);
    if (runtime.disabled) {
      break;
    }
  }

  if (runtime.workers.length === 0) {
    runtime.disabled = true;
  }
}

function runPasswordCompareInWorker(password: string, hash: string) {
  const runtime = getPasswordCompareRuntime();
  ensurePasswordCompareWorkerPool(runtime);

  if (runtime.disabled || runtime.workers.length === 0) {
    return bcrypt.compare(password, hash);
  }

  return new Promise<boolean>((resolve, reject) => {
    const job: PasswordCompareJob = {
      id: runtime.nextJobId++,
      password,
      hash,
      resolve,
      reject,
    };

    runtime.queue.push(job);
    dispatchPasswordCompareJobs(runtime);
  });
}

export async function comparePasswordHash(password: string, hash: string) {
  const normalizedHash = String(hash || "").trim();
  if (!normalizedHash) {
    return false;
  }

  try {
    return await runPasswordCompareInWorker(password, normalizedHash);
  } catch {
    return bcrypt.compare(password, normalizedHash);
  }
}
