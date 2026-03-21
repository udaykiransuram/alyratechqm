import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import School from "@/models/School";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SchoolDoc = {
  key?: string;
  displayName?: string;
};

export async function GET() {
  try {
    await connectDB();

    const schools = (await School.find({})
      .sort({ displayName: 1 })
      .select("key displayName")
      .lean()) as SchoolDoc[];

    return NextResponse.json({
      success: true,
      schools: schools.map((school) => ({
        key: String(school.key || ""),
        displayName: String(school.displayName || ""),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load schools.",
      },
      { status: 500 },
    );
  }
}
