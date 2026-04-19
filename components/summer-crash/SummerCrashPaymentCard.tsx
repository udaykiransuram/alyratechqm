"use client";

import { useRef, useState, useTransition } from "react";

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
  const [isSdkLoading, setIsSdkLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sdkPromiseRef = useRef<Promise<CashfreeSDK | null> | null>(null);

  const ensureCashfreeSdk = async (): Promise<CashfreeSDK> => {
    if (cashfreeSDK) {
      return cashfreeSDK;
    }

    if (!sdkPromiseRef.current) {
      setIsSdkLoading(true);
      sdkPromiseRef.current = load({
        mode: process.env.NEXT_PUBLIC_CASHFREE_ENV || "sandbox",
      });
    }

    try {
      const sdk = await sdkPromiseRef.current;
      if (!sdk) {
        sdkPromiseRef.current = null;
        throw new Error(
          "We couldn't load the payment module right now. Please refresh and try again.",
        );
      }
      setCashfreeSDK(sdk);
      return sdk;
    } catch (error) {
      sdkPromiseRef.current = null;
      throw error;
    } finally {
      setIsSdkLoading(false);
    }
  };

  const handlePayNow = () => {
    setErrorMessage("");

    startTransition(() => {
      void (async () => {
        try {
          const sdk = await ensureCashfreeSdk();
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

          await sdk.checkout({
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
      ? `Try Payment Again ${amountLabel}`
      : `Pay ${amountLabel}`;

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          type="button"
          disabled={isPending || isSdkLoading}
          className="app-button-primary w-full"
          onClick={handlePayNow}
        >
          {isPending
            ? "Opening payment..."
            : isSdkLoading
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
            Check payment status
          </Button>
        ) : null}
      </div>
    </div>
  );
}
