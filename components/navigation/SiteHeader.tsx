"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { isCompanyRoute } from "@/components/navigation/SiteHeaderShared";

const CompanySiteHeader = dynamic(
  () => import("@/components/navigation/CompanySiteHeader"),
);
const WorkspaceSiteHeader = dynamic(
  () => import("@/components/navigation/WorkspaceSiteHeader"),
);

export default function SiteHeader() {
  const pathname = usePathname() || "/workspace";

  if (isCompanyRoute(pathname)) {
    return <CompanySiteHeader pathname={pathname} />;
  }

  return <WorkspaceSiteHeader pathname={pathname} />;
}
