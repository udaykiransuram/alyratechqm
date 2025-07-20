import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import Registration from '@/models/Registration';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-webhook-signature')!;
  const expected = crypto
    .createHmac('sha256', process.env.CASHFREE_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('base64');

  if (signature !== expected) {
    return new NextResponse('Invalid signature', { status: 403 });
  }

  const payload = JSON.parse(rawBody);
  console.log('Webhook:', payload);

  if (payload.order_status === 'PAID') {
    await connectDB();
    await Registration.findOneAndUpdate(
      { orderId: payload.order_id },
      { status: 'paid' }
    );
  }

  return NextResponse.json({ received: true });
}