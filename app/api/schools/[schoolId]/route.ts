import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { getTenantDb } from "@/lib/db-tenant";
import School from "@/models/School";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { schoolId: string } },
) {
  await connectDB();

  if (!isValidObjectId(params.schoolId)) {
    return NextResponse.json(
      { success: false, message: "Invalid school id." },
      { status: 400 },
    );
  }

  try {
    const school = await School.findById(params.schoolId);
    if (!school) {
      return NextResponse.json(
        { success: false, message: "School not found." },
        { status: 404 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const displayName = String(body?.displayName || "").trim();
    const nextKey = String(body?.key || school.key).trim().toLowerCase();

    if (!displayName) {
      return NextResponse.json(
        { success: false, message: "Display name is required." },
        { status: 400 },
      );
    }

    if (nextKey !== school.key) {
      return NextResponse.json(
        {
          success: false,
          message:
            "School key cannot be changed after creation. Create a new school if you need a different key.",
        },
        { status: 400 },
      );
    }

    school.displayName = displayName;
    await school.save();

    return NextResponse.json({ success: true, school });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to update school.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { schoolId: string } },
) {
  await connectDB();

  if (!isValidObjectId(params.schoolId)) {
    return NextResponse.json(
      { success: false, message: "Invalid school id." },
      { status: 400 },
    );
  }

  try {
    const school = await School.findById(params.schoolId);
    if (!school) {
      return NextResponse.json(
        { success: false, message: "School not found." },
        { status: 404 },
      );
    }

    try {
      const tenantDb = await getTenantDb(school.key);
      await tenantDb.dropDatabase().catch(() => undefined);
    } catch {
    }

    await school.deleteOne();

    return NextResponse.json({
      success: true,
      deletedSchoolKey: school.key,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Failed to delete school.",
      },
      { status: 500 },
    );
  }
}
