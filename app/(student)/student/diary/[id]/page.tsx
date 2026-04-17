import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import StudentDiaryDetailClient from "@/components/student/diary/StudentDiaryDetailClient";
import { authOptions } from "@/lib/auth";
import {
  assertSummerCrashStudentPageAccess,
} from "@/lib/server/summer-crash";
import { getStudentDiaryDetail } from "@/lib/server/diary";


type StudentDiaryDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentDiaryDetailPage({
  params,
}: StudentDiaryDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    session.user.accountType !== "school_user" ||
    session.user.role !== "student"
  ) {
    redirect("/auth/signin");
  }

  const schoolKey = String(session.user.schoolKey || "").trim();
  const studentId = String(session.user.id || "").trim();
  const { id } = await params;

  if (!schoolKey || !studentId) {
    redirect("/auth/signin");
  }

  const accessCheck = await assertSummerCrashStudentPageAccess({
    schoolKey,
    studentId,
    target: {
      kind: "locked-student-content",
    },
  });
  if (!accessCheck.allowed) {
    redirect(accessCheck.policy.redirectHref);
  }

  const entry = await getStudentDiaryDetail({
    schoolKey,
    entryId: id,
    studentId,
    studentPlacement: {
      classId: session.user.studentClassId,
      academicSectionId: session.user.studentAcademicSectionId,
    },
  });

  if (!entry) {
    redirect("/student/diary");
  }

  return <StudentDiaryDetailClient initialEntry={entry} />;
}
