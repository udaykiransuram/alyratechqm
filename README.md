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
- `npm run test:e2e` runs Playwright end-to-end tests
- `npm run test:e2e:online-integration` runs real backend student online-test integration e2e
- `npm run gate:student-tests:seed -- --students=100` seeds disposable load-gate data
- `npm run gate:student-tests:load -- --school=<key> --paper=<paperId> --students=<jsonFile>` runs load gate with latency/failure/audit thresholds
- `npm run preflight:online-test` runs typecheck, targeted lint, integration e2e, and load gate in one command

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
