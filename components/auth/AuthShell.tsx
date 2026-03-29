"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Building2, School } from "lucide-react";

type AuthRoute = "school" | "company";

type AuthShellProps = {
  activeRoute: AuthRoute;
  hero: ReactNode;
  children: ReactNode;
};

type AuthHeroPoint = {
  icon: LucideIcon;
  title: string;
  copy: string;
};

type AuthHeroPanelProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  copy: string;
  points?: ReadonlyArray<AuthHeroPoint>;
  noteTitle?: string;
  noteCopy?: string;
};

type AuthFormHeaderProps = {
  eyebrow: string;
  title: string;
  copy: string;
  badges?: string[];
};

const ROUTE_OPTIONS = [
  {
    key: "school",
    href: "/auth/signin",
    label: "School",
    icon: School,
  },
  {
    key: "company",
    href: "/auth/company-signin",
    label: "Company",
    icon: Building2,
  },
] as const;

export function AuthShell({
  activeRoute,
  hero,
  children,
}: AuthShellProps) {
  return (
    <div className="app-auth-shell">
      <div className="app-auth-frame">
        <div className="app-auth-card">
          <section className="app-auth-panel app-auth-panel-strong app-auth-panel-hero order-2 lg:order-1">
            {hero}
          </section>

          <section className="app-auth-panel app-auth-panel-form app-auth-panel-form-primary order-1 lg:order-2">
            <div className="app-auth-form-topbar">
              <AuthRouteSwitcher activeRoute={activeRoute} />
            </div>
            {children}
          </section>
        </div>
      </div>
    </div>
  );
}

export function AuthHeroPanel({
  icon: Icon,
  eyebrow,
  title,
  copy,
  points = [],
  noteTitle,
  noteCopy,
}: AuthHeroPanelProps) {
  return (
    <div className="app-auth-hero-stack">
      <div className="space-y-5">
        <div className="app-auth-icon">
          <Icon className="h-6 w-6" />
        </div>
        <div className="space-y-3">
          <p className="app-auth-kicker">{eyebrow}</p>
          <h1 className="app-auth-title">{title}</h1>
          {copy ? (
            <p className="app-auth-copy app-auth-copy-hero">{copy}</p>
          ) : null}
        </div>
      </div>

      {points.length > 0 ? (
        <div className="app-auth-signal-list">
          {points.map((point) => {
            const PointIcon = point.icon;
            return (
              <div key={point.title} className="app-auth-signal-card">
                <div className="app-auth-signal-icon">
                  <PointIcon className="h-4 w-4" />
                </div>
                <div>
                  <p className="app-auth-signal-title">{point.title}</p>
                  <p className="app-auth-signal-copy">{point.copy}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {noteTitle || noteCopy ? (
        <div className="app-auth-support-note">
          {noteTitle ? (
            <p className="app-auth-support-title">{noteTitle}</p>
          ) : null}
          {noteCopy ? (
            <p className="app-auth-support-copy">{noteCopy}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AuthFormHeader({
  eyebrow,
  title,
  copy,
  badges = [],
}: AuthFormHeaderProps) {
  const visibleBadges = badges.filter(Boolean);

  return (
    <div className="app-auth-form-header">
      {visibleBadges.length > 0 ? (
        <div className="app-auth-context-row">
          {visibleBadges.map((badge) => (
            <span key={badge} className="app-auth-context-pill">
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-2.5">
        <p className="app-auth-kicker">{eyebrow}</p>
        <h2 className="app-auth-form-title">{title}</h2>
        {copy ? (
          <p className="app-auth-copy app-auth-copy-form">{copy}</p>
        ) : null}
      </div>
    </div>
  );
}

function AuthRouteSwitcher({
  activeRoute,
}: {
  activeRoute: AuthRoute;
}) {
  return (
    <div className="app-auth-switcher" aria-label="Choose sign-in portal">
      {ROUTE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = option.key === activeRoute;

        if (isActive) {
          return (
            <span
              key={option.key}
              className="app-auth-switcher-item app-auth-switcher-item-active"
              aria-current="page"
            >
              <Icon className="h-4 w-4" />
              {option.label}
            </span>
          );
        }

        return (
          <Link key={option.key} href={option.href} className="app-auth-switcher-item">
            <Icon className="h-4 w-4" />
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
