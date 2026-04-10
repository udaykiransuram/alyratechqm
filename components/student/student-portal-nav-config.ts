import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  ClipboardCheck,
  House,
  NotebookText,
  UserRound,
  Video,
} from "lucide-react";

export type StudentPortalNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  matchers?: string[];
};

export const STUDENT_PORTAL_ITEMS: StudentPortalNavItem[] = [
  {
    href: "/student",
    label: "Home",
    description: "Overview, reminders, and quick actions.",
    icon: House,
  },
  {
    href: "/student/tests",
    label: "Tests",
    description: "Start, resume, and review assessments.",
    icon: ClipboardCheck,
  },
  {
    href: "/student/courses",
    label: "Courses",
    description: "Continue lessons and linked learning paths.",
    icon: BookOpenText,
  },
  {
    href: "/student/live-classes",
    label: "Live Classes",
    description: "Join scheduled sessions and review meeting details.",
    icon: Video,
  },
  {
    href: "/student/diary",
    label: "Diary",
    description: "Daily work, homework, and teacher notes.",
    icon: NotebookText,
  },
  {
    href: "/student/account",
    label: "Account",
    description: "Profile, password, and report access.",
    icon: UserRound,
    matchers: ["/student/reports"],
  },
];

export function isStudentPortalItemActive(
  pathname: string,
  item: StudentPortalNavItem,
) {
  const normalizedPathname = String(pathname || "").trim() || "/student";
  const candidates = [item.href, ...(item.matchers || [])];

  return candidates.some((candidate) => {
    const normalizedCandidate = String(candidate || "").trim();
    if (!normalizedCandidate) {
      return false;
    }

    if (normalizedCandidate === "/student") {
      return normalizedPathname === normalizedCandidate;
    }

    return (
      normalizedPathname === normalizedCandidate ||
      normalizedPathname.startsWith(`${normalizedCandidate}/`)
    );
  });
}

export function getActiveStudentPortalItem(pathname: string) {
  return (
    STUDENT_PORTAL_ITEMS.find((item) =>
      isStudentPortalItemActive(pathname, item),
    ) || STUDENT_PORTAL_ITEMS[0]
  );
}
