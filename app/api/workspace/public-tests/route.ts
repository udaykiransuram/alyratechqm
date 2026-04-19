import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  getWorkspacePublicTestsConfig,
  updateWorkspacePublicTestsConfig,
} from "@/lib/server/workspace-public-tests";
import { SUMMER_CRASH_PUBLIC_CONFIG_CACHE_TAG } from "@/lib/server/summer-crash";
import { isSummerCrashSchoolKey } from "@/lib/summer-crash/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildNotFoundResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "Public tests are not available in this workspace.",
    },
    { status: 404 },
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  if (!isSummerCrashSchoolKey(auth.schoolKey)) {
    return buildNotFoundResponse();
  }

  try {
    const config = await getWorkspacePublicTestsConfig(auth.schoolKey);
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "We couldn't load summer public-test settings.",
      },
      { status: 400 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  if (!isSummerCrashSchoolKey(auth.schoolKey)) {
    return buildNotFoundResponse();
  }

  const body = await req.json().catch(() => ({}));

  try {
    const config = await updateWorkspacePublicTestsConfig({
      schoolKey: auth.schoolKey,
      title: String(body?.title || ""),
      supportContact: String(body?.supportContact || ""),
      isActive:
        typeof body?.isActive === "boolean" ? body.isActive : undefined,
      price:
        typeof body?.price === "number"
          ? body.price
          : typeof body?.price === "string" && body.price.trim() !== ""
            ? Number(body.price)
            : undefined,
      classMappings: Array.isArray(body?.classMappings)
        ? body.classMappings.map((mapping: Record<string, unknown>) => ({
            classBand: String(mapping?.classBand || ""),
            diagnosticQuestionPaperId:
              String(mapping?.diagnosticQuestionPaperId || "").trim() || null,
          }))
        : undefined,
    });
    revalidateTag(SUMMER_CRASH_PUBLIC_CONFIG_CACHE_TAG);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "We couldn't save summer public-test settings.",
      },
      { status: 400 },
    );
  }
}
