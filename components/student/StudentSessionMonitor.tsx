"use client";

import { useEffect, useRef } from "react";

import { performNextAuthSignOutAndRedirect } from "@/lib/client/next-auth-client";
import { STUDENT_SESSION_HEARTBEAT_INTERVAL_MS } from "@/lib/student-session";
import { isMockedE2ETestMode } from "@/lib/test-mode";

const studentHeartbeatDisabled = isMockedE2ETestMode();

function buildStudentSessionExpiredCallbackUrl() {
  if (typeof window === "undefined") {
    return "/auth/signin?error=StudentSessionExpired&signedOut=1";
  }

  const signInUrl = new URL("/auth/signin", window.location.origin);
  signInUrl.searchParams.set("error", "StudentSessionExpired");
  signInUrl.searchParams.set("signedOut", "1");
  signInUrl.searchParams.set("callbackUrl", window.location.href);
  return signInUrl.toString();
}

export default function StudentSessionMonitor() {
  const isSigningOutRef = useRef(false);

  useEffect(() => {
    if (studentHeartbeatDisabled) {
      return;
    }

    let disposed = false;

    async function pingStudentSession() {
      if (disposed || isSigningOutRef.current) {
        return;
      }

      try {
        const response = await fetch("/api/student/session/heartbeat", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
        });

        if (response.ok || disposed || isSigningOutRef.current) {
          return;
        }

        if (response.status === 401 || response.status === 403) {
          isSigningOutRef.current = true;
          const callbackUrl = buildStudentSessionExpiredCallbackUrl();
          await performNextAuthSignOutAndRedirect({
            callbackUrl,
          });
        }
      } catch {
      }
    }

    void pingStudentSession();

    const interval = window.setInterval(() => {
      void pingStudentSession();
    }, STUDENT_SESSION_HEARTBEAT_INTERVAL_MS);

    const handleFocus = () => {
      void pingStudentSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pingStudentSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
