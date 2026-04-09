import { getTodayDiaryEntryDate } from "@/lib/diary/shared";
import { connectDB } from "@/lib/db";
import { listStudentDiaryEntries } from "@/lib/server/diary";
import { listStudentCourses } from "@/lib/server/student-courses";
import { getCachedStudentDashboardData } from "@/lib/server/student-dashboard-cache";
import { getStudentNotificationSnapshot } from "@/lib/server/student-notifications";
import { listStudentTestsData } from "@/lib/server/student-tests";

export type StudentDashboardData = {
  generatedAt: string;
  tests: {
    total: number;
    available: number;
    inProgress: number;
    upcoming: number;
    submitted: number;
    items: Array<{
      id: string;
      title: string;
      status: string;
      examDate: string | null;
      onlineStartsAt: string | null;
      onlineEndsAt: string | null;
      remainingTimeMs: number | null;
      href: string;
    }>;
  };
  courses: {
    total: number;
    inProgress: number;
    completed: number;
    dueSoon: number;
    items: Array<{
      id: string;
      title: string;
      status: string;
      availabilityStatus: string;
      completionPercent: number;
      dueAt: string | null;
      href: string;
    }>;
  };
  diary: {
    date: string;
    total: number;
    remaining: number;
    completed: number;
    items: Array<{
      id: string;
      title: string;
      entryDate: string;
      subjectName: string | null;
      status: string;
      href: string;
    }>;
  };
  notifications: {
    unreadCount: number;
    items: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      linkUrl: string;
      createdAt: string | null;
      readAt: string | null;
    }>;
  };
};

function toIsoOrNull(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sortDashboardCourses(left: any, right: any) {
  const statusRank = (value: string) => {
    if (value === "in_progress") return 0;
    if (value === "not_started") return 1;
    if (value === "completed") return 2;
    return 3;
  };

  const leftStatusRank = statusRank(String(left?.status || ""));
  const rightStatusRank = statusRank(String(right?.status || ""));
  if (leftStatusRank !== rightStatusRank) {
    return leftStatusRank - rightStatusRank;
  }

  const leftDueAt = left?.metadata?.dueAt
    ? new Date(left.metadata.dueAt).getTime()
    : Number.POSITIVE_INFINITY;
  const rightDueAt = right?.metadata?.dueAt
    ? new Date(right.metadata.dueAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (leftDueAt !== rightDueAt) {
    return leftDueAt - rightDueAt;
  }

  return String(left?.title || "").localeCompare(String(right?.title || ""));
}

function isCourseDueSoon(value: unknown, now: Date) {
  const dueAt = value ? new Date(String(value)) : null;
  if (!dueAt || Number.isNaN(dueAt.getTime())) {
    return false;
  }

  const diffMs = dueAt.getTime() - now.getTime();
  return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;
}

export async function getStudentDashboardData(params: {
  schoolKey: string;
  studentId: string;
  studentPlacement?: {
    classId?: string | null;
    academicSectionId?: string | null;
  } | null;
  skipCache?: boolean;
}) {
  return getCachedStudentDashboardData<StudentDashboardData>({
    schoolKey: params.schoolKey,
    studentId: params.studentId,
    skipCache: params.skipCache,
    loader: async () => {
      await connectDB();
      const now = new Date();
      const diaryDate = getTodayDiaryEntryDate();
      const studentPlacement = params.studentPlacement || {};
      const [tests, courses, diaryEntries, notificationSnapshot] =
        await Promise.all([
          listStudentTestsData({
            schoolKey: params.schoolKey,
            studentId: params.studentId,
            studentPlacement,
            autoSubmitExpiredAttempts: false,
            now,
          }),
          listStudentCourses({
            schoolKey: params.schoolKey,
            studentId: params.studentId,
            studentPlacement,
          }),
          listStudentDiaryEntries({
            schoolKey: params.schoolKey,
            studentId: params.studentId,
            studentPlacement,
            filters: {
              entryDate: diaryDate,
            },
          }),
          getStudentNotificationSnapshot({
            schoolKey: params.schoolKey,
            studentId: params.studentId,
            limit: 6,
          }),
        ]);

      const sortedCourses = [...courses].sort(sortDashboardCourses);

      return {
        generatedAt: now.toISOString(),
        tests: {
          total: tests.length,
          available: tests.filter((item) => item.status === "available").length,
          inProgress: tests.filter((item) => item.status === "in_progress")
            .length,
          upcoming: tests.filter((item) => item.status === "upcoming").length,
          submitted: tests.filter(
            (item) =>
              item.status === "submitted" || item.status === "auto_submitted",
          ).length,
          items: tests.slice(0, 4).map((item) => ({
            id: String(item?._id || ""),
            title: String(item?.title || "").trim(),
            status: String(item?.status || "available"),
            examDate: toIsoOrNull(item?.examDate),
            onlineStartsAt: toIsoOrNull(item?.onlineStartsAt),
            onlineEndsAt: toIsoOrNull(item?.onlineEndsAt),
            remainingTimeMs:
              typeof item?.remainingTimeMs === "number" &&
              Number.isFinite(item.remainingTimeMs)
                ? item.remainingTimeMs
                : null,
            href: `/student/tests/${item?._id}`,
          })),
        },
        courses: {
          total: courses.length,
          inProgress: courses.filter((item) => item.status === "in_progress")
            .length,
          completed: courses.filter((item) => item.status === "completed")
            .length,
          dueSoon: courses.filter(
            (item) =>
              item.status !== "completed" &&
              isCourseDueSoon(item?.metadata?.dueAt, now),
          ).length,
          items: sortedCourses.slice(0, 4).map((item) => ({
            id: String(item?._id || ""),
            title: String(item?.title || "").trim(),
            status: String(item?.status || "not_started"),
            availabilityStatus: String(
              item?.availabilityStatus || "available",
            ),
            completionPercent: Number(item?.completionPercent || 0),
            dueAt: toIsoOrNull(item?.metadata?.dueAt),
            href: `/student/courses/${item?._id}`,
          })),
        },
        diary: {
          date: diaryDate,
          total: diaryEntries.length,
          remaining: diaryEntries.filter(
            (item) => item.state.status !== "completed",
          ).length,
          completed: diaryEntries.filter(
            (item) => item.state.status === "completed",
          ).length,
          items: diaryEntries.slice(0, 5).map((item) => ({
            id: String(item?._id || ""),
            title: String(item?.title || "").trim(),
            entryDate: String(item?.entryDate || diaryDate),
            subjectName: item?.subject?.name
              ? String(item.subject.name)
              : null,
            status: String(item?.state?.status || "not_seen"),
            href: `/student/diary/${item?._id}`,
          })),
        },
        notifications: {
          unreadCount: Number(notificationSnapshot?.unreadCount || 0),
          items: Array.isArray(notificationSnapshot?.notifications)
            ? notificationSnapshot.notifications.map((item) => ({
                id: String(item?.id || ""),
                type: String(item?.type || ""),
                title: String(item?.title || ""),
                message: String(item?.message || ""),
                linkUrl: String(item?.linkUrl || ""),
                createdAt: toIsoOrNull(item?.createdAt),
                readAt: toIsoOrNull(item?.readAt),
              }))
            : [],
        },
      } satisfies StudentDashboardData;
    },
  });
}
