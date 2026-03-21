import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import Registration from "@/models/Registration";

export const runtime = "nodejs";

function generateHallTicket(orderId: string) {
  const random = Math.floor(100 + Math.random() * 900);
  return `HT-2025-${orderId.slice(-6)}-${random}`;
}

async function sendWhatsAppCloudAPI(phone: string, message: string) {
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
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`WhatsApp API error: ${errorText}`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-webhook-signature");

    if (!signature) {
      return new NextResponse("Missing signature", { status: 400 });
    }

    const expected = crypto
      .createHmac("sha256", process.env.CASHFREE_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("base64");

    if (signature !== expected) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const payload = JSON.parse(rawBody) as {
      order_status?: string;
      order_id?: string;
    };

    if (payload.order_status === "PAID" && payload.order_id) {
      const orderId = payload.order_id;
      const hallTicket = generateHallTicket(orderId);

      await connectDB();
      const updated = await Registration.findOneAndUpdate(
        { orderId },
        { status: "paid", hallTicket },
        { new: true },
      );

      if (!updated) {
        return NextResponse.json(
          { status: "error", message: "Registration not found" },
          { status: 404 },
        );
      }

      let hallTicketWhatsappSent = false;
      if (process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TOKEN) {
        try {
          await sendWhatsAppCloudAPI(
            String(updated.phone || ""),
            `🎉 Registration successful!\nYour Hall Ticket: ${hallTicket}\nThank you for registering for the Talent Test.`,
          );
          hallTicketWhatsappSent = true;
        } catch (waError) {
          console.error("WhatsApp send error:", waError);
        }
      } else {
        console.warn("WhatsApp env not configured; skipping WhatsApp notification");
      }

      await Registration.updateOne(
        { orderId },
        { hallTicket, hallTicketWhatsappSent },
      );

      return NextResponse.json({ status: "success", hallTicket });
    }

    return NextResponse.json({ status: "ignored" });
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
