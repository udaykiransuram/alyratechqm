import mongoose from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { getPublicSectionOptions } from "@/lib/server/public-registration-data";
import { getPublicSchoolOptionByKey } from "@/lib/server/public-school-data";
import {
  getPublicRegistrationScopeCookieName,
  verifyPublicRegistrationScopeValue,
} from "@/lib/security/registration-security";
import { isMockedE2ETestMode } from "@/lib/test-mode";

const PRIVATE_REGISTRATION_CACHE_CONTROL = "private, no-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const schoolKey = req.nextUrl.searchParams.get("school")?.trim() || "";
  const classId = req.nextUrl.searchParams.get("classId")?.trim() || "";

  if (!schoolKey) {
    return NextResponse.json(
      { success: false, message: "school required" },
      {
        status: 400,
        headers: {
          "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
        },
      },
    );
  }

  try {
    if (isMockedE2ETestMode()) {
      return NextResponse.json(
        {
          success: true,
          sections: [],
        },
        {
          headers: {
            "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
          },
        },
      );
    }

    const school = await getPublicSchoolOptionByKey(schoolKey);
    if (!school) {
      return NextResponse.json(
        { success: false, message: "Unknown school." },
        {
          status: 404,
          headers: {
            "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
          },
        },
      );
    }

    const scopeCookie = req.cookies
      .get(getPublicRegistrationScopeCookieName())
      ?.value;
    if (!verifyPublicRegistrationScopeValue(schoolKey, scopeCookie || "")) {
      return NextResponse.json(
        {
          success: false,
          message: "Registration scope expired. Reload classes.",
        },
        {
          status: 403,
          headers: {
            "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
          },
        },
      );
    }

    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      return NextResponse.json(
        { success: false, message: "valid classId required" },
        {
          status: 400,
          headers: {
            "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
          },
        },
      );
    }

    const sections = await getPublicSectionOptions(schoolKey, classId);

    return NextResponse.json(
      {
        success: true,
        sections,
      },
      {
        headers: {
          "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
        },
      },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load sections.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
        },
      },
    );
  }
}
