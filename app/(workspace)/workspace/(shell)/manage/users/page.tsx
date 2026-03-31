import dynamicComponent from "next/dynamic";

import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";
import { getWorkspaceUserDirectoryPageData } from "@/lib/server/workspace-people";

export const dynamic = "force-dynamic";

const ManageUsersDirectoryClient = dynamicComponent(
  () => import("@/components/workspace/ManageUsersDirectoryClient"),
);

export default async function ManageUsersPage() {
  const { schoolKey } = await requireWorkspaceStaffSession();
  const initialPageData = await getWorkspaceUserDirectoryPageData({
    schoolKey,
    page: 1,
    limit: 100,
  });

  return (
    <ManageUsersDirectoryClient
      initialUsers={initialPageData.users.map((user) => ({
        ...user,
        role: user.role as "admin" | "teacher" | "student",
      }))}
      initialClasses={initialPageData.classes}
      initialSections={initialPageData.sections}
      initialSchoolKey={schoolKey}
      initialTotal={initialPageData.total}
      initialPage={initialPageData.page}
      initialPages={initialPageData.pages}
      initialListError={initialPageData.listError}
      initialSupportDataNotice={initialPageData.supportDataNotice}
    />
  );
}
