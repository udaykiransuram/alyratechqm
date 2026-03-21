import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import ContactInfo from "@/models/ContactInfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const doc = await ContactInfo.findOne();
    return NextResponse.json({ success: true, data: doc || null });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load contact info." },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    const body = await req.json();

    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const whatsappNumber = String(body.whatsappNumber || "").trim();
    const address = String(body.address || "").trim();
    const city = String(body.city || "").trim();
    const tagline = String(body.tagline || "").trim();
    const responseTime = String(body.responseTime || "").trim();
    const responseDescription = String(body.responseDescription || "").trim();

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    const digits = (value: string) => value.replace(/\D+/g, "");

    if (!emailRe.test(email)) {
      return NextResponse.json({ success: false, error: "Invalid email address" }, { status: 400 });
    }
    if (digits(phone).length < 10) {
      return NextResponse.json({ success: false, error: "Invalid phone number" }, { status: 400 });
    }
    if (whatsappNumber && digits(whatsappNumber).length < 10) {
      return NextResponse.json({ success: false, error: "Invalid WhatsApp number" }, { status: 400 });
    }
    if (!address || !city || !tagline || !responseTime || !responseDescription) {
      return NextResponse.json({ success: false, error: "All fields are required except WhatsApp number" }, { status: 400 });
    }

    const updated = await ContactInfo.findOneAndUpdate(
      {},
      { email, phone, whatsappNumber, address, city, tagline, responseTime, responseDescription, updatedAt: new Date() },
      { upsert: true, new: true },
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to update contact info." },
      { status: 500 },
    );
  }
}
