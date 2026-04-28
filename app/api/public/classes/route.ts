import { NextRequest, NextResponse } from "next/server";

import { getPublicClassOptions } from "@/lib/server/public-registration-data";
import { getPublicSchoolOptionByKey } from "@/lib/server/public-school-data";
import {
  buildPublicRegistrationScopeValue,
  getPublicRegistrationScopeCookieName,
} from "@/lib/security/registration-security";
import { isMockedE2ETestMode } from "@/lib/test-mode";

const PRIVATE_REGISTRATION_CACHE_CONTROL = "private, no-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const schoolKey = req.nextUrl.searchParams.get("school")?.trim() || "";

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
          classes: [],
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

    const classes = await getPublicClassOptions(schoolKey);
    const response = NextResponse.json(
      {
        success: true,
        classes,
      },
      {
        headers: {
          "Cache-Control": PRIVATE_REGISTRATION_CACHE_CONTROL,
        },
      },
    );
    response.cookies.set({
      name: getPublicRegistrationScopeCookieName(),
      value: buildPublicRegistrationScopeValue(schoolKey),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/public",
      maxAge: 15 * 60,
    });
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load classes.",
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
