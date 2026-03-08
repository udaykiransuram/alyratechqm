import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import IndexingClient from './IndexingClient';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

export default async function IndexingPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <Suspense
      fallback={
        <div className="app-page-shell max-w-4xl px-4 py-6 sm:px-0">
          <div className="app-page-header">
            <h1 className="app-page-title">Search Indexing</h1>
            <p className="app-page-subtitle">Loading index status and maintenance actions.</p>
          </div>
          <div className="app-surface app-surface-body">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      }
    >
      <IndexingClient />
    </Suspense>
  );
}
