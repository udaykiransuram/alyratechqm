export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant';
import '@/models/Registration';
import { getSchoolKeyFromServerCookies } from '@/lib/server/school';

function SuccessState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="app-page-shell max-w-md px-4 py-6 sm:px-0">
      <div className="app-page-header text-center">
        <h1 className="app-page-title">{title}</h1>
        <p className="app-page-subtitle">{description}</p>
      </div>
      <div className="app-surface app-surface-body text-center">{action}</div>
    </div>
  );
}

export default async function SuccessPage({ params }: any) {
  await connectDB();
  const schoolKey = getSchoolKeyFromServerCookies(cookies());
  if (!schoolKey) {
    return (
      <SuccessState
        title="School Selection Required"
        description="Select a school first to view this registration confirmation."
      />
    );
  }

  const conn = await getTenantDb(schoolKey);
  const RegistrationModel = conn.model('Registration');
  const registration = await RegistrationModel.findOne({ orderId: params.orderId });

  if (!registration) {
    return (
      <SuccessState
        title="Invalid Order ID"
        description="We could not find a registration for this order reference."
      />
    );
  }

  return (
    <div className="app-page-shell max-w-md px-4 py-6 sm:px-0">
      <div className="app-page-header text-center">
        <h1 className="app-page-title">Registration Successful</h1>
        <p className="app-page-subtitle">
          Your registration has been confirmed and the hall ticket is ready to download.
        </p>
      </div>

      <div className="app-surface app-surface-body text-center">
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            Thank you, {registration.studentName}!
          </p>
          <p className="text-sm text-muted-foreground">
            Your payment was received successfully. We&apos;ll contact you at {registration.phone}.
          </p>
        </div>

        <a
          href={`/api/hallticket/${registration.orderId}`}
          className="app-button-primary"
          download
        >
          Download Hall Ticket PDF
        </a>
      </div>
    </div>
  );
}
