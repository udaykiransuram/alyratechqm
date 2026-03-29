"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  CurrentSchoolInfo,
  SidebarGroup,
} from "@/components/navigation/SiteHeaderShared";

const LazyMobileSidebarDialog = dynamic(
  () => import("@/components/navigation/SiteHeaderMobileSidebarDialog"),
  {
    ssr: false,
    loading: () => null,
  },
);

export default function DeferredSiteHeaderMobileSidebar({
  groups,
  school,
  showSchoolWorkspace,
  activePath,
  onNavigate,
}: {
  groups: SidebarGroup[];
  school?: CurrentSchoolInfo;
  showSchoolWorkspace: boolean;
  activePath: string;
  onNavigate: (href: string) => void;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="rounded-xl border-[hsl(var(--app-nav-border)/0.88)] bg-[hsl(var(--app-nav-chip-surface)/0.94)] text-[hsl(var(--app-nav-foreground))] hover:bg-[hsl(var(--app-nav-hover)/0.72)] hover:text-[hsl(var(--app-nav-foreground))] lg:hidden"
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseEnter={() => setMounted(true)}
        onFocus={() => setMounted(true)}
        onClick={() => {
          setMounted(true);
          setOpen(true);
        }}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>
      {mounted ? (
        <LazyMobileSidebarDialog
          open={open}
          onOpenChange={setOpen}
          groups={groups}
          school={school}
          showSchoolWorkspace={showSchoolWorkspace}
          activePath={activePath}
          onNavigate={onNavigate}
        />
      ) : null}
    </>
  );
}
