'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="app-page-shell max-w-3xl py-6">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">Something went wrong</h1>
          <p className="app-page-subtitle">
            The page hit an unexpected error. You can retry without leaving the current flow.
          </p>
        </div>
        <Button onClick={reset}>Try again</Button>
      </div>

      <div className="app-feedback app-feedback-error">
        {error?.message || 'Unexpected application error.'}
      </div>
    </div>
  );
}
