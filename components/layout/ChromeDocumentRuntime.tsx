"use client";

import { useLayoutEffect } from "react";

import {
  PUBLIC_THEME_CHANGE_EVENT,
  applyPublicThemeToElement,
  clearPublicThemeFromElement,
  resolveStoredPublicTheme,
} from "@/lib/client/public-theme";

type ChromeDocumentRuntimeProps = {
  visualMode: "default" | "public" | "workspace";
  sidebarWidth?: string;
  mobileSchoolSwitcherHeight?: string;
  publicTheme?: "clear" | "sync";
  publicHomeVariant?: "cinematic" | "flagship";
};

export default function ChromeDocumentRuntime({
  visualMode,
  sidebarWidth,
  mobileSchoolSwitcherHeight,
  publicTheme,
  publicHomeVariant,
}: ChromeDocumentRuntimeProps) {
  useLayoutEffect(() => {
    const root = document.documentElement;

    root.setAttribute("data-app-visual-mode", visualMode);

    if (typeof sidebarWidth === "string") {
      root.style.setProperty("--app-sidebar-width", sidebarWidth);
    }

    if (typeof mobileSchoolSwitcherHeight === "string") {
      root.style.setProperty(
        "--app-mobile-school-switcher-height",
        mobileSchoolSwitcherHeight,
      );
    }

    if (publicHomeVariant === "cinematic") {
      root.setAttribute("data-public-home-cinematic", "true");
    } else {
      root.removeAttribute("data-public-home-cinematic");
    }

    if (publicHomeVariant === "flagship") {
      root.setAttribute("data-public-home-flagship", "true");
    } else {
      root.removeAttribute("data-public-home-flagship");
    }

    const syncPublicTheme = () => {
      if (publicTheme === "sync") {
        const { style, palette } = resolveStoredPublicTheme();
        applyPublicThemeToElement(root, style, palette);
        return;
      }

      if (publicTheme === "clear") {
        clearPublicThemeFromElement(root);
      }
    };

    syncPublicTheme();

    if (publicTheme === "sync") {
      window.addEventListener(PUBLIC_THEME_CHANGE_EVENT, syncPublicTheme);
    }

    return () => {
      if (publicTheme === "sync") {
        window.removeEventListener(PUBLIC_THEME_CHANGE_EVENT, syncPublicTheme);
      }

      if (root.getAttribute("data-app-visual-mode") === visualMode) {
        root.removeAttribute("data-app-visual-mode");
      }

      if (
        publicHomeVariant === "cinematic" &&
        root.getAttribute("data-public-home-cinematic") === "true"
      ) {
        root.removeAttribute("data-public-home-cinematic");
      }

      if (
        publicHomeVariant === "flagship" &&
        root.getAttribute("data-public-home-flagship") === "true"
      ) {
        root.removeAttribute("data-public-home-flagship");
      }

      if (publicTheme) {
        clearPublicThemeFromElement(root);
      }

      if (
        typeof sidebarWidth === "string" &&
        root.style.getPropertyValue("--app-sidebar-width") === sidebarWidth
      ) {
        root.style.removeProperty("--app-sidebar-width");
      }

      if (
        typeof mobileSchoolSwitcherHeight === "string" &&
        root.style.getPropertyValue("--app-mobile-school-switcher-height") ===
          mobileSchoolSwitcherHeight
      ) {
        root.style.removeProperty("--app-mobile-school-switcher-height");
      }
    };
  }, [
    mobileSchoolSwitcherHeight,
    publicHomeVariant,
    publicTheme,
    sidebarWidth,
    visualMode,
  ]);

  return null;
}
