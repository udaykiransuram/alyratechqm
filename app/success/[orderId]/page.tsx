import Link from 'next/link';

import { connectDB } from '@/lib/db';
import { hashRegistrationLookupToken } from '@/lib/security/registration-security';
import Registration from '@/models/Registration';

export const dynamic = 'force-dynamic';

type SuccessPageProps = {
  params: Promise<{
    orderId: string;
  }>;
  searchParams: Promise<{
    token?: string;
  }>;
};

type RegistrationDoc = {
  amount?: number;
  currency?: string;
  hallTicket?: string;
  successLookupTokenHash?: string;
};

export default async function SuccessPage({ params, searchParams }: SuccessPageProps) {
  const { orderId } = await params;
  const { token } = await searchParams;
  const providedToken = String(token || '').trim();

  if (!providedToken) {
    return (
      <div className="public-flow-page flex items-center justify-center">
        <div className="public-flow-shell-narrow">
          <div className="public-flow-surface mx-auto max-w-xl text-center">
            <div className="public-flow-badge mb-5">Secure Link Required</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invalid or expired success link
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Use the exact payment completion link sent by the payment provider.
            </p>
          </div>
        </div>
      </div>
    );
  }

  await connectDB();
  const tokenHash = hashRegistrationLookupToken(providedToken);
  const registration = await Registration.findOne({
    orderId,
    successLookupTokenHash: tokenHash,
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
            Your payment was received and your registration is now active.
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
