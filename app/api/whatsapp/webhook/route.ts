import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ReportDispatchJob from "@/models/ReportDispatchJob";

export const dynamic = 'force-dynamic';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

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
    const body = await req.json();
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
      if (!messageId) continue;

      const status = String(s?.status || "").toLowerCase();
      const errors = s?.errors || [];
      const errorMessage =
        errors
          ?.map((e: any) => e?.title || e?.message || e?.details)
          .filter(Boolean)
          .join(" | ") || undefined;

      const update: any = {
        lastWebhookAt: new Date(),
      };

      if (status === "sent") update.deliveryStatus = "sent";
      if (status === "delivered") {
        update.deliveryStatus = "delivered";
        update.deliveredAt = new Date();
      }
      if (status === "read") {
        update.deliveryStatus = "read";
        update.readAt = new Date();
      }
      if (status === "failed") {
        update.deliveryStatus = "failed";
        update.deliveryError = errorMessage || "WhatsApp delivery failed";
      }

      const res = await ReportDispatchJob.updateOne(
        { providerMessageId: messageId },
        { $set: update },
      );
      if (res.modifiedCount > 0) updated += 1;
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
