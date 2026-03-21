import { NextResponse } from "next/server";

import { connectDB } from "@/lib/db";
import TalentTestConfig from "@/models/TalentTestConfig";

export async function GET() {
  try {
    await connectDB();
    const config = await TalentTestConfig.findOne({ isActive: true }).lean();

    const data =
      config || {
        name: "Precision Baseline Assessment",
        description:
          "Comprehensive diagnostic test to identify student strengths and areas for improvement",
        price: 100,
        currency: "INR",
        duration: "45 minutes",
        subjects: ["Mathematics", "Science", "English"],
        features: [
          "Detailed diagnostic report",
          "Personalized learning recommendations",
          "Subject-wise performance analysis",
          "Instant results delivery via email",
        ],
        isActive: true,
      };

    return NextResponse.json({ success: true, data });
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
