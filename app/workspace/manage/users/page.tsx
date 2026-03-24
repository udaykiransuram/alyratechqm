import ManageUsersDirectoryClient from "@/components/workspace/ManageUsersDirectoryClient";
import { requireWorkspaceStaffSession } from "@/lib/server/workspace-user-directory";

export const dynamic = "force-dynamic";

export default async function ManageUsersPage() {
  await requireWorkspaceStaffSession();
  return <ManageUsersDirectoryClient />;
}
