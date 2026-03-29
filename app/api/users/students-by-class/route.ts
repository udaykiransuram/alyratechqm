import { NextRequest, NextResponse } from "next/server";
import { requireTenantSession } from "@/lib/api-auth";
import { getStudentsByClassPageData } from "./data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["admin"],
  });
  if (!auth.ok) {
    return auth.response;
  }
  const schoolKey = auth.schoolKey;

  const url = new URL(req.url);

  try {
    const classId = url.searchParams.get("classId")?.trim() || "";
    const sectionId = url.searchParams.get("sectionId")?.trim() || "";
    const q = url.searchParams.get("q")?.trim() || "";
    const includeEmpty =
      (url.searchParams.get("includeEmpty") || "false") === "true";
    const limitParam = Number(url.searchParams.get("limit") || "8");
    const limit = Math.min(
      24,
      Math.max(Number.isFinite(limitParam) ? Math.floor(limitParam) : 8, 1),
    );
    const pageParam = Number(url.searchParams.get("page") || "1");

    const result = await getStudentsByClassPageData({
      schoolKey,
      query: {
        classId,
        sectionId,
        q,
        includeEmpty,
        limit,
        page: pageParam,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (typeof error?.status === "number" && error.status >= 400) {
      return NextResponse.json(
        { success: false, message: error.message || "Request failed" },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { success: false, message: error.message || "Server error" },
      { status: 500 },
    );
  }
}
