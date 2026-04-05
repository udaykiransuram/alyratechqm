export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { subscribeStudentNotifications } from "@/lib/server/student-notifications-stream";

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;

  const studentId = auth.session.user.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, payload: unknown) => {
        if (isClosed) return;
        const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      sendEvent("connected", { ok: true });

      const unsubscribe = subscribeStudentNotifications(studentId, (event) => {
        sendEvent(event.event, event.payload);
      });

      const close = () => {
        if (isClosed) return;
        isClosed = true;
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
