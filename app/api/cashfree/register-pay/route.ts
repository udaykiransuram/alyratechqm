import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const orderId = `talent_${Date.now()}`;

  const res = await fetch('https://sandbox.cashfree.com/pg/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': '2022-09-01',
      'x-client-id': process.env.CASHFREE_APP_ID!,
      'x-client-secret': process.env.CASHFREE_SECRET_KEY!,
    },
    body: JSON.stringify({
      order_id: orderId,
      order_amount: 100,
      order_currency: 'INR',
      customer_details: {
        customer_id: body.phone,
        customer_email: body.email,
        customer_phone: body.phone,
      },
      order_meta: {
        return_url: `${process.env.NEXTAUTH_URL}/success/${orderId}`,
      },
    }),
  });

  const data = await res.json();

  if (!data.payment_session_id) {
    return NextResponse.json({ error: 'Session ID not received' }, { status: 500 });
  }

  return NextResponse.json({ payment_session_id: data.payment_session_id });
}
