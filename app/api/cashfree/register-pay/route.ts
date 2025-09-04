import { NextRequest, NextResponse } from 'next/server';
import Registration from '@/models/Registration';
import { connectDB } from '@/lib/db';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const RATE_LIMIT = 10; // max requests per 10 minutes per IP
const WINDOW = 10 * 60; // 10 minutes in seconds

export async function POST(req: NextRequest) {
  try {
    // Get IP address (works for most deployments, adjust as needed)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const key = `ratelimit:register:${ip}`;

    // Distributed rate limiting with fail-open for resilience
    let count = 0;
    try {
      count = await redis.incr(key);
      if (count === 1) await redis.expire(key, WINDOW);
      if (count > RATE_LIMIT) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          { status: 429 }
        );
      }
    } catch (err) {
      // Log the error, but allow registration to proceed (fail open)
      console.error('Redis rate limit error:', err);
      // Optionally, notify admin/monitoring here
    }

    await connectDB();

    const body = await req.json();

    // Validate required fields
    const requiredFields = [
      'studentName',
      'guardianName',
      'phone',
      'classLevel',
      'aadhar',
      'careerAspiration'
    ];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate phone and aadhar format
    if (!/^[0-9]{10}$/.test(body.phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format.' },
        { status: 400 }
      );
    }
    if (!/^\d{12}$/.test(body.aadhar.replace(/\s+/g, ''))) {
      return NextResponse.json(
        { error: 'Invalid Aadhar number format.' },
        { status: 400 }
      );
    }

    const shortRandom = Math.random().toString(36).substring(2, 10);
    const orderId = `talent_${Date.now()}_${shortRandom}`;

    // Store registration as pending
    await Registration.create({
      studentName: body.studentName,
      guardianName: body.guardianName,
      phone: body.phone,
      classLevel: body.classLevel,
      aadhar: body.aadhar,
      careerAspiration: body.careerAspiration,
      orderId,
      status: 'pending',
    });

    // Call Cashfree API
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
          customer_phone: body.phone,
        },
        order_meta: {
          return_url: `${process.env.NEXTAUTH_URL}/success/${orderId}`,
          studentName: body.studentName,
          guardianName: body.guardianName,
          classLevel: body.classLevel,
          aadhar: body.aadhar,
          careerAspiration: body.careerAspiration,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Cashfree API error:', errorText);
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();

    if (!data.payment_session_id) {
      return NextResponse.json({ error: 'Session ID not received' }, { status: 500 });
    }

    return NextResponse.json({ payment_session_id: data.payment_session_id, orderId });
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
