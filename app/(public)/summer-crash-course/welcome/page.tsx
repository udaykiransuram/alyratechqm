import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import SummerCrashWelcomeClient from "@/components/summer-crash/SummerCrashWelcomeClient";
import { authOptions } from "@/lib/auth";
import { getSummerCrashStudentState } from "@/lib/server/summer-crash";
import {
  SUMMER_CRASH_SIGNIN_PATH,
} from "@/lib/summer-crash/constants";
import { isSummerCrashSession } from "@/lib/summer-crash/shared";

export const metadata: Metadata = {
  title: "Welcome | Summer Crash Course",
  description: "Complete the first Summer Crash Course sign-in setup.",
};

export default async function SummerCrashWelcomePage() {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !isSummerCrashSession({
      accountType: session.user.accountType,
      role: session.user.role,
      schoolKey: session.user.schoolKey,
    })
  ) {
    redirect(SUMMER_CRASH_SIGNIN_PATH);
  }

  const state = await getSummerCrashStudentState({
    schoolKey: String(session.user.schoolKey || ""),
    studentId: String(session.user.id || ""),
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
  });

  if (!state.requiresPasswordSetup) {
    redirect(state.destinationHref);
  }

  return (
    <div className="public-flow-page">
      <div className="public-flow-shell-narrow">
        <SummerCrashWelcomeClient
          title={state.title}
          supportContact={state.supportContact}
          studentName={state.studentName}
          guardianName={state.guardianName}
          classBand={state.classBand}
          summerId={state.summerId}
          courseTitle={
            state.courses.length === 1
              ? state.courses[0].title
              : "Summer Crash Course"
          }
        />
      </div>
    </div>
  );
}
