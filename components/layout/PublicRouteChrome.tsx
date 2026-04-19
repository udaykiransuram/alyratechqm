"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ViewportHover from "@/components/ViewportHover";

const LITE_PUBLIC_ROUTE_PATTERNS = [
  /^\/summer-crash-course\/(?:register|signin|help)(?:\/|$)/,
  /^\/summer-crash-course\/payment(?:\/|$)/,
  /^\/summer-author\/signin(?:\/|$)/,
];

function isLitePublicRoute(pathname: string) {
  return LITE_PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));
}

export default function PublicRouteChrome({
  hideNavbar = false,
}: {
  hideNavbar?: boolean;
}) {
  const pathname = usePathname() || "/";
  const liteMode = isLitePublicRoute(pathname);

  useLayoutEffect(() => {
    document.body.classList.toggle("public-route-lite", liteMode);
    return () => {
      document.body.classList.remove("public-route-lite");
    };
  }, [liteMode]);

  return (
    <>
      {!hideNavbar && !liteMode ? <Navbar /> : null}
      {!liteMode ? <ViewportHover /> : null}
      {!liteMode ? <Footer /> : null}
    </>
  );
}
