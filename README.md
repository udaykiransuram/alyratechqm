# Talent Test Registration

A Next.js application for talent test registration with Cashfree Payments integration.

## Features

- Student registration and test management
- Cashfree payment gateway integration
- Rich text editor for test questions
- MongoDB database for data persistence
- Admin dashboard for test management
- PDF generation for test results

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MongoDB with Mongoose
- **Payment**: Cashfree Payments
- **UI Components**: Radix UI
- **Rich Text Editor**: Tiptap

## Getting Started

### Prerequisites

- Node.js 18+ installed
- MongoDB instance (local or cloud)
- Cashfree account for payment integration

### Installation

1. Clone the repository:
```bash
git clone https://github.com/udaykiransuram/talent-test-registration.git
cd talent-test-registration
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
- MongoDB connection string
- Cashfree API credentials
- Other required environment variables

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## GitHub Copilot

This project is configured to work with GitHub Copilot. To enable Copilot:

### Prerequisites
1. Install [Visual Studio Code](https://code.visualstudio.com/)
2. Install the [GitHub Copilot extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
3. Install the [GitHub Copilot Chat extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)
4. Have an active GitHub Copilot subscription

### Setup
1. Open this project in VS Code
2. When prompted, install the recommended extensions (defined in `.vscode/extensions.json`)
3. Sign in to GitHub when prompted by the Copilot extension
4. Copilot will start providing suggestions as you code

### Using Copilot
- **Inline suggestions**: Start typing and Copilot will suggest completions (press Tab to accept)
- **Chat**: Open Copilot Chat from the sidebar or use `Ctrl+I` (inline chat) / `Ctrl+Shift+I` (chat panel)
- **Context-aware help**: Copilot has been configured with project-specific instructions in `.github/copilot-instructions.md`

For more information, see the [GitHub Copilot documentation](https://docs.github.com/en/copilot).

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   └── ...                # Pages and layouts
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Library code and utilities
├── models/                # MongoDB/Mongoose models
├── types/                 # TypeScript type definitions
├── utils/                 # Utility functions
└── public/               # Static assets
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

ISC
