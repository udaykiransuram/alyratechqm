import type { Metadata } from "next";
import Link from "next/link";

import { connectDB } from "@/lib/db";
import { hashRegistrationLookupToken } from "@/lib/security/registration-security";
import { SUMMER_CRASH_HOME_PATH } from "@/lib/summer-crash/constants";
import { formatSummerCrashPrice } from "@/lib/summer-crash/shared";
import SummerCrashPayment from "@/models/SummerCrashPayment";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment Status | Summer Crash Course",
  description: "Check the Summer Crash Course payment status.",
};

type SummerCrashPaymentPageProps = {
  params: Promise<{
    orderId: string;
  }>;
  searchParams: Promise<{
    token?: string;
    order_status?: string;
  }>;
};

type SummerCrashPaymentDoc = {
  amount?: number;
  currency?: string;
  status?: string;
  studentName?: string;
  classBand?: string;
  successLookupTokenHash?: string;
};

function isFailedOrderStatus(value: unknown) {
  const normalized = String(value || "").trim().toUpperCase();
  return (
    normalized === "FAILED" ||
    normalized === "EXPIRED" ||
    normalized === "CANCELLED" ||
    normalized === "USER_DROPPED"
  );
}

export default async function SummerCrashPaymentPage({
  params,
  searchParams,
}: SummerCrashPaymentPageProps) {
  const [{ orderId }, { token, order_status: orderStatus }] = await Promise.all([
    params,
    searchParams,
  ]);
  const providedToken = String(token || "").trim();

  if (!providedToken) {
    return (
      <div className="public-flow-page flex items-center justify-center">
        <div className="public-flow-shell-narrow">
          <div className="public-flow-surface mx-auto max-w-xl text-center">
            <div className="public-flow-badge mb-5">Secure Link Required</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invalid or expired payment link
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Open the exact payment completion link sent by the payment provider.
            </p>
          </div>
        </div>
      </div>
    );
  }

  await connectDB();
  const tokenHash = hashRegistrationLookupToken(providedToken);
  const payment = await SummerCrashPayment.findOne({
    orderId,
    successLookupTokenHash: tokenHash,
  }).lean<SummerCrashPaymentDoc>();

  if (!payment) {
    return (
      <div className="public-flow-page flex items-center justify-center">
        <div className="public-flow-shell-narrow">
          <div className="public-flow-surface mx-auto max-w-xl text-center">
            <div className="public-flow-badge mb-5">Payment Lookup</div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invalid payment link
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              We couldn&apos;t find this Summer Crash Course payment. Return to the
              Summer home and try again if needed.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href={SUMMER_CRASH_HOME_PATH} className="public-flow-button-primary">
                Go to Summer Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const amountLabel = formatSummerCrashPrice(payment.amount, payment.currency);
  const normalizedStatus = String(payment.status || "").trim().toLowerCase();
  const paid = normalizedStatus === "paid";
  const failed = !paid && (normalizedStatus === "failed" || isFailedOrderStatus(orderStatus));

  return (
    <div className="public-flow-page flex items-center justify-center">
      <div className="public-flow-shell-narrow">
        <div className="public-flow-surface mx-auto max-w-xl text-center">
          <div className="public-flow-badge mb-5">
            {paid
              ? "Payment Confirmed"
              : failed
                ? "Payment Not Completed"
                : "Payment Pending"}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {paid
              ? "Summer Course Unlocked"
              : failed
                ? "Payment Not Completed"
                : "Waiting for Payment Confirmation"}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {paid
              ? "Your Summer Crash Course payment was received. Open the Summer home to start the lessons."
              : failed
                ? "This payment was not completed. Return to the Summer home to retry when you are ready."
                : "We are still waiting for the payment provider to confirm this transaction. Please check again in a moment."}
          </p>

          <div className="public-flow-card-soft mt-6 space-y-2 text-left sm:text-center">
            {payment.studentName ? (
              <p className="text-sm font-medium text-foreground">
                Student: {payment.studentName}
              </p>
            ) : null}
            {payment.classBand ? (
              <p className="text-sm text-muted-foreground">{payment.classBand}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Amount: <span className="font-semibold text-foreground">{amountLabel}</span>
            </p>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={SUMMER_CRASH_HOME_PATH} className="public-flow-button-primary">
              {paid ? "Continue to Summer Home" : "Back to Summer Home"}
            </Link>
            {!paid ? (
              <Link
                href="/summer-crash-course/signin"
                className="public-flow-button-secondary"
              >
                Sign In Again
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
