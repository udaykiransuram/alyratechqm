"use client";

import { Building2, Layers, School, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";

export default function AuthHeader() {
  const pathname = usePathname() || "/auth/signin";
  const companySignInRoute = pathname === "/auth/company-signin";
  const switchHref = companySignInRoute ? "/auth/signin" : "/auth/company-signin";
  const switchLabel = companySignInRoute
    ? "School Sign In"
    : "Administrator Sign In";

  return (
    <header className="app-nav-shell fixed inset-x-0 top-0 z-50 h-[var(--app-header-height)] border-b backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background)/0.82)]">
      <div className="flex h-full items-center justify-between gap-3 px-3 lg:px-5">
        <AppPrefetchLink
          href="/"
          className="app-nav-brand flex min-w-0 items-center gap-3 px-2 py-1.5"
        >
          <div className="app-nav-logo flex h-10 w-10 items-center justify-center rounded-[var(--app-radius-md)]">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="app-nav-text text-[14px] font-semibold tracking-[0.01em]">
              Alyra Tech
            </p>
            <p className="app-nav-text-muted text-[11px]">
              Secure access portal
            </p>
          </div>
        </AppPrefetchLink>

        <div className="flex items-center gap-2">
          <div className="app-nav-chip app-nav-text hidden h-9 items-center gap-2 px-3 text-[13px] font-medium md:flex">
            <ShieldCheck className="h-4 w-4" />
            <span>Secure access</span>
          </div>
          <div className="app-nav-chip app-nav-text hidden h-9 items-center gap-2 px-3 text-[13px] font-medium sm:flex">
            {companySignInRoute ? (
              <Building2 className="h-4 w-4" />
            ) : (
              <School className="h-4 w-4" />
            )}
            <span>{companySignInRoute ? "Company Admin" : "School Access"}</span>
          </div>

          <Button
            asChild
            variant="secondary"
            size="sm"
            className="app-button-compact rounded-full px-4"
          >
            <AppPrefetchLink href={switchHref}>
              <span className="sm:hidden">
                {companySignInRoute ? "School" : "Admin"}
              </span>
              <span className="hidden sm:inline">{switchLabel}</span>
            </AppPrefetchLink>
          </Button>
        </div>
      </div>
    </header>
  );
}
