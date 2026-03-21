import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "@/models/ReportDispatchJob";
import { applyDeliveryWebhookUpdate } from "@/lib/reports/dispatchAttempts";
import { verifyWhatsAppWebhookSignature } from "@/lib/whatsapp/meta";

export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

function resolveCallbackData(statusPayload: any) {
  return String(
    statusPayload?.biz_opaque_callback_data ||
      statusPayload?.conversation?.biz_opaque_callback_data ||
      "",
  )
    .trim();
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && challenge && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json(
    { success: false, message: "Webhook verification failed" },
    { status: 403 },
  );
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const body = JSON.parse(rawBody);
    const statuses: any[] =
      body?.entry?.flatMap((e: any) =>
        (e?.changes || []).flatMap((c: any) => c?.value?.statuses || []),
      ) || [];

    if (!statuses.length) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    await connectDB();
    let updated = 0;

    for (const s of statuses) {
      const messageId = s?.id;
      const callbackData = resolveCallbackData(s);
      if (!messageId && !callbackData) continue;

      const status = String(s?.status || "").toLowerCase();
      const errors = s?.errors || [];
      const errorMessage =
        errors
          ?.map((e: any) => e?.title || e?.message || e?.details)
          .filter(Boolean)
          .join(" | ") || undefined;

      if (!["sent", "delivered", "read", "failed"].includes(status)) {
        continue;
      }

      const job =
        (messageId
          ? await ReportDispatchJob.findOne({
              providerMessageId: messageId,
            })
          : null) ||
        (callbackData
          ? await ReportDispatchJob.findOne({
              $or: [
                { activeAttemptKey: callbackData },
                { "deliveryAttempts.key": callbackData },
              ],
            })
          : null);

      if (!job) {
        continue;
      }

      const didApply = applyDeliveryWebhookUpdate(job, {
        attemptKey: callbackData || undefined,
        providerMessageId: messageId || undefined,
        deliveryStatus: status as "sent" | "delivered" | "read" | "failed",
        errorMessage,
        webhookAt: new Date(),
      });

      if (didApply) {
        await job.save();
        updated += 1;
      }
    }

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Webhook processing failed",
      },
      { status: 500 },
    );
  }
}
