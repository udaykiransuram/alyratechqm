import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { getTenantModels } from "@/lib/db-tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SectionDoc = {
  _id: unknown;
  name?: string;
  class?: unknown;
};

export async function GET(req: NextRequest) {
  const schoolKey = req.nextUrl.searchParams.get("school")?.trim() || "";
  const classId = req.nextUrl.searchParams.get("classId")?.trim() || "";

  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "school required" },
      { status: 400 },
    );
  }

  if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
    return NextResponse.json(
      { success: false, message: "valid classId required" },
      { status: 400 },
    );
  }

  try {
    const { AcademicSection: AcademicSectionModel } = await getTenantModels(
      schoolKey,
      ["AcademicSection"],
    );
    const sections = (await AcademicSectionModel.find({
      class: classId,
      isActive: true,
      isArchived: { $ne: true },
    })
      .sort({ name: 1 })
      .select("name class")
      .lean()) as SectionDoc[];

    return NextResponse.json({
      success: true,
      sections: sections.map((section) => ({
        id: String(section._id),
        name: String(section.name || ""),
        classId: String(section.class || ""),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load sections.",
      },
      { status: 500 },
    );
  }
}
