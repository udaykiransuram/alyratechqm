import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { listWorkspacePublicTestLeads } from "@/lib/server/workspace-public-tests";
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

  const page = Number.parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const classBand = req.nextUrl.searchParams.get("classBand") || "all";

  try {
    const leads = await listWorkspacePublicTestLeads({
      schoolKey: auth.schoolKey,
      page,
      classBand,
    });

    return NextResponse.json({
      success: true,
      leads,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "We couldn't load summer public-test leads.",
      },
      { status: 400 },
    );
  }
}
