"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  ArrowRight,
  Building2,
  ChevronDown,
  GraduationCap,
  Menu,
  ScanLine,
  Target,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home" },
  {
    href: "/product",
    label: "Solutions",
    dropdown: [
      {
        href: "/product#diagnostics",
        label: "Precision Diagnostics",
        icon: Target,
        desc: "Identify learning gaps",
      },
      {
        href: "/product#erp",
        label: "School ERP",
        icon: Building2,
        desc: "Streamline operations",
      },
      {
        href: "/product#alumni",
        label: "Alumni Management",
        icon: GraduationCap,
        desc: "Connect with graduates",
      },
      {
        href: "/product#omr",
        label: "OMR Scanning",
        icon: ScanLine,
        desc: "Automate grading",
      },
    ],
  },
  { href: "/benefits", label: "Benefits" },
  { href: "/case-study", label: "Case Studies" },
  { href: "/about", label: "Company" },
] as const;

export default function Navbar() {
  const pathname = usePathname() || "/";
  const [scrolled, setScrolled] = useState(false);
  const [desktopDropdown, setDesktopDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<string | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(72);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDesktopDropdown(null);
        setMobileDropdownOpen(null);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setDesktopDropdown(null);
    setMobileMenuOpen(false);
    setMobileDropdownOpen(null);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.documentElement.style.overflowX = "";
      return undefined;
    }

    const body = document.body;
    const html = document.documentElement;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    html.style.overflowX = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";
    body.style.top = `-${scrollY}px`;
    body.style.left = `-${scrollX}px`;

    return () => {
      const top = body.style.top;
      const left = body.style.left;

      html.style.overflowX = "";
      body.style.overflow = "";
      body.style.position = "";
      body.style.width = "";
      body.style.top = "";
      body.style.left = "";

      const nextY = parseInt(top || "0", 10) * -1;
      const nextX = parseInt(left || "0", 10) * -1;
      window.scrollTo(nextX, nextY);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!desktopDropdown) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(event.target as Node)) {
        setDesktopDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [desktopDropdown]);

  useLayoutEffect(() => {
    const node = headerRef.current;
    if (!node) return undefined;

    const syncHeight = () => {
      setHeaderHeight(node.getBoundingClientRect().height);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(node);
    window.addEventListener("resize", syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

  const isActivePath = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const isMarketingHome = pathname === "/";
  const useHeroChrome = isMarketingHome && !scrolled;
  const shellClassName = cn(
    "public-nav-shell",
    isMarketingHome && "public-nav-shell-home",
    useHeroChrome && "public-nav-shell-hero",
    isMarketingHome && scrolled && "public-nav-shell-home-scrolled",
  );

  const navLinkClassName = (active: boolean) =>
    cn(
      "public-nav-link focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--public-accent))/0.34]",
      useHeroChrome && "public-nav-link-hero",
      active && "public-nav-link-active",
    );

  return (
    <header
      suppressHydrationWarning
      ref={headerRef}
      className={cn(
        "fixed inset-x-0 top-0 z-[1000] text-slate-900 transition-all duration-300",
        isMarketingHome ? "px-2 sm:px-3 md:px-4" : "w-full border-b",
        !isMarketingHome && shellClassName,
      )}
      style={
        isMarketingHome
          ? {
              paddingTop: "max(env(safe-area-inset-top, 0px), 10px)",
              paddingLeft: "max(env(safe-area-inset-left, 0px), 12px)",
              paddingRight: "max(env(safe-area-inset-right, 0px), 12px)",
            }
          : undefined
      }
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-2",
          isMarketingHome
            ? cn(
                "public-nav-frame h-[4.5rem] w-full max-w-[82rem] px-4 sm:px-5 md:px-7",
                shellClassName,
              )
            : "h-[4.5rem] max-w-[82rem] px-4 sm:px-6 md:px-10",
        )}
        style={
          isMarketingHome
            ? undefined
            : {
                paddingLeft: "max(env(safe-area-inset-left, 0px), 24px)",
                paddingRight: "max(env(safe-area-inset-right, 0px), 24px)",
              }
        }
      >
        <Link
          href="/"
          className="public-nav-brand transition-opacity hover:opacity-90"
        >
          <div className="public-nav-brand-badge">
            <Activity className="h-5 w-5 md:h-6 md:w-6" />
          </div>
          <div className="flex md:hidden">
            <span
              className={cn(
                "text-[13px] font-semibold leading-none tracking-tight",
                isMarketingHome ? "text-white" : "text-[hsl(var(--public-ink))]",
              )}
            >
              Alyra Tech
            </span>
          </div>
          <div className="hidden flex-col md:flex">
            <span
              className={cn(
                "text-lg font-bold leading-none tracking-tight",
                isMarketingHome ? "text-white" : "text-[hsl(var(--public-ink))]",
              )}
            >
              Alyra Tech
            </span>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider",
                isMarketingHome
                  ? "text-white/68"
                  : "text-[hsl(var(--public-muted))]",
              )}
            >
              Precision Diagnostics
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex lg:gap-1">
          {navItems.map((item) => {
            const active = isActivePath(item.href);
            const hasDropdown = "dropdown" in item;

            if (!hasDropdown) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navLinkClassName(active)}
                >
                  {item.label}
                </Link>
              );
            }

            const dropdownOpen = desktopDropdown === item.href;

            return (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => setDesktopDropdown(item.href)}
                onMouseLeave={() => setDesktopDropdown(null)}
              >
                <div
                  className={cn(
                    "flex items-center rounded-full pr-1 transition-all",
                    active || dropdownOpen
                      ? cn(
                          "public-nav-link-active",
                          useHeroChrome && "public-nav-link-hero",
                        )
                      : "hover:bg-[hsl(var(--public-accent))/0.06]",
                  )}
                >
                  <Link
                    href={item.href}
                    className={cn(
                      "public-nav-link focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--public-accent))/0.34]",
                      useHeroChrome && "public-nav-link-hero",
                      (active || dropdownOpen) && "public-nav-link-active",
                    )}
                  >
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    className={cn(
                      "public-nav-disclosure inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--public-accent))/0.34]",
                      isMarketingHome
                        ? "text-white/78 hover:bg-white/10 hover:text-white"
                        : "text-[hsl(var(--public-muted))] hover:bg-[hsl(var(--public-accent))/0.08] hover:text-[hsl(var(--public-ink))]",
                      dropdownOpen &&
                        (isMarketingHome
                          ? "bg-white/12 text-white"
                          : "bg-white/90 text-[hsl(var(--public-ink))]"),
                    )}
                    aria-label={`Toggle ${item.label} menu`}
                    aria-haspopup="menu"
                    aria-expanded={dropdownOpen}
                    onClick={() =>
                      setDesktopDropdown((current) =>
                        current === item.href ? null : item.href,
                      )
                    }
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        dropdownOpen && "rotate-180",
                      )}
                    />
                  </button>
                </div>

                <div
                  className={cn(
                    "absolute left-1/2 top-full z-[1100] w-[22rem] -translate-x-1/2 pt-3 transition-all duration-200 will-change-transform",
                    dropdownOpen
                      ? "visible translate-y-0 scale-100 opacity-100"
                      : "invisible translate-y-2 scale-95 opacity-0 pointer-events-none",
                  )}
                  data-dropdown-panel
                >
                  <div className="public-nav-panel overflow-hidden rounded-2xl p-2 text-[hsl(var(--public-ink))] shadow-2xl ring-1 ring-[hsl(var(--public-shadow))/0.06] backdrop-blur-xl">
                    <div className="px-2 py-1.5">
                      <div className="text-[11px] uppercase tracking-wide text-[hsl(var(--public-muted))]">
                        Solutions
                      </div>
                    </div>
                    <div className="grid gap-1 p-1">
                      {item.dropdown?.map((subItem) => {
                        const Icon = subItem.icon;

                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className="group/item public-nav-dropdown-item"
                          >
                            <span className="public-nav-dropdown-icon">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center justify-between text-sm font-semibold text-[hsl(var(--public-ink))]">
                                {subItem.label}
                                <ArrowRight className="h-4 w-4 text-[hsl(var(--public-muted))] opacity-0 transition-opacity group-hover/item:opacity-100" />
                              </div>
                              <div className="text-xs text-[hsl(var(--public-muted))]">
                                {subItem.desc}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex lg:gap-3">
          <Link
            href="/auth/signin"
            className={cn(
              "public-nav-secondary-action",
              isMarketingHome && "text-white/80 hover:text-white",
            )}
          >
            Sign In
          </Link>
          <Link
            href="/contact"
            className={cn(
              "public-nav-secondary-action",
              isMarketingHome && "text-white/80 hover:text-white",
            )}
          >
            Request Demo
          </Link>
          <Link
            href="/talent-test"
            className="public-nav-cta focus:outline-none focus:ring-2 focus:ring-[hsl(var(--public-accent))/0.34] focus:ring-offset-2"
            aria-label="Start Baseline Test"
          >
            <span className="mr-2 whitespace-nowrap drop-shadow-sm">
              Start Test
            </span>
            <ArrowRight className="h-3.5 w-3.5 drop-shadow-sm transition-transform group-hover:translate-x-1 md:h-4 md:w-4" />
          </Link>
        </div>

        <button
          type="button"
          className={cn(
            "public-nav-mobile-trigger inline-flex h-11 w-11 items-center justify-center rounded-xl transition-colors md:hidden",
            isMarketingHome
              ? "text-white hover:bg-white/10"
              : "text-[hsl(var(--public-ink-soft))] hover:bg-[hsl(var(--public-accent))/0.08]",
          )}
          onClick={() => setMobileMenuOpen((current) => !current)}
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mounted && mobileMenuOpen
        ? createPortal(
            <>
              <button
                type="button"
                aria-label="Close menu overlay"
                className="fixed inset-0 z-[9997] bg-slate-900/40 backdrop-blur-[2px] md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div
                className="public-mobile-sheet fixed right-0 top-0 z-[9999] h-screen w-[84vw] max-w-sm overflow-y-auto overscroll-contain border-l shadow-2xl ring-1 ring-[hsl(var(--public-shadow))/0.06] backdrop-blur-xl md:hidden"
                style={{ paddingTop: `${headerHeight}px` }}
                role="dialog"
                aria-modal="true"
                aria-label="Mobile navigation"
              >
                <div className="flex items-center justify-between px-6 pb-2">
                  <span className="text-base font-semibold text-[hsl(var(--public-accent))]">
                    Menu
                  </span>
                  <button
                    type="button"
                    aria-label="Close navigation"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[hsl(var(--public-accent))] ring-1 ring-[hsl(var(--public-border))/0.72] transition-colors hover:bg-[hsl(var(--public-accent))/0.08]"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav
                  className="flex flex-col gap-1.5 px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6"
                  role="menu"
                  aria-label="Mobile navigation"
                >
                  <div className="public-mobile-menu-heading">
                    Explore
                  </div>
                  <div className="mx-3 my-2 h-px bg-[hsl(var(--public-border))/0.72]" />
                  {navItems
                    .filter((item) => !("dropdown" in item))
                    .map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="public-mobile-menu-link mx-2 block text-center focus:outline-none focus:ring-2 focus:ring-[hsl(var(--public-accent))/0.34]"
                        onClick={() => setMobileMenuOpen(false)}
                        role="menuitem"
                      >
                        <span>{item.label}</span>
                        <ArrowRight className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/90" />
                      </Link>
                    ))}

                  <div className="public-mobile-menu-heading pt-4">
                    Solutions
                  </div>
                  <div className="mx-3 my-2 h-px bg-[hsl(var(--public-border))/0.72]" />
                  {navItems
                    .filter((item) => "dropdown" in item)
                    .map((item) => (
                      <div key={item.href} className="mx-2">
                        <div className="public-mobile-menu-panel">
                          <div className="flex items-center gap-2">
                            <Link
                              href={item.href}
                              className="public-mobile-menu-link relative flex-1 justify-center text-center focus:outline-none focus:ring-2 focus:ring-[hsl(var(--public-accent))/0.34]"
                              onClick={() => setMobileMenuOpen(false)}
                              role="menuitem"
                            >
                              <span>{item.label}</span>
                              <ArrowRight className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/90" />
                            </Link>
                            <button
                              type="button"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[hsl(var(--public-muted))] transition-colors hover:bg-[hsl(var(--public-accent))/0.08] hover:text-[hsl(var(--public-ink))]"
                              aria-label={`Toggle ${item.label} menu`}
                              aria-expanded={mobileDropdownOpen === item.href}
                              onClick={() =>
                                setMobileDropdownOpen((current) =>
                                  current === item.href ? null : item.href,
                                )
                              }
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform duration-200",
                                  mobileDropdownOpen === item.href &&
                                    "rotate-180",
                                )}
                              />
                            </button>
                          </div>
                          {mobileDropdownOpen === item.href ? (
                            <div className="space-y-2 px-1 pb-1 pt-2">
                              {item.dropdown?.map((subItem) => {
                                const Icon = subItem.icon;

                                return (
                                  <Link
                                    key={subItem.href}
                                    href={subItem.href}
                                    className="public-mobile-menu-link relative"
                                    onClick={() => setMobileMenuOpen(false)}
                                    role="menuitem"
                                  >
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/10">
                                      <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="mx-auto">{subItem.label}</span>
                                    <ArrowRight className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/90" />
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}

                  <div className="mt-3 grid grid-cols-2 gap-2 px-2">
                    <Link
                      href="/auth/signin"
                      onClick={() => setMobileMenuOpen(false)}
                      className="public-mobile-menu-action public-mobile-menu-action-primary"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/contact"
                      onClick={() => setMobileMenuOpen(false)}
                      className="public-mobile-menu-action public-mobile-menu-action-secondary"
                    >
                      Contact
                    </Link>
                  </div>
                  <Link
                    href="/talent-test"
                    onClick={() => setMobileMenuOpen(false)}
                    className="public-mobile-menu-link mx-2 mt-2 inline-flex items-center justify-center"
                  >
                    Start Baseline Test
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </nav>
              </div>
            </>,
            document.body,
          )
        : null}
    </header>
  );
}
