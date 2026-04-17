"use client";

import {
  createContext,
  useContext,
  type PropsWithChildren,
} from "react";

type StudentPortalAccessContextValue = {
  restrictedMode: boolean;
};

const StudentPortalAccessContext = createContext<StudentPortalAccessContextValue>(
  {
    restrictedMode: false,
  },
);

export function StudentPortalAccessProvider({
  restrictedMode = false,
  children,
}: PropsWithChildren<{ restrictedMode?: boolean }>) {
  return (
    <StudentPortalAccessContext.Provider value={{ restrictedMode }}>
      {children}
    </StudentPortalAccessContext.Provider>
  );
}

export function useStudentPortalAccess() {
  return useContext(StudentPortalAccessContext);
}
