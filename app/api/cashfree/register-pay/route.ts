import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSiteUrlOrFallback } from "@/lib/site-url";
import Registration from "@/models/Registration";
import TalentTestConfig from "@/models/TalentTestConfig";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();

    const requiredFields = [
      "studentName",
      "guardianName",
      "phone",
      "schoolKey",
      "schoolName",
      "classId",
      "classLevel",
      "sectionId",
      "sectionName",
      "aadhar",
      "careerAspiration",
      "rollNumber",
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 },
        );
      }
    }


    if (!/^[0-9]{10}$/.test(body.phone)) {
      return NextResponse.json(
        { error: "Invalid phone number format." },
        { status: 400 },
      );
    }

    if (!/^\d{12}$/.test(String(body.aadhar).replace(/\s+/g, ""))) {
      return NextResponse.json(
        { error: "Invalid Aadhar number format." },
        { status: 400 },
      );
    }

    const shortRandom = Math.random().toString(36).substring(2, 10);
    const orderId = `talent_${Date.now()}_${shortRandom}`;

    type LeanConfig = {
      price?: number;
      currency?: string;
      isActive?: boolean;
      registrationsOpen?: Date;
      registrationDeadline?: Date;
    };

    const config = await TalentTestConfig.findOne().lean<LeanConfig>();
    const now = new Date();
    const open = config?.registrationsOpen ? new Date(config.registrationsOpen) : null;
    const deadline = config?.registrationDeadline ? new Date(config.registrationDeadline) : null;

    if (!config?.isActive || !open || !deadline || now < open || now > deadline) {
      return NextResponse.json(
        { error: "Registration window is closed. Please try again later." },
        { status: 403 },
      );
    }

    const amount = Number(config?.price ?? 100);
    const currency = String(config?.currency ?? "INR").toUpperCase();

    await Registration.create({
      studentName: body.studentName,
      guardianName: body.guardianName,
      phone: body.phone,
      schoolKey: body.schoolKey,
      schoolName: body.schoolName,
      classId: body.classId,
      classLevel: body.classLevel,
      sectionId: body.sectionId,
      sectionName: body.sectionName,
      aadhar: body.aadhar,
      careerAspiration: body.careerAspiration,
      rollNumber: body.rollNumber,
      amount,
      currency,
      orderId,
      status: "pending",
    });

    const cashfreeEnv = (
      process.env.CASHFREE_ENV ||
      process.env.NEXT_PUBLIC_CASHFREE_ENV ||
      "sandbox"
    ).toLowerCase();
    const cashfreeBaseUrl =
      process.env.CASHFREE_BASE_URL ||
      (cashfreeEnv === "production"
        ? "https://api.cashfree.com"
        : "https://sandbox.cashfree.com");

    const res = await fetch(`${cashfreeBaseUrl}/pg/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2022-09-01",
        "x-client-id": process.env.CASHFREE_APP_ID!,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: currency,
        customer_details: {
          customer_id: body.phone,
          customer_phone: body.phone,
        },
        order_meta: {
          return_url: `${getSiteUrlOrFallback(req.nextUrl.origin)}/success/${orderId}`,
          studentName: body.studentName,
          guardianName: body.guardianName,
              schoolName: body.schoolName,
          classLevel: body.classLevel,
          sectionName: body.sectionName,
          aadhar: body.aadhar,
          careerAspiration: body.careerAspiration,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Cashfree API error:", errorText);
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();

    if (!data.payment_session_id) {
      return NextResponse.json(
        { error: "Session ID not received" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      payment_session_id: data.payment_session_id,
      orderId,
    });
  } catch (error: unknown) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
