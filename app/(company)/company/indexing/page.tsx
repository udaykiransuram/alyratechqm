import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PageHero from '@/components/layout/PageHero';
import IndexingClient from './IndexingClient';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { isProductionAdminMaintenanceEnabled } from '@/lib/ops-runtime';
import { connectDB } from '@/lib/db';
import School from '@/models/School';

export const dynamic = 'force-dynamic';

export default async function IndexingPage() {
  if (!isProductionAdminMaintenanceEnabled()) {
    redirect('/company/schools');
  }

  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== 'company_admin' ||
    session.user.role !== 'company_admin'
  ) {
    redirect('/company/schools');
  }

  await connectDB();
  const schools = await School.find({})
    .sort({ displayName: 1 })
    .select('key displayName')
    .lean();

  return (
    <Suspense
      fallback={
        <div className="app-page-shell max-w-4xl px-4 py-6 sm:px-0">
          <PageHero
            eyebrow="Operations"
            title="Maintenance Console"
            description="Loading indexing and student cleanup tools."
          />
          <div className="app-surface app-surface-body">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-36" />
          </div>
        </div>
      }
    >
      <IndexingClient
        initialSchoolOptions={(schools || []).map((school: any) => ({
          key: String(school?.key || ''),
          displayName: String(school?.displayName || ''),
        }))}
      />
    </Suspense>
  );
}
