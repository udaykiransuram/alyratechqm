import type { ReactNode } from "react";

import StudentSessionMonitor from "@/components/student/StudentSessionMonitor";

type StudentLayoutProps = {
  children: ReactNode;
};

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <>
      <StudentSessionMonitor />
      {children}
    </>
  );
}
