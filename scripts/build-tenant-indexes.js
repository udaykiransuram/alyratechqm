import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const child = spawn(
  process.execPath,
  [
    '--loader',
    'ts-node/esm',
    '--loader',
    './scripts/alias-loader.mjs',
    'scripts/build-tenant-indexes.ts',
  ],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TS_NODE_TRANSPILE_ONLY: process.env.TS_NODE_TRANSPILE_ONLY || '1',
    },
    stdio: 'inherit',
  },
);

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Tenant index build terminated by ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
