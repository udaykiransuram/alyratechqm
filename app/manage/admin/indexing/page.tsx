import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import IndexingClient from './IndexingClient'; // We'll create this client component
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

export default async function IndexingPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'admin') {
    redirect('/');
  }

  return (
    <Suspense fallback={<Skeleton className="h-32 w-full" />}>
      <IndexingClient />
    </Suspense>
  );
}
