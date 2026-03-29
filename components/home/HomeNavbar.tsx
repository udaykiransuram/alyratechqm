"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowRight, Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { HOME_NAV_LINKS } from "./home-content";

const HOME_SECTION_LINKS = HOME_NAV_LINKS.filter((item) =>
  item.href.startsWith("#"),
);

export default function HomeNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string>(
    () => HOME_SECTION_LINKS[0]?.href ?? "",
  );

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncFromHash = () => {
      const hash = window.location.hash;
      if (hash && HOME_SECTION_LINKS.some((item) => item.href === hash)) {
        setActiveHref(hash);
      }
    };

    syncFromHash();

    const sections = HOME_SECTION_LINKS.map((item) =>
      document.getElementById(item.href.slice(1)),
    ).filter(Boolean) as HTMLElement[];

    if (!sections.length) {
      window.addEventListener("hashchange", syncFromHash);
      return () => window.removeEventListener("hashchange", syncFromHash);
    }

    let frameId = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              right.intersectionRatio - left.intersectionRatio ||
              left.boundingClientRect.top - right.boundingClientRect.top,
          );

        const nextTarget = visibleEntries[0]?.target;
        if (!(nextTarget instanceof HTMLElement)) {
          return;
        }

        window.cancelAnimationFrame(frameId);
        frameId = window.requestAnimationFrame(() => {
          setActiveHref(`#${nextTarget.id}`);
        });
      },
      {
        rootMargin: "-18% 0px -58% 0px",
        threshold: [0.22, 0.42, 0.68],
      },
    );

    sections.forEach((section) => observer.observe(section));
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, []);

  const renderNavLink = (
    item: (typeof HOME_NAV_LINKS)[number],
    options?: { mobile?: boolean },
  ) => {
    const mobile = options?.mobile ?? false;
    const isActive = item.href.startsWith("#") && item.href === activeHref;

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(mobile ? "home-nav-mobile-link" : "home-nav-link")}
        data-active={isActive ? "true" : "false"}
        aria-current={isActive ? "page" : undefined}
        onClick={() => {
          if (item.href.startsWith("#")) {
            setActiveHref(item.href);
          }
          if (mobile) {
            setMobileOpen(false);
          }
        }}
      >
        <span>{item.label}</span>
        {mobile ? <ArrowRight className="h-4 w-4" /> : null}
      </Link>
    );
  };

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-[1000] transition-all duration-300",
          scrolled ? "bg-transparent" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex max-w-[98rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div
            className={cn(
              "home-glass-surface home-nav-shell home-nav-desktop-shell hidden w-full items-center justify-between gap-4 px-3 py-2.5 lg:flex",
              scrolled && "home-nav-shell-scrolled",
            )}
          >
            <Link
              href="/platform-home"
              className="home-nav-brand flex min-w-0 items-center gap-3 rounded-full px-2 py-1.5 transition-all duration-300"
            >
              <div className="home-brand-mark flex h-11 w-11 items-center justify-center rounded-[1rem] text-[hsl(var(--home-bg-0))]">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="home-nav-brand-title">Alyra Tech</p>
                <div className="mt-1 flex items-center gap-2">
                  <p className="home-nav-brand-subtitle">Diagnostics For Schools</p>
                  <span className="home-nav-brand-pill hidden xl:inline-flex">
                    School Intelligence
                  </span>
                </div>
              </div>
            </Link>

            <div className="home-nav-link-group">
              <nav className="flex items-center gap-1">
                {HOME_NAV_LINKS.map((item) => renderNavLink(item))}
              </nav>
            </div>

            <div className="home-nav-actions flex items-center gap-2.5">
              <div className="home-nav-divider" />
              <Link href="/auth/signin" className="home-nav-utility-link">
                Sign In
              </Link>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="home-nav-action-button home-nav-cta-secondary rounded-full px-4 text-[hsl(var(--home-text))]"
              >
                <Link href="/talent-test">Start Baseline Test</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="home-nav-action-button home-nav-cta-primary rounded-full border-0 px-4.5 text-[hsl(var(--home-bg-0))]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--home-accent-strong)) 0%, hsl(var(--home-accent)) 100%)",
                }}
              >
                <Link href="/contact">
                  Book a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex w-full items-center justify-between gap-3 lg:hidden">
            <Link
              href="/platform-home"
              className={cn(
                "home-glass-surface home-nav-shell home-nav-brand-shell flex min-w-0 flex-1 items-center gap-3 rounded-full px-3 py-2 transition-all duration-300",
                scrolled && "home-nav-shell-scrolled",
              )}
            >
              <div className="home-brand-mark flex h-10 w-10 items-center justify-center rounded-[0.95rem] text-[hsl(var(--home-bg-0))]">
                <Activity className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="home-nav-brand-title truncate">Alyra Tech</p>
                <p className="home-nav-brand-subtitle truncate">
                  Diagnostics For Schools
                </p>
              </div>
            </Link>

            <button
              type="button"
              className={cn(
                "home-glass-surface home-nav-shell home-nav-menu-button inline-flex h-12 w-12 items-center justify-center rounded-full",
                scrolled && "home-nav-shell-scrolled",
              )}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileOpen((current) => !current)}
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[999] bg-[hsl(var(--home-shadow)/0.72)] backdrop-blur-sm lg:hidden">
          <div className="home-nav-mobile-panel ml-auto flex h-full w-[min(92vw,24rem)] flex-col gap-6 px-5 pb-8 pt-6 shadow-[0_34px_68px_-44px_hsl(var(--home-shadow)/0.72)]">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/platform-home"
                className="flex min-w-0 items-center gap-3"
                onClick={() => setMobileOpen(false)}
              >
                <div className="home-brand-mark flex h-10 w-10 items-center justify-center rounded-[0.95rem] text-[hsl(var(--home-bg-0))]">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="home-nav-brand-title truncate">Alyra Tech</p>
                  <p className="home-nav-brand-subtitle truncate">
                    Diagnostics For Schools
                  </p>
                </div>
              </Link>

              <button
                type="button"
                className="home-nav-mobile-close"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="home-nav-mobile-summary">
              <p className="home-nav-mobile-summary-label">
                School review flow
              </p>
              <h2 className="home-flagship-display mt-3 text-3xl text-[hsl(var(--home-text))]">
                Explore Alyra
              </h2>
              <p className="mt-3 text-sm leading-7 text-[hsl(var(--home-text-muted))]">
                Move from diagnostic signal to clear school, class, and student
                action without losing context.
              </p>
            </div>

            <nav className="space-y-3">
              {HOME_NAV_LINKS.map((item) => renderNavLink(item, { mobile: true }))}
              <Link
                href="/auth/signin"
                className="home-nav-mobile-link"
                onClick={() => setMobileOpen(false)}
              >
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </nav>

            <div className="mt-auto space-y-3">
              <Button
                asChild
                className="home-nav-action-button home-nav-cta-primary h-12 w-full rounded-full border-0 text-[hsl(var(--home-bg-0))]"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--home-accent-strong)) 0%, hsl(var(--home-accent)) 100%)",
                }}
              >
                <Link href="/contact" onClick={() => setMobileOpen(false)}>
                  Book a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="home-nav-action-button home-nav-cta-secondary h-12 w-full rounded-full border-[hsl(var(--home-border)/0.84)] bg-[hsl(var(--home-surface)/0.48)] text-[hsl(var(--home-text))]"
              >
                <Link href="/talent-test" onClick={() => setMobileOpen(false)}>
                  Start Baseline Test
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
