# GitHub Copilot Instructions for Talent Test Registration

## Project Overview
This is a Next.js application for talent test registration with Cashfree Payments integration. The project uses TypeScript, React, Tailwind CSS, and MongoDB.

## Code Style Guidelines
- Use TypeScript for type safety
- Follow Next.js 14 App Router conventions
- Use functional React components with hooks
- Use Tailwind CSS for styling
- Follow the existing component structure in `/components`
- Use the established patterns for API routes in `/app/api`

## Key Technologies
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: MongoDB with Mongoose
- **Payment**: Cashfree Payments
- **UI Components**: Radix UI primitives
- **Rich Text Editor**: Tiptap

## Coding Conventions
- Use async/await for asynchronous operations
- Implement proper error handling with try-catch blocks
- Use environment variables for sensitive configuration
- Follow the existing file structure and naming conventions
- Use meaningful variable and function names
- Add comments for complex logic

## Common Patterns
- API routes should be in `/app/api/[endpoint]/route.ts`
- Server components by default, use 'use client' when needed
- Use custom hooks from `/hooks` for reusable logic
- Store utility functions in `/utils`
- Define TypeScript types in `/types` or local to components
- Use Mongoose models from `/models` for database operations
