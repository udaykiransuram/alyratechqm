"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Menu, BarChart2, Users2, Upload, Layers } from "lucide-react";
import SchoolSwitcher from "@/components/navigation/SchoolSwitcher";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground",
      )}
    >
      {label}
    </Link>
  );
}

function getSchoolKey() {
  try {
    const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
    return m && m[1] ? m[1] : "";
  } catch {
    return "";
  }
}

export default function SiteHeader() {
  const router = useRouter();
  const [responseId, setResponseId] = useState("");
  const [paperId, setPaperId] = useState("");

  // Controls which nav popover is open; null means none is open
  const [openKey, setOpenKey] = useState<string | null>(null);

  const [schoolKey, setSchoolKey] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initialSchoolKey = getSchoolKey();
    setSchoolKey(initialSchoolKey);

    const handleCookieChange = () => {
      const newSchoolKey = getSchoolKey();
      setSchoolKey(newSchoolKey);
    };

    window.addEventListener("storage", handleCookieChange);
    return () => window.removeEventListener("storage", handleCookieChange);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent"
          >
            <Layers className="h-6 w-6" />
            <span className="font-bold tracking-tight">ALYRA TECH</span>
          </Link>
        </div>

        {/* Center: Desktop nav */}
        <nav className="hidden md:flex items-center gap-2 text-sm font-medium mx-3 flex-1 justify-center">
          <NavLink href="/" label="Home" />
          <NavLink href="/register" label="Register" />
          <NavLink href="/marketing" label="Product" />

          {/* Papers */}
          <Popover
            open={openKey === "papers"}
            onOpenChange={(v) => setOpenKey(v ? "papers" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              Papers
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-2"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col text-sm">
                <Link
                  href="/question-paper"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  All Papers
                </Link>
                <Link
                  href="/question-paper/create"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Create Paper
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          {/* Questions */}
          <Popover
            open={openKey === "questions"}
            onOpenChange={(v) => setOpenKey(v ? "questions" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              Questions
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-2"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col text-sm">
                <Link
                  href="/questions"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  All Questions
                </Link>
                <Link
                  href="/questions/create"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Create Question
                </Link>
                <Link
                  href="/questions/bulk-upload"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Bulk Upload
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          {/* Subjects */}
          <Popover
            open={openKey === "subjects"}
            onOpenChange={(v) => setOpenKey(v ? "subjects" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              Subjects
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-2"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col text-sm">
                <Link
                  href="/subjects"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  All Subjects
                </Link>
                <Link
                  href="/subjects/create"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Create Subject
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          {/* Tags */}
          <Popover
            open={openKey === "tags"}
            onOpenChange={(v) => setOpenKey(v ? "tags" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              Tags
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-2"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col text-sm">
                <Link
                  href="/tags"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  All Tags
                </Link>
                <Link
                  href="/tags/create"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Create Tag
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          {/* Students */}
          <Popover
            open={openKey === "students"}
            onOpenChange={(v) => setOpenKey(v ? "students" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              Students
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-2"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col text-sm">
                <Link
                  href="/students"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  All Students
                </Link>
                <Link
                  href="/students/create"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Create Student
                </Link>
              </div>
            </PopoverContent>
          </Popover>

          {/* Analytics */}
          <Popover
            open={openKey === "analytics"}
            onOpenChange={(v) => setOpenKey(v ? "analytics" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              <span className="inline-flex items-center gap-1">
                <BarChart2 className="h-4 w-4" /> Analytics
              </span>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-80 p-3"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col gap-3">
                <Link
                  href="/analytics/student-tag-report/excel-upload"
                  className="text-sm block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Upload Student Tag Excel
                </Link>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Student Tag Report
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!responseId.trim()) return;
                      router.push(
                        `/analytics/student-tag-report/${encodeURIComponent(responseId.trim())}`,
                      );
                      setResponseId("");
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={responseId}
                      onChange={(e) => setResponseId(e.target.value)}
                      placeholder="Enter responseId"
                      className="h-9"
                    />
                    <Button type="submit" size="sm">
                      Go
                    </Button>
                  </form>
                </div>
                <Separator className="my-2" />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Class Tag Report
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!paperId.trim()) return;
                      router.push(
                        `/analytics/class-tag-report/${encodeURIComponent(paperId.trim())}`,
                      );
                      setPaperId("");
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      value={paperId}
                      onChange={(e) => setPaperId(e.target.value)}
                      placeholder="Enter paperId"
                      className="h-9"
                    />
                    <Button type="submit" size="sm">
                      Go
                    </Button>
                  </form>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Manage */}
          <Popover
            open={openKey === "manage"}
            onOpenChange={(v) => setOpenKey(v ? "manage" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              <span className="inline-flex items-center gap-1">
                <Users2 className="h-4 w-4" /> Manage
              </span>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-3"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Classes</p>
                  <div className="flex flex-col">
                    <Link
                      href="/manage/classes"
                      className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                    >
                      All Classes
                    </Link>
                    <Link
                      href="/manage/classes/create"
                      className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                    >
                      Create Class
                    </Link>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Users</p>
                  <div className="flex flex-col">
                    <Link
                      href="/manage/users"
                      className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                    >
                      All Users
                    </Link>
                    <Link
                      href="/manage/users/create"
                      className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                    >
                      Create User
                    </Link>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Tools */}
          <Popover
            open={openKey === "tools"}
            onOpenChange={(v) => setOpenKey(v ? "tools" : null)}
          >
            <PopoverTrigger className="px-3 py-2 rounded-md transition-colors text-foreground/70 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
              <span className="inline-flex items-center gap-1">
                <Upload className="h-4 w-4" /> Tools
              </span>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-64 p-2"
              onClick={() => setOpenKey(null)}
            >
              <div className="flex flex-col text-sm">
                <Link
                  href="/upload"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Upload
                </Link>
                <Link
                  href="/upload/getjson"
                  className="block px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground"
                >
                  Get JSON
                </Link>
              </div>
            </PopoverContent>
          </Popover>
        </nav>

        {/* Right: Utilities */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          {/* Hide wide controls on mobile to prevent crowding; available inside menu */}
          <div className="hidden md:flex items-center gap-2">
            <SchoolSwitcher />
            <Button asChild>
              <Link href="/register">Register</Link>
            </Button>
          </div>

          {/* Mobile menu */}
          <Dialog>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md p-2 md:hidden border hover:bg-accent">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </DialogTrigger>
            {/* Make mobile menu full-screen on small screens for better layout */}
            <DialogContent className="p-0 inset-0 h-[100dvh] w-screen rounded-none translate-x-0 translate-y-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-full sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg">
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>Menu</DialogTitle>
              </DialogHeader>
              <div className="px-6 pb-6">
                <div className="flex flex-col gap-3 text-sm">
                  {/* School switcher for mobile view */}
                  <div className="pt-1">
                    <p className="text-xs text-muted-foreground mb-2">School</p>
                    <SchoolSwitcher />
                  </div>
                  <Separator className="my-2" />
                  <DialogClose asChild>
                    <Link
                      href="/"
                      className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                    >
                      Home
                    </Link>
                  </DialogClose>
                  <DialogClose asChild>
                    <Link
                      href="/register"
                      className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                    >
                      Register
                    </Link>
                  </DialogClose>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2">Papers</p>
                    <DialogClose asChild>
                      <Link
                        href="/question-paper"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        All Papers
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/question-paper/create"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Create Paper
                      </Link>
                    </DialogClose>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Questions
                    </p>
                    <DialogClose asChild>
                      <Link
                        href="/questions"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        All Questions
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/questions/create"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Create Question
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/questions/bulk-upload"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Bulk Upload
                      </Link>
                    </DialogClose>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Subjects
                    </p>
                    <DialogClose asChild>
                      <Link
                        href="/subjects"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        All Subjects
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/subjects/create"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Create Subject
                      </Link>
                    </DialogClose>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2">Tags</p>
                    <DialogClose asChild>
                      <Link
                        href="/tags"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        All Tags
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/tags/create"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Create Tag
                      </Link>
                    </DialogClose>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Students
                    </p>
                    <DialogClose asChild>
                      <Link
                        href="/students"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        All Students
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/students/create"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Create Student
                      </Link>
                    </DialogClose>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2 inline-flex items-center gap-1">
                      <BarChart2 className="h-4 w-4" /> Analytics
                    </p>
                    <DialogClose asChild>
                      <Link
                        href="/analytics/student-tag-report/excel-upload"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Upload Student Tag Excel
                      </Link>
                    </DialogClose>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Student Tag Report
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!responseId.trim()) return;
                          router.push(
                            `/analytics/student-tag-report/${encodeURIComponent(responseId.trim())}`,
                          );
                          setResponseId("");
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          value={responseId}
                          onChange={(e) => setResponseId(e.target.value)}
                          placeholder="responseId"
                          className="h-9"
                        />
                        <DialogClose asChild>
                          <Button type="submit" size="sm">
                            Go
                          </Button>
                        </DialogClose>
                      </form>
                    </div>
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Class Tag Report
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!paperId.trim()) return;
                          router.push(
                            `/analytics/class-tag-report/${encodeURIComponent(paperId.trim())}`,
                          );
                          setPaperId("");
                        }}
                        className="flex items-center gap-2"
                      >
                        <Input
                          value={paperId}
                          onChange={(e) => setPaperId(e.target.value)}
                          placeholder="paperId"
                          className="h-9"
                        />
                        <DialogClose asChild>
                          <Button type="submit" size="sm">
                            Go
                          </Button>
                        </DialogClose>
                      </form>
                    </div>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2 inline-flex items-center gap-1">
                      <Users2 className="h-4 w-4" /> Manage
                    </p>
                    <p className="text-xs text-muted-foreground">Classes</p>
                    <DialogClose asChild>
                      <Link
                        href="/manage/classes"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        All Classes
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/manage/classes/create"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Create Class
                      </Link>
                    </DialogClose>
                    <p className="text-xs text-muted-foreground mt-3">Users</p>
                    <DialogClose asChild>
                      <Link
                        href="/manage/users"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        All Users
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/manage/users/create"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Create User
                      </Link>
                    </DialogClose>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-muted-foreground mb-2 inline-flex items-center gap-1">
                      <Upload className="h-4 w-4" /> Tools
                    </p>
                    <DialogClose asChild>
                      <Link
                        href="/upload"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Upload
                      </Link>
                    </DialogClose>
                    <DialogClose asChild>
                      <Link
                        href="/upload/getjson"
                        className="py-2 px-3 rounded-md hover:bg-accent hover:text-accent-foreground block"
                      >
                        Get JSON
                      </Link>
                    </DialogClose>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {mounted && !schoolKey && (
        <div
          suppressHydrationWarning
          className="bg-yellow-100 p-2 text-center text-sm"
        >
          Please select a school in the navbar to access tenant-specific
          content.
        </div>
      )}
    </header>
  );
}
