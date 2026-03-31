# School Quality Management Workspace

A Next.js application for school quality management, assessment operations, analytics, and report delivery.

## Features

- Academic setup for schools, classes, sections, subjects, and users
- Question paper and response workflows
- Analytics and benchmark reporting
- Report dispatch and WhatsApp delivery tracking
- Tenant-aware data access with school-scoped workspaces

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MongoDB with Mongoose
- **UI Components**: Radix UI
- **Rich Text Editor**: Tiptap

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB instance (local or cloud)

### Installation

1. Clone your repository and open the project folder.
2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

4. Run the development server:

```bash
npm run dev
```

5. Open `http://localhost:3000` in your browser.

## Scripts

- `npm run dev` starts the development server
- `npm run build` creates a production build
- `npm start` starts the production server
- `npm run lint` runs ESLint
- `npm run verify:core` runs lint, typecheck, and production build
- `npm run verify:integration` runs the real-backend student online-test integration verifier and, when the app server is managed locally and `EXAM_RUNTIME_DATABASE_URL` is configured, exercises both exam-runtime-off and exam-runtime-on lanes
- `npm run verify:full` runs release health, the full local Playwright suite, and student online-test integration verification
- `npm run verify:extended` runs `verify:full` plus the online-test preflight/load gate
- `npm run test:e2e` runs Playwright end-to-end tests
- `npm run test:e2e:list` lists the local Playwright suite without starting the app server
- `npm run test:e2e:desktop` runs the desktop Playwright project only
- `npm run test:e2e:mobile` runs the mobile Playwright project only
- `npm run test:e2e:report` opens the latest Playwright HTML report
- `npm run test:e2e:online-integration` runs the raw single-lane real-backend student online-test integration suite
- `npm run stress:student-tests -- --school=<key> --paper=<paperId> --students=<jsonFile>` runs the low-level online exam stress harness directly
- `npm run stress:online-test -- --seed-students=100 --concurrency=50` auto-seeds disposable online-exam data if needed, holds a local server open when `BASE_URL` is loopback, and runs the gated stress lane
- `npm run gate:student-tests:seed -- --students=100` seeds disposable load-gate data
- `npm run gate:student-tests:load -- --school=<key> --paper=<paperId> --students=<jsonFile>` runs load gate with latency/failure/audit thresholds
- `npm run preflight:online-test` runs typecheck, targeted lint, integration e2e, and load gate in one command

## Online Exam Stress

Use the raw harness when you already have a school, paper, and student file:

```bash
npm run stress:student-tests -- \
  --base=http://127.0.0.1:3000 \
  --school=<schoolKey> \
  --paper=<paperId> \
  --students=./scripts/student-exam-stress.example.json \
  --concurrency=25 \
  --rounds=3 \
  --list-first=true
```

Use the higher-level gated wrapper when you want a disposable online-test run with less setup:

```bash
npm run stress:online-test -- \
  --seed-students=100 \
  --concurrency=50 \
  --rounds=3
```

Notes:

- When `BASE_URL` points to `127.0.0.1` or `localhost`, the stress wrapper starts and holds a managed Next server for the whole run.
- Local loopback stress runs now default to a managed Next production server for more realistic latency numbers. Use `--server-mode=dev` if you want a quicker smoke run instead.
- When `BASE_URL` points to staging or another remote host, the wrapper treats that app as an external server and does not start a local one.
- The gated lane exercises `GET /api/student/tests`, detail load, attempt start, incremental saves, heartbeat, and final submit.
- Reports are written to `/tmp/online-test-stress-*.json` and `/tmp/online-test-stress-*.json.gate.json` unless you override `--out` and `--gate-out`.
- Auto-seeded runs also write seed metadata to `/tmp/online-test-stress-seed-*.json`.
- `npm run stress:online-test -- --help`, `npm run gate:student-tests:load -- --help`, and `npm run preflight:online-test -- --help` print the supported flags.
- GitHub Actions includes a manual `Online Test Stress` workflow for staged load runs without editing code.
- GitHub Actions CI now verifies the real-backend online-test integration lane with exam runtime both disabled and enabled.

## Project Structure

```text
.
├── app/          # App routes, pages, and API handlers
├── components/   # UI and layout components
├── hooks/        # Custom React hooks
├── lib/          # Shared utilities and data access helpers
├── local-tests/  # Playwright tests
├── models/       # Mongoose models
├── types/        # TypeScript type definitions
└── utils/        # Miscellaneous helpers
```

## License

ISC
