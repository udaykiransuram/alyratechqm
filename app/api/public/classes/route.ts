import { NextRequest, NextResponse } from "next/server";

import { getTenantModels } from "@/lib/db-tenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ClassDoc = {
  _id: unknown;
  name?: string;
};

export async function GET(req: NextRequest) {
  const schoolKey = req.nextUrl.searchParams.get("school")?.trim() || "";

  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "school required" },
      { status: 400 },
    );
  }

  try {
    const { Class: ClassModel } = await getTenantModels(schoolKey, ["Class"]);
    const classes = (await ClassModel.find({ isArchived: { $ne: true } })
      .sort({ name: 1 })
      .select("name")
      .lean()) as ClassDoc[];

    return NextResponse.json({
      success: true,
      classes: classes.map((classItem) => ({
        id: String(classItem._id),
        name: String(classItem.name || ""),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load classes.",
      },
      { status: 500 },
    );
  }
}
