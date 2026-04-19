import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import { getSiteUrlOrFallback } from "@/lib/site-url";
import { getTrustedInternalOrigin } from "@/lib/security/internal-origin";
import {
  generateRegistrationLookupToken,
  hashRegistrationLookupToken,
} from "@/lib/security/registration-security";
import {
  hashSensitiveScopeValue,
  withRequestBudget,
} from "@/lib/server/request-governor";
import {
  getSummerCrashCampaignForPayment,
  getSummerCrashCourseAccessForStudent,
} from "@/lib/server/summer-crash";
import { isSummerCrashSchoolKey } from "@/lib/summer-crash/constants";
import {
  normalizeSummerCrashClassBandKey,
  normalizeSummerCrashNameKey,
  normalizeSummerCrashPhone,
  normalizeSummerCrashText,
} from "@/lib/summer-crash/shared";
import SummerCrashPayment from "@/models/SummerCrashPayment";

export const runtime = "nodejs";

const MAX_PENDING_PAYMENTS_PER_SCOPE = 3;
const PENDING_PAYMENT_WINDOW_MS = 30 * 60 * 1000;
const CASHFREE_ORDER_FETCH_TIMEOUT_MS = 12_000;

type SummerCrashPaymentRequestContext = {
  scopeId: string;
  campaignId: string;
  summerSchoolKey: string;
  studentName: string;
  studentNameNormalized?: string;
  guardianName: string;
  phoneDigits: string;
  classBand: string;
  classBandNormalized: string;
  sourceSchoolName?: string;
  price: number;
  currency: string;
  enrollmentId?: string;
  summerId?: string;
};

