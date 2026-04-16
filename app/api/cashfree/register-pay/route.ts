import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import { getSiteUrlOrFallback } from "@/lib/site-url";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";
import {
  generateRegistrationLookupToken,
  hashRegistrationLookupToken,
  hashSensitiveRegistrationValue,
} from "@/lib/security/registration-security";
import {
  hashSensitiveScopeValue,
  withRequestBudget,
} from "@/lib/server/request-governor";
import Registration from "@/models/Registration";
import TalentTestConfig from "@/models/TalentTestConfig";

export const runtime = "nodejs";
const MAX_PENDING_REGISTRATIONS_PER_SCOPE = 3;
const PENDING_REGISTRATION_WINDOW_MS = 30 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
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

    const normalizedPhone = String(body.phone || "").trim();
    const normalizedSchoolKey = String(body.schoolKey || "")
      .trim()
      .toLowerCase();

    return withRequestBudget(
      {
        request: req,
        policy: "cashfreeRegisterPay",
        scopeId: `${normalizedSchoolKey}:${hashSensitiveScopeValue(normalizedPhone)}`,
        metadata: {
          schoolKey: normalizedSchoolKey,
        },
      },
      async () => {
        await connectDB();

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
        const open = config?.registrationsOpen
          ? new Date(config.registrationsOpen)
          : null;
        const deadline = config?.registrationDeadline
          ? new Date(config.registrationDeadline)
          : null;

        if (
          !config?.isActive ||
          !open ||
          !deadline ||
          now < open ||
          now > deadline
        ) {
          return NextResponse.json(
            { error: "Registration window is closed. Please try again later." },
            { status: 403 },
          );
        }

        const pendingSince = new Date(
          Date.now() - PENDING_REGISTRATION_WINDOW_MS,
        );
        const pendingRegistrations = await Registration.countDocuments({
          schoolKey: normalizedSchoolKey,
          phone: normalizedPhone,
          status: "pending",
          createdAt: { $gte: pendingSince },
        }).catch(() => 0);
        if (pendingRegistrations >= MAX_PENDING_REGISTRATIONS_PER_SCOPE) {
          return NextResponse.json(
            {
              error:
                "Too many pending payment attempts were created for this phone number. Please wait before trying again.",
            },
            { status: 429 },
          );
        }

        const amount = Number(config?.price ?? 100);
        const currency = String(config?.currency ?? "INR").toUpperCase();

        const registrationLookupToken = generateRegistrationLookupToken();
        const registrationLookupTokenHash =
          hashRegistrationLookupToken(registrationLookupToken);
        const normalizedAadhar = String(body.aadhar || "")
          .replace(/\s+/g, "")
          .trim();
        const aadharLast4 = normalizedAadhar.slice(-4);
        const aadharHash = hashSensitiveRegistrationValue(
          "aadhar",
          normalizedAadhar,
        );

        await Registration.create({
          studentName: String(body.studentName || "").trim(),
          guardianName: String(body.guardianName || "").trim(),
          phone: normalizedPhone,
          schoolKey: normalizedSchoolKey,
          schoolName: String(body.schoolName || "").trim(),
          classId: String(body.classId || "").trim(),
          classLevel: String(body.classLevel || "").trim(),
          sectionId: String(body.sectionId || "").trim(),
          sectionName: String(body.sectionName || "").trim(),
          aadharHash,
          aadharLast4,
          careerAspiration: String(body.careerAspiration || "").trim(),
          rollNumber: String(body.rollNumber || "").trim(),
          amount,
          currency,
          orderId,
          status: "pending",
          successLookupTokenHash: registrationLookupTokenHash,
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

        const siteUrl = getSiteUrlOrFallback(getTrustedInternalOrigin());
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
              customer_id: normalizedPhone,
              customer_phone: normalizedPhone,
            },
            order_meta: {
              return_url: `${siteUrl}/success/${orderId}?token=${encodeURIComponent(registrationLookupToken)}`,
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
      },
    );
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
