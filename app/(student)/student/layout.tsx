import type { ReactNode } from "react";

import StudentPortalNav from "@/components/student/StudentPortalNav";
import StudentSessionMonitor from "@/components/student/StudentSessionMonitor";

type StudentLayoutProps = {
  children: ReactNode;
};

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <>
      <StudentSessionMonitor />
      <div className="app-student-portal-nav">
        <StudentPortalNav />
      </div>
      {children}
    </>
  );
}
