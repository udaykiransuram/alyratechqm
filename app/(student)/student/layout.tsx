import type { ReactNode } from "react";

import StudentPortalChrome from "@/components/student/StudentPortalChrome";
import StudentSessionMonitor from "@/components/student/StudentSessionMonitor";

type StudentLayoutProps = {
  children: ReactNode;
};

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <>
      <StudentSessionMonitor />
      <StudentPortalChrome />
      {children}
    </>
  );
}
