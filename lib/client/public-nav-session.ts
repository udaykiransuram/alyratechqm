"use client";

import { useEffect, useState } from "react";

import type { AccountType, AppRole } from "@/lib/auth-types";
import { getDefaultRouteForRole } from "@/lib/auth-types";

type PublicSessionUser = {
  accountType?: AccountType;
  role?: AppRole;
};

type PublicSessionResponse = {
  user?: PublicSessionUser | null;
} | null;

type PublicNavSessionState = {
  signedIn: boolean;
  portalHref: string;
  portalLabel: string;
};

function resolvePortalLabel(accountType: AccountType, role: AppRole) {
  if (accountType === "company_admin" || role === "company_admin") {
    return "Open Company Portal";
  }

  if (role === "student") {
    return "Open Student Portal";
  }

  return "Open Workspace";
}

function normalizeSessionState(
  session: PublicSessionResponse,
): PublicNavSessionState {
  const accountType = session?.user?.accountType;
  const role = session?.user?.role;

  if (
    !accountType ||
    !role ||
    (accountType !== "company_admin" && accountType !== "school_user")
  ) {
    return {
      signedIn: false,
      portalHref: "/auth/signin",
      portalLabel: "Open Workspace",
    };
  }

  return {
    signedIn: true,
    portalHref: getDefaultRouteForRole(role),
    portalLabel: resolvePortalLabel(accountType, role),
  };
}

export function usePublicNavSession() {
  const [state, setState] = useState<PublicNavSessionState>({
    signedIn: false,
    portalHref: "/auth/signin",
    portalLabel: "Open Workspace",
  });

  useEffect(() => {
    const controller = new AbortController();

    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          setState({
            signedIn: false,
            portalHref: "/auth/signin",
            portalLabel: "Open Workspace",
          });
          return;
        }

        const session = (await response.json()) as PublicSessionResponse;
        setState(normalizeSessionState(session));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          signedIn: false,
          portalHref: "/auth/signin",
          portalLabel: "Open Workspace",
        });
      }
    };

    void loadSession();

    return () => controller.abort();
  }, []);

  return state;
}
