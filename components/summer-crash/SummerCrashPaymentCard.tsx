"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import { CashfreeSDK, load } from "@/lib/cashfree";
import { SUMMER_CRASH_SCHOOL_KEY } from "@/lib/summer-crash/constants";
import { formatSummerCrashPrice } from "@/lib/summer-crash/shared";

type SummerCrashPaymentCardProps = {
  price: number;
  currency: string;
  latestPaymentStatus: "none" | "pending" | "paid" | "failed";
};

type SummerCrashPaymentResponse = {
  payment_session_id?: string;
  orderId?: string;
};

export default function SummerCrashPaymentCard({
  price,
  currency,
  latestPaymentStatus,
}: SummerCrashPaymentCardProps) {
  const [cashfreeSDK, setCashfreeSDK] = useState<CashfreeSDK | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSdkLoading, setIsSdkLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    load({ mode: process.env.NEXT_PUBLIC_CASHFREE_ENV || "sandbox" })
      .then((sdk) => {
        if (cancelled) {
          return;
        }
        setCashfreeSDK(sdk);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setErrorMessage(
          "We couldn't load the payment module right now. Please refresh and try again.",
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsSdkLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePayNow = () => {
    setErrorMessage("");

    startTransition(() => {
      void (async () => {
        try {
          const response = await fetchApiJson<SummerCrashPaymentResponse>(
            "/api/cashfree/summer-crash-pay",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({}),
              schoolKey: SUMMER_CRASH_SCHOOL_KEY,
              includeSchoolQuery: false,
              fallbackMessage:
                "We couldn't start the Summer Crash Course payment.",
            },
          );

          if (!response?.payment_session_id) {
            throw new Error("Payment session not received.");
          }

          await cashfreeSDK?.checkout({
            paymentSessionId: response.payment_session_id,
          });
        } catch (error) {
          setErrorMessage(
            getClientRequestErrorMessage(
              error,
              "We couldn't start the Summer Crash Course payment.",
            ),
          );
        }
      })();
    });
  };

  const amountLabel = formatSummerCrashPrice(price, currency);
  const primaryLabel =
    latestPaymentStatus === "pending"
      ? `Retry Payment ${amountLabel}`
      : `Pay ${amountLabel}`;

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          disabled={isPending || isSdkLoading || !cashfreeSDK}
          className="app-button-primary w-full"
          onClick={handlePayNow}
        >
          {isPending
            ? "Opening payment..."
            : isSdkLoading || !cashfreeSDK
              ? "Loading payment..."
              : primaryLabel}
        </Button>

        {latestPaymentStatus === "pending" ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Refresh payment status
          </Button>
        ) : null}
      </div>
    </div>
  );
}
