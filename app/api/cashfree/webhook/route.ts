import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import Registration from "@/models/Registration";
import SummerCrashPayment from "@/models/SummerCrashPayment";

export const runtime = "nodejs";

type CashfreeWebhookPayload = {
  order_status?: string;
  order_id?: string;
  cf_payment_id?: string;
  payment_id?: string;
  transaction_id?: string;
  event_id?: string;
};

function generateHallTicket(orderId: string) {
  const random = Math.floor(100 + Math.random() * 900);
  return `HT-2025-${orderId.slice(-6)}-${random}`;
}

async function sendWhatsAppCloudAPI(phone: string, message: string) {
  const token =
    process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || "";
  const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to: `91${phone}`,
    type: "text",
    text: { body: message },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WhatsApp API error: ${errorText}`);
  }
}

function resolveWebhookEventId(
  payload: Record<string, unknown>,
  signature: string,
) {
  const providerIdCandidates = [
    payload.cf_payment_id,
    payload.payment_id,
    payload.transaction_id,
    payload.event_id,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (providerIdCandidates.length > 0) {
    return providerIdCandidates[0];
  }

  return `sig:${signature}`;
}

function safeEqualBase64(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (
    leftBuffer.length === 0 ||
    rightBuffer.length === 0 ||
    leftBuffer.length !== rightBuffer.length
  ) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeSummerCrashWebhookStatus(orderStatus: unknown) {
  const normalized = String(orderStatus || "").trim().toUpperCase();
  if (normalized === "PAID") {
    return "paid" as const;
  }
  if (
    normalized === "FAILED" ||
    normalized === "EXPIRED" ||
    normalized === "CANCELLED" ||
    normalized === "USER_DROPPED"
  ) {
    return "failed" as const;
  }
  return null;
}

async function handleSummerCrashPaymentWebhook(params: {
  orderId: string;
  eventId: string;
  paymentId: string;
  normalizedStatus: "paid" | "failed" | null;
}) {
  const payment = await SummerCrashPayment.findOne({
    orderId: params.orderId,
  });

  if (!payment) {
    return null;
  }

  const processedEventIds = Array.isArray(payment.processedWebhookEventIds)
    ? payment.processedWebhookEventIds
    : [];
  if (processedEventIds.includes(params.eventId)) {
    return NextResponse.json({
      status: "ignored",
      message: "Duplicate webhook event ignored",
    });
  }

  if (!params.normalizedStatus) {
    return NextResponse.json({ status: "ignored" });
  }

  const updateDoc: Record<string, unknown> = {
    $addToSet: { processedWebhookEventIds: params.eventId },
    $set: {
      status: params.normalizedStatus,
      ...(params.paymentId ? { cashfreePaymentId: params.paymentId } : {}),
      ...(params.normalizedStatus === "paid" && !payment.paidAt
        ? { paidAt: new Date() }
        : {}),
    },
  };

  const updated = await SummerCrashPayment.findOneAndUpdate(
    { _id: payment._id },
    updateDoc,
    { new: true },
  );

  if (!updated) {
    return NextResponse.json(
      { status: "error", message: "Failed to update summer payment state" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: params.normalizedStatus === "paid" ? "success" : "failed",
  });
}

async function handleTalentTestRegistrationWebhook(params: {
  orderId: string;
  eventId: string;
  paymentId: string;
  orderStatus: string;
}) {
  if (params.orderStatus !== "PAID") {
    return NextResponse.json({ status: "ignored" });
  }

  const registration = await Registration.findOne({ orderId: params.orderId });
  if (!registration) {
    return NextResponse.json(
      { status: "error", message: "Registration not found" },
      { status: 404 },
    );
  }

  const processedEventIds = Array.isArray(registration.processedWebhookEventIds)
    ? registration.processedWebhookEventIds
    : [];
  if (processedEventIds.includes(params.eventId)) {
    return NextResponse.json({
      status: "ignored",
      message: "Duplicate webhook event ignored",
    });
  }

  const alreadyPaid =
    String(registration.status || "").toLowerCase() === "paid" &&
    Boolean(registration.hallTicket);

  const hallTicket = alreadyPaid
    ? String(registration.hallTicket || "")
    : generateHallTicket(params.orderId);

  const updateDoc: Record<string, unknown> = {
    $addToSet: { processedWebhookEventIds: params.eventId },
    $set: {
      status: "paid",
      hallTicket,
      ...(registration.paidAt ? {} : { paidAt: new Date() }),
      ...(params.paymentId ? { cashfreePaymentId: params.paymentId } : {}),
    },
  };

  const updated = await Registration.findOneAndUpdate(
    { _id: registration._id },
    updateDoc,
    { new: true },
  );

  if (!updated) {
    return NextResponse.json(
      { status: "error", message: "Failed to update registration state" },
      { status: 500 },
    );
  }

  let hallTicketWhatsappSent = false;
  const canSendWhatsApp =
    process.env.WHATSAPP_PHONE_NUMBER_ID &&
    (process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN);
  if (canSendWhatsApp && !updated.hallTicketWhatsappSent) {
    try {
      await sendWhatsAppCloudAPI(
        String(updated.phone || ""),
        `Registration successful.\nYour Hall Ticket: ${hallTicket}\nThank you for registering for the Talent Test.`,
      );
      hallTicketWhatsappSent = true;
    } catch (waError) {
      console.error("WhatsApp send error:", waError);
    }
  } else if (!canSendWhatsApp) {
    console.warn("WhatsApp env not configured; skipping WhatsApp notification");
  }

  await Registration.updateOne(
    { orderId: params.orderId },
    {
      hallTicket,
      hallTicketWhatsappSent:
        updated.hallTicketWhatsappSent || hallTicketWhatsappSent,
    },
  );

  return NextResponse.json({ status: "success", hallTicket });
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.CASHFREE_WEBHOOK_SECRET) {
      return new NextResponse("Webhook secret is not configured", {
        status: 500,
      });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");

    if (!signature) {
      return new NextResponse("Missing signature", { status: 400 });
    }

    const expected = crypto
      .createHmac("sha256", process.env.CASHFREE_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("base64");

    if (!safeEqualBase64(signature, expected)) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const payload = JSON.parse(rawBody) as CashfreeWebhookPayload;
    const orderId = String(payload.order_id || "").trim();

    if (!orderId) {
      return NextResponse.json({ status: "ignored" });
    }

    const eventId = resolveWebhookEventId(
      payload as Record<string, unknown>,
      signature,
    );
    const paymentId = String(
      payload.cf_payment_id || payload.payment_id || payload.transaction_id || "",
    ).trim();

    await connectDB();

    const summerResponse = await handleSummerCrashPaymentWebhook({
      orderId,
      eventId,
      paymentId,
      normalizedStatus: normalizeSummerCrashWebhookStatus(payload.order_status),
    });
    if (summerResponse) {
      return summerResponse;
    }

    return handleTalentTestRegistrationWebhook({
      orderId,
      eventId,
      paymentId,
      orderStatus: String(payload.order_status || "").trim().toUpperCase(),
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