async function resolveSummerCrashPaymentRequestContext(params: {
  auth:
    | Awaited<ReturnType<typeof requireTenantSession>>
    | { ok: false; response: NextResponse };
  body: Record<string, unknown>;
}) {
  const auth = params.auth;

  if (auth.ok) {
    const schoolKey = String(auth.schoolKey || "").trim();

    if (!schoolKey) {
      return NextResponse.json(
        { error: "Authenticated session is missing school context." },
        { status: 403 },
      );
    }

    if (!isSummerCrashSchoolKey(schoolKey)) {
      return NextResponse.json(
        { error: "This payment route is only available for Summer Crash Course students." },
        { status: 403 },
      );
    }

    const { campaign, enrollment, courseAccess } =
      await getSummerCrashCourseAccessForStudent({
        schoolKey,
        studentId: auth.session.user.id,
      });

    if (!campaign.isActive) {
      return NextResponse.json(
        { error: "Summer Crash Course registrations are closed." },
        { status: 403 },
      );
    }

    if (!courseAccess.requiresPayment) {
      return NextResponse.json(
        { error: "Payment is not configured for this course." },
        { status: 400 },
      );
    }

    if (courseAccess.isUnlocked) {
      return NextResponse.json(
        { error: "Summer Crash Course lessons are already unlocked for this student." },
        { status: 409 },
      );
    }

    if (!enrollment?._id) {
      return NextResponse.json(
        { error: "We couldn't find the Summer Crash Course enrollment for this student." },
        { status: 404 },
      );
    }

    const studentName = normalizeSummerCrashText(enrollment.studentName);
    const guardianName = normalizeSummerCrashText(enrollment.guardianName);
    const phoneDigits = normalizeSummerCrashPhone(
      enrollment.phoneDigits || enrollment.phone,
    );
    const classBand = normalizeSummerCrashText(enrollment.classBand);

    if (!studentName || !guardianName || phoneDigits.length < 10 || !classBand) {
      return NextResponse.json(
        { error: "The Summer Crash Course enrollment is missing payment details." },
        { status: 400 },
      );
    }

    return {
      scopeId: `summer-crash-pay-user:${hashSensitiveScopeValue(auth.session.user.id)}`,
      campaignId: String(campaign._id),
      summerSchoolKey: String(campaign.summerSchoolKey || schoolKey).trim(),
      studentName,
      studentNameNormalized: normalizeSummerCrashNameKey(studentName),
      guardianName,
      phoneDigits,
      classBand,
      classBandNormalized: normalizeSummerCrashClassBandKey(classBand),
      sourceSchoolName: normalizeSummerCrashText(enrollment.sourceSchoolName) || undefined,
      price: courseAccess.price,
      currency: courseAccess.currency,
      enrollmentId: String(enrollment._id),
      summerId: String(enrollment.summerId || "").trim().toUpperCase() || undefined,
    } satisfies SummerCrashPaymentRequestContext;
  }

  const studentName = normalizeSummerCrashText(params.body?.studentName);
  const guardianName = normalizeSummerCrashText(params.body?.guardianName);
  const phoneDigits = normalizeSummerCrashPhone(params.body?.phone);
  const classBand = normalizeSummerCrashText(params.body?.classBand);
  const sourceSchoolName = normalizeSummerCrashText(params.body?.sourceSchoolName);

  if (!studentName) {
    return NextResponse.json(
      { error: "Student name is required." },
      { status: 400 },
    );
  }

  if (!guardianName) {
    return NextResponse.json(
      { error: "Parent/guardian name is required." },
      { status: 400 },
    );
  }

  if (phoneDigits.length < 10) {
    return NextResponse.json(
      { error: "Enter a valid WhatsApp number." },
      { status: 400 },
    );
  }

  if (!classBand) {
    return NextResponse.json(
      { error: "Choose a class band to continue." },
      { status: 400 },
    );
  }

  const { campaign, classBands, price, currency } =
    await getSummerCrashCampaignForPayment();

  if (!campaign.isActive) {
    return NextResponse.json(
      { error: "Summer Crash Course registrations are closed." },
      { status: 403 },
    );
  }

  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json(
      { error: "Payment is not configured for this course." },
      { status: 400 },
    );
  }

  const classBandNormalized = normalizeSummerCrashClassBandKey(classBand);
  const classBandMatch = classBands.find(
    (option) =>
      normalizeSummerCrashClassBandKey(option.classBand) === classBandNormalized,
  );

  if (!classBandMatch) {
    return NextResponse.json(
      { error: "This class band is not available." },
      { status: 400 },
    );
  }

  return {
    scopeId: phoneDigits
      ? `summer-crash-pay:${hashSensitiveScopeValue(phoneDigits)}`
      : "summer-crash-pay:anonymous",
    campaignId: String(campaign._id),
    summerSchoolKey: String(campaign.summerSchoolKey || "").trim(),
    studentName,
    studentNameNormalized: normalizeSummerCrashNameKey(studentName),
    guardianName,
    phoneDigits,
    classBand,
    classBandNormalized,
    sourceSchoolName: sourceSchoolName || undefined,
    price,
    currency,
  } satisfies SummerCrashPaymentRequestContext;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const phoneDigits = normalizeSummerCrashPhone(body?.phone);

    const auth = await requireTenantSession(req, {
      allowRoles: ["student"],
    });
    const scopeId = auth.ok
      ? `summer-crash-pay-user:${hashSensitiveScopeValue(auth.session.user.id)}`
      : phoneDigits
        ? `summer-crash-pay:${hashSensitiveScopeValue(
            phoneDigits,
          )}`
        : "summer-crash-pay:anonymous";

    return withRequestBudget(
      {
        request: req,
        policy: "summerCrashPay",
        scopeId,
      },
      async () => {
        await connectDB();

        const context = await resolveSummerCrashPaymentRequestContext({
          auth,
          body,
        });

        if (context instanceof NextResponse) {
          return context;
        }

        const pendingSince = new Date(Date.now() - PENDING_PAYMENT_WINDOW_MS);
        const pendingCount = await SummerCrashPayment.countDocuments({
          campaignId: context.campaignId,
          phoneDigits: context.phoneDigits,
          status: "pending",
          createdAt: { $gte: pendingSince },
        }).catch(() => 0);

        if (pendingCount >= MAX_PENDING_PAYMENTS_PER_SCOPE) {
          return NextResponse.json(
            {
              error:
                "Too many pending payment attempts were created for this number. Please wait a few minutes and try again.",
            },
            { status: 429 },
          );
        }

        const shortRandom = Math.random().toString(36).substring(2, 10);
        const orderId = `summer_${Date.now()}_${shortRandom}`;

        const registrationLookupToken = generateRegistrationLookupToken();
        const registrationLookupTokenHash =
          hashRegistrationLookupToken(registrationLookupToken);

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
        const returnUrl = `${siteUrl}/summer-crash-course/payment/${orderId}?token=${encodeURIComponent(
          registrationLookupToken,
        )}`;

        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
          timeoutController.abort();
        }, CASHFREE_ORDER_FETCH_TIMEOUT_MS);

        let res: Response;
        try {
          res = await fetch(`${cashfreeBaseUrl}/pg/orders`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-version": "2022-09-01",
              "x-client-id": process.env.CASHFREE_APP_ID!,
              "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
            },
            body: JSON.stringify({
              order_id: orderId,
              order_amount: context.price,
              order_currency: context.currency,
              customer_details: {
                customer_id: context.phoneDigits,
                customer_phone: context.phoneDigits,
              },
              order_meta: {
                return_url: returnUrl,
                notify_url: `${siteUrl}/api/cashfree/webhook`,
              },
            }),
            signal: timeoutController.signal,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            (error.name === "AbortError" ||
              timeoutController.signal.aborted)
          ) {
            return NextResponse.json(
              {
                error:
                  "Payment provider timeout. Please retry in a moment.",
              },
              { status: 504 },
            );
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Cashfree API error:", errorText);
          return NextResponse.json({ error: errorText }, { status: res.status });
        }

        const data = await res.json();

        if (!data.payment_session_id) {
          return NextResponse.json(
            { error: "Payment session not received." },
            { status: 500 },
          );
        }

        await SummerCrashPayment.create({
          campaignId: context.campaignId,
          summerSchoolKey: context.summerSchoolKey,
          orderId,
          studentName: context.studentName,
          studentNameNormalized: context.studentNameNormalized,
          guardianName: context.guardianName,
          phone: context.phoneDigits,
          phoneDigits: context.phoneDigits,
          classBand: context.classBand,
          classBandNormalized: context.classBandNormalized,
          sourceSchoolName: context.sourceSchoolName || undefined,
          amount: context.price,
          currency: context.currency,
          status: "pending",
          successLookupTokenHash: registrationLookupTokenHash,
          enrollmentId: context.enrollmentId || null,
          summerId: context.summerId,
        });

        return NextResponse.json({
          payment_session_id: data.payment_session_id,
          orderId,
        });
      },
    );
  } catch (error) {
    console.error("Summer crash payment error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
