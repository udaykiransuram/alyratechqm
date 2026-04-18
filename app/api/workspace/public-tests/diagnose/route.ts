import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  diagnoseDiagnosticPaper,
  getWorkspacePublicTestsConfig,
} from "@/lib/server/workspace-public-tests";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin", "teacher"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const paperId = String(searchParams.get("paperId") || "").trim();
  const classBand = String(searchParams.get("classBand") || "").trim();

  if (!paperId || !classBand) {
    return NextResponse.json(
      { success: false, message: "paperId and classBand are required." },
      { status: 400 },
    );
  }

  const config = await getWorkspacePublicTestsConfig(auth.schoolKey);
  const mapping = config.classBandCards.find(
    (card) => card.classBand === classBand,
  );

  if (!mapping) {
    return NextResponse.json(
      { success: false, message: "Unknown class band." },
      { status: 404 },
    );
  }

  const diagnostic = await diagnoseDiagnosticPaper({
    paperId,
    expectedClassName: mapping.className,
  });

  return NextResponse.json({
    success: true,
    paperId,
    classBand,
    className: mapping.className,
    diagnostic,
  });
}
