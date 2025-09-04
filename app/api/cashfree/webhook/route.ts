import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Registration from '@/models/Registration';
import crypto from 'crypto';

function generateHallTicket(orderId: string) {
  // Example: HT-2025-<last 6 of orderId>-<random 3 digits>
  const random = Math.floor(100 + Math.random() * 900);
  return `HT-2025-${orderId.slice(-6)}-${random}`;
}

// Send WhatsApp message via Cloud API
async function sendWhatsAppCloudAPI(phone: string, message: string) {
  const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: `91${phone}`, // Assumes Indian numbers; adjust as needed
    type: 'text',
    text: { body: message },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
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
    const signature = req.headers.get('x-webhook-signature');
    if (!signature) {
      return new NextResponse('Missing signature', { status: 400 });
    }

    const expected = crypto
      .createHmac('sha256', process.env.CASHFREE_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest('base64');

    if (signature !== expected) {
      return new NextResponse('Invalid signature', { status: 403 });
    }

    const payload = JSON.parse(rawBody);

    // Only process successful payments
    if (payload.order_status === 'PAID') {
      const orderId = payload.order_id;
      const hallTicket = generateHallTicket(orderId);

      await connectDB();
      const updated = await Registration.findOneAndUpdate(
        { orderId },
        { status: 'paid', hallTicket },
        { new: true }
      );

      if (!updated) {
        return NextResponse.json(
          { status: 'error', message: 'Registration not found' },
          { status: 404 }
        );
      }

      // Send WhatsApp message via Cloud API
      let hallTicketWhatsappSent = false;
      try {
        await sendWhatsAppCloudAPI(
          updated.phone,
          `🎉 Registration successful!\nYour Hall Ticket: ${hallTicket}\nThank you for registering for the Talent Test.`
        );
        hallTicketWhatsappSent = true;
      } catch (waErr) {
        console.error('WhatsApp send error:', waErr);
      }

      await Registration.updateOne(
        { orderId },
        { hallTicket, hallTicketWhatsappSent }
      );

      return NextResponse.json({ status: 'success', hallTicket });
    }

    // Ignore other statuses
    return NextResponse.json({ status: 'ignored' });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}