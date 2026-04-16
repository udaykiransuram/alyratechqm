"use client";

import { usePathname } from "next/navigation";

import StudentPortalNav from "@/components/student/StudentPortalNav";
import StudentPortalSidebar from "@/components/student/StudentPortalSidebar";
import { shouldHideStudentChrome } from "@/components/student/student-route-chrome";

export default function StudentPortalChrome() {
  const pathname = usePathname();

  if (shouldHideStudentChrome(pathname)) {
    return null;
  }

  return (
    <>
      <div className="app-student-mobile-nav">
        <StudentPortalNav variant="mobile" />
      </div>
      <StudentPortalSidebar />
    </>
  );
}
