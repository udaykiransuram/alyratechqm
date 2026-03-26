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
      { href: "/product#diagnostics", label: "Precision Diagnostics", icon: Target, desc: "Identify learning gaps" },
      { href: "/product#erp", label: "School ERP", icon: Building2, desc: "Streamline operations" },
      { href: "/product#alumni", label: "Alumni Management", icon: GraduationCap, desc: "Connect with graduates" },
      { href: "/product#omr", label: "OMR Scanning", icon: ScanLine, desc: "Automate grading" },
    ],
  },
  { href: "/benefits", label: "Benefits" },
  { href: "/case-study", label: "Case Studies" },
  { href: "/about", label: "Company" },
];

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerH, setHeaderH] = useState<number>(80); // fallback to 80px (h-20)
  // Horizontal alignment handled by mirroring header container paddings on inner nav
  // Removed dynamic horizontal alignment states in favor of matching header container classes directly

  // Ensure portal only renders on client
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let frameId: number | null = null;
    const updateScrolledState = () => {
      frameId = null;
      const nextScrolled = window.scrollY > 20;
      setScrolled((current) => (current === nextScrolled ? current : nextScrolled));
    };
    const onScroll = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateScrolledState);
    };

    updateScrolledState();
    window.addEventListener("scroll", onScroll, { passive: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdown(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileDropdownOpen(null);
  }, [pathname]);
  // Lock body scroll when mobile menu is open (better iOS Safari behavior)
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    if (mobileMenuOpen) {
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
        const y = parseInt(top || "0", 10) * -1;
        const x = parseInt(left || "0", 10) * -1;
        window.scrollTo(x, y);
      };
    } else {
      // Ensure clean state if toggled quickly
      html.style.overflowX = "";
      body.style.overflow = "";
      body.style.position = "";
      body.style.width = "";
      body.style.top = "";
      body.style.left = "";
    }
  }, [mobileMenuOpen]);

  // Track header height for accurate mobile overlay positioning
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setH = () => setHeaderH(el.getBoundingClientRect().height);
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el);
    window.addEventListener("orientationchange", setH);
    window.addEventListener("resize", setH);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", setH);
      window.removeEventListener("resize", setH);
    };
  }, []);

  // No header box measurement required

  // Close desktop dropdown when clicking outside header
  useEffect(() => {
    if (!openDropdown) return;

    const onDocClick = (e: MouseEvent) => {
      if (!headerRef.current) return;
      if (!headerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openDropdown]);

  const homeHeroMode = isHome && !scrolled;

  const getTextColor = (active: boolean) => {
    if (homeHeroMode) {
      return active
        ? "bg-white/[0.12] text-white shadow-[0_16px_36px_-30px_rgba(255,255,255,0.28)] ring-1 ring-white/[0.14]"
        : "text-white/[0.74] hover:bg-white/[0.08] hover:text-white";
    }

    return active
      ? "bg-primary/10 text-primary shadow-[0_10px_24px_-24px_hsl(var(--primary)/0.35)] ring-1 ring-primary/15"
      : "text-foreground/78 hover:bg-accent/72 hover:text-foreground";
  };

  return (
    <header
      suppressHydrationWarning
      ref={headerRef}
      className={cn(
        "fixed top-0 z-[1000] w-full border-b transition-all duration-300",
        homeHeroMode
          ? "border-white/10 bg-transparent shadow-none"
          : "",
        scrolled
          ? "border-border/80 bg-background/88 shadow-[0_18px_40px_-30px_hsl(var(--app-shadow-deep)/0.28)] backdrop-blur-2xl"
          : homeHeroMode
            ? "backdrop-blur-none"
            : "border-border/60 bg-background/72 shadow-[0_14px_32px_-30px_hsl(var(--app-shadow-deep)/0.18)] backdrop-blur-xl"
      )}
    >
      <div
        className="mx-auto flex h-20 max-w-[88rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
        style={{
          paddingLeft: 'max(env(safe-area-inset-left, 0px), 24px)',
          paddingRight: 'max(env(safe-area-inset-right, 0px), 24px)'
        }}
      >
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-3 transition-transform hover:-translate-y-0.5">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl ring-1",
              homeHeroMode
                ? "bg-white/[0.12] text-white shadow-[0_18px_32px_-22px_rgba(0,0,0,0.58)] ring-white/[0.12] backdrop-blur-md"
                : "bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[0_18px_32px_-20px_hsl(var(--primary)/0.42)] ring-primary/10",
            )}
          >
            <Activity className="h-5 w-5" />
          </div>
          {/* Compact brand on mobile, full on desktop */}
          <div className="flex md:hidden">
            <span
              className={cn(
                "text-[13px] font-semibold leading-none tracking-[-0.02em]",
                homeHeroMode ? "text-white" : "text-foreground",
              )}
            >
              Alyra Tech
            </span>
          </div>
          <div className="hidden flex-col md:flex">
            <span
              className={cn(
                "text-lg font-semibold leading-none tracking-[-0.03em] transition-colors",
                homeHeroMode ? "text-white" : "text-foreground",
              )}
            >
              Alyra Tech
            </span>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.18em] transition-colors",
                homeHeroMode ? "text-white/[0.62]" : "text-muted-foreground",
              )}
            >
              Precision Diagnostics
            </span>
          </div>
        </Link>


        {/* Desktop Nav */}
        <nav className="hidden items-center gap-1.5 md:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const hasDropdown = 'dropdown' in item;
            const textColorClass = getTextColor(isActive);

            if (hasDropdown) {
              return (
                <div 
                  key={item.href}
                  className="relative group"
                  onMouseEnter={() => setOpenDropdown(item.href)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2",
                      textColorClass
                    )}
                    aria-haspopup="menu"
                    aria-expanded={openDropdown === item.href}
                    onClick={() => setOpenDropdown(openDropdown === item.href ? null : item.href)}
                  >
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        homeHeroMode ? "text-white/[0.56]" : "text-muted-foreground",
                        openDropdown === item.href && "rotate-180",
                      )}
                    />
                  </button>
                  
                  {/* Mega Menu Dropdown */}
                  <div 
                    className={cn(
                      "absolute left-1/2 top-full w-[22rem] -translate-x-1/2 pt-3 transition-all duration-200 will-change-transform z-[1100]",
                      openDropdown === item.href 
                        ? "opacity-100 translate-y-0 scale-100 visible" 
                        : "opacity-0 translate-y-2 scale-95 invisible pointer-events-none"
                    )}
                    data-dropdown-panel
                  >
                    <div className="overflow-hidden rounded-[calc(var(--app-radius-lg)+2px)] border border-border/70 bg-background/96 p-2 text-foreground shadow-[0_24px_48px_-28px_hsl(var(--app-shadow-deep)/0.34)] backdrop-blur-xl">
                      <div className="px-2 py-1.5">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Solutions</div>
                      </div>
                      <div className="grid gap-1 p-1">
                        {item.dropdown?.map((subItem) => {
                          const Icon = subItem.icon;

                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              className="group/item flex items-start gap-3 rounded-[var(--app-radius-lg)] border border-transparent p-3 transition-[background-color,border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-border/80 hover:bg-accent/36 hover:shadow-[0_16px_30px_-26px_hsl(var(--app-shadow-deep)/0.22)]"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--app-radius-md)] border border-border/70 bg-background/94 text-primary shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)]">
                                <Icon className="h-5 w-5" />
                              </span>
                              <div className="flex-1">
                                <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                                  {subItem.label}
                                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover/item:opacity-100" />
                                </div>
                                <div className="text-xs leading-5 text-muted-foreground">{subItem.desc}</div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2",
                  textColorClass
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isHome ? (
            <>
              <Link
                href="/auth/signin"
                className={cn(
                  "hidden px-2 text-sm font-medium transition-colors md:block",
                  homeHeroMode
                    ? "text-white/[0.68] hover:text-white"
                    : "text-foreground/74 hover:text-foreground",
                )}
              >
                Sign In
              </Link>
              <Link
                href="/talent-test"
                className={cn(
                  "hidden h-10 items-center justify-center rounded-full px-4 text-sm font-semibold md:inline-flex",
                  homeHeroMode
                    ? "border border-white/[0.14] bg-white/[0.08] text-white shadow-[0_18px_36px_-28px_rgba(0,0,0,0.36)] backdrop-blur-md transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-white/[0.12]"
                    : "app-button-secondary",
                )}
                aria-label="Start Baseline Test"
              >
                <span className="whitespace-nowrap">Start Baseline Test</span>
              </Link>
              <Link
                href="/contact"
                className={cn(
                  "inline-flex h-10 whitespace-nowrap items-center justify-center gap-2 rounded-full px-4 sm:px-5",
                  homeHeroMode
                    ? "bg-white text-slate-950 shadow-[0_22px_42px_-24px_rgba(255,255,255,0.42)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-white"
                    : "app-button-primary",
                )}
                aria-label="Book Demo"
              >
                <span className="whitespace-nowrap">Book Demo</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <>
              <Link 
                href="/contact"
                className="hidden px-2 text-sm font-medium text-foreground/74 transition-colors hover:text-foreground md:block"
              >
                Contact
              </Link>
              <Link
                href="/auth/signin"
                className="app-button-secondary hidden h-10 px-5 md:inline-flex"
              >
                Sign In
              </Link>
              <Link
                href="/talent-test"
                className="app-button-primary inline-flex h-10 whitespace-nowrap px-4 sm:px-5"
                aria-label="Start Baseline Test"
              >
                <span className="whitespace-nowrap">Baseline Test</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
          
          {/* Mobile Menu Button */}
          <button 
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-[var(--app-radius-md)] border transition-[background-color,border-color,transform] md:hidden",
              homeHeroMode
                ? "border-white/10 bg-white/[0.08] text-white shadow-[0_18px_36px_-30px_rgba(0,0,0,0.38)] backdrop-blur-md hover:-translate-y-0.5 hover:bg-white/[0.12]"
                : "border-border/60 bg-background/88 text-foreground shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] hover:-translate-y-0.5 hover:border-primary/16 hover:bg-accent/60"
            )}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu (portaled to body for reliable stacking on mobile) */}
      {mounted && mobileMenuOpen && createPortal(
        <>
          {/* Dimmed backdrop to focus the sheet and close on tap */}
          <button
            aria-label="Close menu overlay"
            className="fixed inset-0 z-[9997] bg-[hsl(var(--app-shadow-deep)/0.42)] backdrop-blur-[3px] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Right side drawer panel */}
          <div
            className="fixed right-0 top-0 z-[9999] h-screen w-[85vw] max-w-sm overflow-y-auto overscroll-contain border-l border-border/70 bg-background/96 shadow-[0_26px_60px_-34px_hsl(var(--app-shadow-deep)/0.42)] backdrop-blur-2xl transition-transform duration-300 translate-x-0 md:hidden"
            style={{ paddingTop: `${headerH}px` }}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Menu"
          >
            <div className="flex items-center justify-between px-6 pb-3">
              <span className="text-base font-semibold tracking-[-0.02em] text-foreground">Menu</span>
              <button
                aria-label="Close menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--app-radius-md)] border border-border/60 bg-background/88 text-foreground shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.2)] transition-[background-color,border-color] hover:border-primary/16 hover:bg-accent/60"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav
              className="flex flex-col gap-2 px-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] text-foreground sm:px-6"
              role="menu"
              aria-label="Mobile Navigation"
            >

              {/* Explore Section */}
              <div className="px-3 pb-1 pt-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Explore</div>
              <div className="mx-3 my-2 h-px bg-border/70" />
              {navItems.filter((it) => !('dropdown' in it)).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative mx-2 block rounded-[var(--app-radius-lg)] border border-border/60 bg-background/92 px-4 py-3 text-sm font-semibold text-foreground shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-primary/16 hover:bg-accent/40"
                  onClick={() => setMobileMenuOpen(false)}
                  role="menuitem"
                >
                  <span className="pointer-events-none">{item.label}</span>
                  <ArrowRight className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                </Link>
              ))}

              {/* Solutions Section */}
              <div className="px-3 pb-1 pt-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Solutions</div>
              <div className="mx-3 my-2 h-px bg-border/70" />
              {navItems.filter((it) => ('dropdown' in it)).map((item) => (
                <div key={item.href} className="mx-2">
                  <div className="rounded-[calc(var(--app-radius-lg)+2px)] border border-border/60 bg-background/90 p-2 shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.16)]">
                    <button
                      className="relative w-full rounded-[var(--app-radius-lg)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_18px_32px_-22px_hsl(var(--primary)/0.38)] transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={() => setMobileDropdownOpen(mobileDropdownOpen === item.href ? null : item.href)}
                      aria-expanded={mobileDropdownOpen === item.href}
                      aria-controls={`mobile-dd-${item.href}`}
                      role="menuitem"
                    >
                      <span className="pointer-events-none">{item.label}</span>
                      <ChevronDown
                        className={cn(
                          "pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary-foreground/90 transition-transform",
                          mobileDropdownOpen === item.href && "rotate-180",
                        )}
                      />
                    </button>
                    {mobileDropdownOpen === item.href && (
                      <div id={`mobile-dd-${item.href}`} className="space-y-2 px-1 pb-1 pt-2">
                        {item.dropdown!.map((subItem) => {
                          const Icon = subItem.icon;

                          return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className="relative flex items-center gap-3 rounded-[var(--app-radius-lg)] border border-border/60 bg-background/95 px-4 py-3 text-sm text-foreground shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-primary/16 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            onClick={() => setMobileMenuOpen(false)}
                            role="menuitem"
                          >
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--app-radius-sm)] border border-border/70 bg-background/90 text-primary shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.14)]">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="pointer-events-none mx-auto pr-4 text-left">{subItem.label}</span>
                            <ArrowRight className="pointer-events-none absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Footer quick actions */}
              <div className="mt-3 px-2 grid grid-cols-3 gap-2">
                {isHome ? (
                  <>
                    <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center rounded-[var(--app-radius-lg)] border border-border/60 bg-background/92 py-2 text-sm font-semibold text-foreground shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] transition-[background-color,border-color] hover:border-primary/16 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2">
                      Sign In
                    </Link>
                    <Link href="/talent-test" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center rounded-[var(--app-radius-lg)] border border-border/60 bg-background/92 py-2 text-sm font-semibold text-foreground shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] transition-[background-color,border-color] hover:border-primary/16 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2">
                      Baseline
                    </Link>
                    <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center rounded-[var(--app-radius-lg)] bg-primary py-2 text-sm font-semibold text-primary-foreground shadow-[0_18px_30px_-22px_hsl(var(--primary)/0.4)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:ring-offset-2">
                      Demo
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center rounded-[var(--app-radius-lg)] border border-border/60 bg-background/92 py-2 text-sm font-semibold text-foreground shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] transition-[background-color,border-color] hover:border-primary/16 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2">
                      Sign In
                    </Link>
                    <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center rounded-[var(--app-radius-lg)] bg-primary py-2 text-sm font-semibold text-primary-foreground shadow-[0_18px_30px_-22px_hsl(var(--primary)/0.4)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-primary/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:ring-offset-2">
                      Register
                    </Link>
                    <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center rounded-[var(--app-radius-lg)] border border-border/60 bg-background/92 py-2 text-sm font-semibold text-foreground shadow-[0_12px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] transition-[background-color,border-color] hover:border-primary/16 hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2">
                      Contact
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </>,
        document.body
      )}
    </header>
  );
}
