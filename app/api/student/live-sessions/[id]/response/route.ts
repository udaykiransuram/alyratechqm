export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import {
  assertSummerCrashStudentApiAccess,
} from "@/lib/server/summer-crash";
import {
  getLiveSessionErrorStatus,
  normalizeStudentLiveSessionResponseInput,
  submitStudentLiveSessionResponse,
} from "@/lib/server/live-sessions";
import { withRequestBudget } from "@/lib/server/request-governor";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_LIVE_SESSION_RESPONSE_BODY_BYTES = 64 * 1024;

async function readBoundedJsonBody(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_LIVE_SESSION_RESPONSE_BODY_BYTES
  ) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Live response is too large. Shorten the answer and try again.",
        },
        { status: 413 },
      ),
    };
  }

  const rawBody = await req.text().catch(() => "");
  if (rawBody.length > MAX_LIVE_SESSION_RESPONSE_BODY_BYTES) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Live response is too large. Shorten the answer and try again.",
        },
        { status: 413 },
      ),
    };
  }

  if (!rawBody.trim()) {
    return {
      ok: true as const,
      body: {} as Record<string, unknown> & { itemId?: string },
    };
  }

  try {
    return {
      ok: true as const,
      body: JSON.parse(rawBody) as Record<string, unknown> & { itemId?: string },
    };
  } catch {
    return {
      ok: true as const,
      body: {} as Record<string, unknown> & { itemId?: string },
    };
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireTenantSession(req, {
    allowRoles: ["student"],
  });
  if (!auth.ok) {
    return auth.response;
  }

  const studentId = String(auth.session.user.id || "").trim();
  const accessCheck = await assertSummerCrashStudentApiAccess({
    schoolKey: auth.schoolKey,
    studentId,
    target: {
      kind: "locked-student-content",
    },
  });
  if (!accessCheck.allowed) {
    return NextResponse.json(
      { success: false, message: accessCheck.message },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    return withRequestBudget(
      {
        request: req,
        policy: "liveSessionResponse",
        schoolKey: auth.schoolKey,
        userId: studentId,
        metadata: {
          liveSessionId: id,
        },
      },
      async () => {
        const parsedBody = await readBoundedJsonBody(req);
        if (!parsedBody.ok) {
          return parsedBody.response;
        }
        const body = parsedBody.body;
        const liveSession = await submitStudentLiveSessionResponse({
          schoolKey: auth.schoolKey,
          studentId,
          studentPlacement: {
            classId: auth.session.user.studentClassId,
            academicSectionId: auth.session.user.studentAcademicSectionId,
          },
          liveSessionId: id,
          itemId: String(body?.itemId || "").trim(),
          input: normalizeStudentLiveSessionResponseInput(body),
        });

        if (!liveSession) {
          return NextResponse.json(
            { success: false, message: "Live class or live item not found." },
            { status: 404 },
          );
        }

        return NextResponse.json({
          success: true,
          liveSession,
        });
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to submit the live response.",
      },
      { status: getLiveSessionErrorStatus(error) },
    );
  }
}
