"use client";

import { Layers } from "lucide-react";
import { usePathname } from "next/navigation";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { performNextAuthSignOutAndRedirect } from "@/lib/client/next-auth-client";

function isTestsRoute(pathname: string) {
  return pathname === "/student/tests" || pathname.startsWith("/student/tests/");
}

function isAccountRoute(pathname: string) {
  return pathname === "/student/account" || pathname.startsWith("/student/account/");
}

export default function StudentHeader() {
  const pathname = usePathname() || "/student/tests";

  async function handleSignOut() {
    const targetUrl = new URL("/auth/signin", window.location.origin);
    targetUrl.searchParams.set("signedOut", "1");
    await performNextAuthSignOutAndRedirect({
      callbackUrl: targetUrl.toString(),
    });
  }

  return (
    <header className="app-nav-shell fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] border-b">
      <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-5">
        <AppPrefetchLink
          href="/student/tests"
          className="app-nav-brand flex min-w-0 items-center gap-3 px-2 py-1.5"
        >
          <div className="app-nav-logo flex h-10 w-10 items-center justify-center rounded-[var(--app-radius-md)]">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="app-nav-text text-[14px] font-semibold tracking-[0.01em]">
              Alyra Tech
            </p>
          </div>
        </AppPrefetchLink>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant={isTestsRoute(pathname) ? "default" : "outline"}
            size="sm"
            className="hidden sm:inline-flex app-button-compact"
          >
            <AppPrefetchLink href="/student/tests">Tests</AppPrefetchLink>
          </Button>
          <Button
            asChild
            variant={isAccountRoute(pathname) ? "default" : "outline"}
            size="sm"
            className="hidden sm:inline-flex app-button-compact"
          >
            <AppPrefetchLink href="/student/account">Account</AppPrefetchLink>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="app-button-compact"
            onClick={() => void handleSignOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
