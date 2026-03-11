'use client';

import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">
        <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-8">
          <div className="app-page-shell w-full">
            <div className="app-page-header-row">
              <div>
                <h1 className="app-page-title">Application error</h1>
                <p className="app-page-subtitle">
                  A global error stopped the app from rendering this screen correctly.
                </p>
              </div>
              <Button onClick={reset}>Reload view</Button>
            </div>
            <div className="app-feedback app-feedback-error">
              {error?.message || 'Unexpected application error.'}
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
