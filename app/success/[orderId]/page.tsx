import Link from 'next/link';

import { connectDB } from '@/lib/db';
import Registration from '@/models/Registration';

export const dynamic = 'force-dynamic';

type SuccessPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

type RegistrationDoc = {
  studentName?: string;
  phone?: string;
  amount?: number;
  currency?: string;
  hallTicket?: string;
};

export default async function SuccessPage({ params }: SuccessPageProps) {
  const { orderId } = await params;
  await connectDB();
  const registration = await Registration.findOne({
    orderId,
  }).lean<RegistrationDoc>();

  if (!registration) {
    return (
      <div className="public-flow-page flex items-center justify-center">
        <div className="public-flow-shell-narrow">
          <div className="public-flow-surface mx-auto max-w-xl text-center">
            <div className="public-flow-badge mb-5">Registration Lookup</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invalid Order ID
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              We couldn&apos;t find your registration. Please recheck the link or
              contact support if you still need help.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currencyPrefix =
    registration.currency === 'INR'
      ? '₹'
      : registration.currency === 'USD'
        ? '$'
        : registration.currency
          ? `${registration.currency} `
          : '';
  const amountLabel =
    typeof registration.amount === 'number' && registration.currency
      ? `${currencyPrefix}${registration.amount}`
      : null;

  return (
    <div className="public-flow-page flex items-center justify-center">
      <div className="public-flow-shell-narrow">
        <div className="public-flow-surface mx-auto max-w-xl text-center">
          <div className="public-flow-badge mb-5">Payment Confirmed</div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Registration Successful
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Thank you,{' '}
            <span className="font-semibold text-foreground">
              {String(registration.studentName || 'Student')}
            </span>
            .
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Your payment was received. We&apos;ll contact you at{' '}
            <span className="font-semibold text-foreground">
              {String(registration.phone || 'your registered number')}
            </span>
            .
          </p>
          {amountLabel ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Amount paid: <span className="font-semibold text-foreground">{amountLabel}</span>
            </p>
          ) : null}
          {registration.hallTicket ? (
            <div className="public-flow-card-soft mt-6 text-left sm:text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Hall Ticket Number
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {registration.hallTicket}
              </p>
            </div>
          ) : null}
          <div className="mt-8 flex justify-center">
            <Link href="/" className="public-flow-button-primary">
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
