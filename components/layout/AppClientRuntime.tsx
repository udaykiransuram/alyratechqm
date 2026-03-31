"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { resetPendingNavigationFeedback } from "@/lib/client/navigation-feedback";

export default function AppClientRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    document.documentElement.setAttribute("data-app-hydrated", "true");

    return () => {
      document.documentElement.removeAttribute("data-app-hydrated");
    };
  }, []);

  useEffect(() => {
    resetPendingNavigationFeedback();
  }, [pathname]);

  return null;
}
