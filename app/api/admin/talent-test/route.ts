import { NextRequest, NextResponse } from "next/server";

import { requireCompanyAdminSession } from "@/lib/api-auth";
import { connectDB } from "@/lib/db";
import TalentTestConfig from "@/models/TalentTestConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireCompanyAdminSession(req);
  if (!auth.ok) return auth.response;

  try {
    await connectDB();
    let config = await TalentTestConfig.findOne();

    if (!config) {
      config = await TalentTestConfig.create({});
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load config.",
      },
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

    let config = await TalentTestConfig.findOne();

    if (!config) {
      config = await TalentTestConfig.create(body);
    } else {
      config = await TalentTestConfig.findOneAndUpdate({}, body, {
        new: true,
        runValidators: true,
      });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update config.",
      },
      { status: 500 },
    );
  }
}
