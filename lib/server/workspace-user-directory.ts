import { cache } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { buildArchiveFilter } from "@/lib/archive";
import { getDefaultRouteForRole } from "@/lib/auth-types";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getTenantModels } from "@/lib/db-tenant";
import { canonicalizeAppPath } from "@/lib/navigation/canonical-paths";

export type WorkspaceDirectoryRole = "admin" | "teacher";

export type WorkspaceDirectoryUser = {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: WorkspaceDirectoryRole;
};

export type WorkspaceDirectoryPageData = {
  users: WorkspaceDirectoryUser[];
  totalUsers: number;
  page: number;
  pages: number;
  pageSize: number;
};

type GetWorkspaceUserDirectoryPageDataOptions = {
  schoolKey: string;
  role: WorkspaceDirectoryRole;
  page?: number;
  pageSize?: number;
};

type RawWorkspaceDirectoryUser = {
  _id: unknown;
  name?: unknown;
  email?: unknown;
  mobileNumber?: unknown;
  role?: unknown;
};

export const requireWorkspaceStaffSession = cache(async () => {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const accountType = session?.user?.accountType;

  if (!session?.user?.id || !role || !accountType) {
    redirect("/auth/signin");
  }

  if (accountType !== "school_user") {
    redirect(getDefaultRouteForRole(role));
  }

  if (role !== "admin" && role !== "teacher") {
    redirect(getDefaultRouteForRole(role));
  }

  const schoolKey = String(session.user.schoolKey || "").trim();
  if (!schoolKey) {
    redirect("/auth/signin");
  }

  return {
    schoolKey,
    viewerRole: role,
    viewerId: String(session.user.id || "").trim(),
  };
});

export function resolveWorkspaceListPage(
  value: string | string[] | number | undefined,
) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const resolvedValue =
    typeof rawValue === "number" ? rawValue : Number(rawValue || "");

  if (!Number.isFinite(resolvedValue) || resolvedValue < 1) {
    return 1;
  }

  return Math.floor(resolvedValue);
}

export function buildWorkspaceListPageHref(basePath: string, page: number) {
  const canonicalBasePath = canonicalizeAppPath(basePath);
  const safePage = resolveWorkspaceListPage(page);

  if (safePage <= 1) {
    return canonicalBasePath;
  }

  const [pathWithQuery, hashFragment = ""] = canonicalBasePath.split("#");
  const [pathname, existingQuery = ""] = pathWithQuery.split("?");
  const searchParams = new URLSearchParams(existingQuery);
  searchParams.set("page", String(safePage));

  const query = searchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}${hashFragment ? `#${hashFragment}` : ""}`;
}

export async function getWorkspaceUserDirectoryPageData({
  schoolKey,
  role,
  page = 1,
  pageSize = 25,
}: GetWorkspaceUserDirectoryPageDataOptions): Promise<WorkspaceDirectoryPageData> {
  const requestedPage = resolveWorkspaceListPage(page);
  const safePageSize = Math.min(Math.max(pageSize, 1), 100);

  await connectDB();
  const { User: UserModel } = await getTenantModels(schoolKey, ["User"]);

  const query = {
    role,
    ...buildArchiveFilter(false),
  };

  const totalUsers = await UserModel.countDocuments(query);
  const pages = Math.max(1, Math.ceil(totalUsers / safePageSize));
  const safePage = Math.min(requestedPage, pages);

  const rawUsers = (await UserModel.find(query)
    .select("_id name email mobileNumber role")
    .sort({ name: 1, _id: 1 })
    .skip((safePage - 1) * safePageSize)
    .limit(safePageSize)
    .lean()) as RawWorkspaceDirectoryUser[];

  const users = rawUsers.map((user) => ({
    _id: String(user._id),
    name: String(user.name || "").trim(),
    email: user.email ? String(user.email).trim() : undefined,
    mobileNumber: user.mobileNumber ? String(user.mobileNumber).trim() : undefined,
    role: role,
  }));

  return {
    users,
    totalUsers,
    page: safePage,
    pages,
    pageSize: safePageSize,
  };
}
