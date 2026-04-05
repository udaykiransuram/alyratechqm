export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest } from "next/server";

import { requireTenantSession } from "@/lib/api-auth";
import { readStudentNotificationSignalVersion } from "@/lib/redis";
import { subscribeStudentNotifications } from "@/lib/server/student-notifications-stream";

const STUDENT_NOTIFICATION_STREAM_HEARTBEAT_MS = 15_000;
const STUDENT_NOTIFICATION_STREAM_POLL_MS = 4_000;

export async function GET(req: NextRequest) {
  const auth = await requireTenantSession(req, { allowRoles: ["student"] });
  if (!auth.ok) return auth.response;

  const schoolKey = auth.schoolKey;
  const studentId = auth.session.user.id;
  const initialSignalVersion =
    (await readStudentNotificationSignalVersion(schoolKey, studentId).catch(
      () => null,
    )) ?? 0;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;
      let isPollingSignal = false;
      let lastSignalVersion = initialSignalVersion;

      const sendEvent = (event: string, payload: unknown) => {
        if (isClosed) return;
        const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(data));
      };

      sendEvent("connected", {
        ok: true,
        signalVersion: lastSignalVersion,
      });

      const unsubscribe = subscribeStudentNotifications(
        schoolKey,
        studentId,
        (event) => {
          if (
            typeof event.payload.signalVersion === "number" &&
            Number.isFinite(event.payload.signalVersion) &&
            event.payload.signalVersion > lastSignalVersion
          ) {
            lastSignalVersion = event.payload.signalVersion;
          }

          sendEvent(event.event, event.payload);
        },
      );

      const heartbeatInterval = setInterval(() => {
        sendEvent("ping", { ts: Date.now() });
      }, STUDENT_NOTIFICATION_STREAM_HEARTBEAT_MS);

      const signalPollInterval = setInterval(() => {
        if (isClosed || isPollingSignal) {
          return;
        }

        isPollingSignal = true;

        void readStudentNotificationSignalVersion(schoolKey, studentId)
          .then((nextSignalVersion) => {
            if (
              isClosed ||
              !Number.isFinite(nextSignalVersion as number) ||
              nextSignalVersion == null ||
              nextSignalVersion <= lastSignalVersion
            ) {
              return;
            }

            lastSignalVersion = Number(nextSignalVersion);
            sendEvent("notification.created", {
              id: "sync",
              type: "sync",
              signalVersion: lastSignalVersion,
            });
          })
          .catch(() => undefined)
          .finally(() => {
            isPollingSignal = false;
          });
      }, STUDENT_NOTIFICATION_STREAM_POLL_MS);

      const close = () => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatInterval);
        clearInterval(signalPollInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", close, { once: true });
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
