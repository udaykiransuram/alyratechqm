"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import SummerCrashEarlyBirdOffer from "@/components/summer-crash/SummerCrashEarlyBirdOffer";
import { Button } from "@/components/ui/button";
import FeedbackNotice from "@/components/ui/feedback-notice";
import {
  fetchApiJson,
  getClientRequestErrorMessage,
} from "@/lib/client/api";
import { CashfreeSDK, load } from "@/lib/cashfree";
import { SUMMER_CRASH_SCHOOL_KEY } from "@/lib/summer-crash/constants";
import type { SummerCrashEarlyBirdOffer as SummerCrashEarlyBirdOfferData } from "@/lib/summer-crash/offer";
import { formatSummerCrashPrice } from "@/lib/summer-crash/shared";

type SummerCrashPaymentCardProps = {
  price: number;
  currency: string;
  latestPaymentStatus: "none" | "pending" | "paid" | "failed";
  autoOpen?: boolean;
  earlyBirdOffer?: SummerCrashEarlyBirdOfferData | null;
  offerVariant?: "surface" | "soft" | "inverse";
};

type SummerCrashPaymentResponse = {
  payment_session_id?: string;
  orderId?: string;
};

export default function SummerCrashPaymentCard({
  price,
  currency,
  latestPaymentStatus,
  autoOpen = false,
  earlyBirdOffer = null,
  offerVariant = "soft",
}: SummerCrashPaymentCardProps) {
  const [cashfreeSDK, setCashfreeSDK] = useState<CashfreeSDK | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSdkLoading, setIsSdkLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sdkPromiseRef = useRef<Promise<CashfreeSDK | null> | null>(null);
  const autoOpenTriggeredRef = useRef(false);
  const handlePayNowRef = useRef<() => void>(() => undefined);

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

  const clearAutoOpenPaymentIntent = () => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    if (!url.searchParams.has("promptPayment")) {
      return;
    }

    url.searchParams.delete("promptPayment");
    url.searchParams.delete("source");

    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", nextPath);
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

  handlePayNowRef.current = handlePayNow;

  useEffect(() => {
    if (!autoOpen || autoOpenTriggeredRef.current) {
      return;
    }

    autoOpenTriggeredRef.current = true;
    clearAutoOpenPaymentIntent();
    handlePayNowRef.current();
  }, [autoOpen]);

  const amountLabel = formatSummerCrashPrice(price, currency);
  const primaryLabel =
    latestPaymentStatus === "pending"
      ? `Try Payment Again ${amountLabel}`
      : `Pay ${amountLabel}`;

  return (
    <div className="space-y-3">
      {errorMessage ? (
        <FeedbackNotice variant="error">{errorMessage}</FeedbackNotice>
      ) : null}

      {earlyBirdOffer ? (
        <SummerCrashEarlyBirdOffer
          offer={earlyBirdOffer}
          variant={offerVariant}
          compact
          title="Early bird course price"
          subtitle="Use the discounted course price before the timer ends. The free diagnostic stays open."
        />
      ) : null}

      <div className="public-summer-flow-stack">
        <Button
          type="button"
          disabled={isPending || isSdkLoading}
          className="app-button-primary min-h-11 w-full"
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
            className="w-full border-border/70 bg-background/70"
            onClick={() => window.location.reload()}
          >
            Check payment status
          </Button>
        ) : null}
      </div>
    </div>
  );
}
