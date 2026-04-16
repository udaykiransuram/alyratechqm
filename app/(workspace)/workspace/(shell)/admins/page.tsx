import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Edit, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPaginationLinks from "@/components/ui/list-pagination-links";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import { buildHrefWithReturnTo } from "@/lib/navigation/returnTo";
import {
  buildWorkspaceListPageHref,
  getWorkspaceUserDirectoryPageData,
  requireWorkspaceStaffSession,
  resolveWorkspaceListPage,
} from "@/lib/server/workspace-user-directory";

const ADMINS_PAGE_SIZE = 25;
const ADMINS_BASE_PATH = "/workspace/admins";


type AdminsPageProps = {
  searchParams: Promise<{
    page?: string | string[];
  }>;
};

export default async function AdminsPage({
  searchParams,
}: AdminsPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedPage = resolveWorkspaceListPage(resolvedSearchParams?.page);
  const { schoolKey } = await requireWorkspaceStaffSession();

  let admins: Awaited<
    ReturnType<typeof getWorkspaceUserDirectoryPageData>
  >["users"] = [];
  let totalAdmins = 0;
  let page = requestedPage;
  let pages = 1;
  let error: string | null = null;

  try {
    const adminDirectory = await getWorkspaceUserDirectoryPageData({
      schoolKey,
      role: "admin",
      page: requestedPage,
      pageSize: ADMINS_PAGE_SIZE,
    });

    admins = adminDirectory.users;
    totalAdmins = adminDirectory.totalUsers;
    page = adminDirectory.page;
    pages = adminDirectory.pages;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load admins.";
  }

  const currentPath = buildWorkspaceListPageHref(ADMINS_BASE_PATH, page);
  const previousHref =
    page > 1 ? buildWorkspaceListPageHref(ADMINS_BASE_PATH, page - 1) : null;
  const nextHref =
    page < pages ? buildWorkspaceListPageHref(ADMINS_BASE_PATH, page + 1) : null;

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="directory"
        eyebrow="People"
        title="Admins"
        description="Review school admin accounts and keep high-access users on a dedicated, predictable management path."
        actions={
          <Button asChild className="app-button-page">
            <AppPrefetchLink
              href="/workspace/admins/create"
              prefetchOnMount
              relatedApiPrefetches={['/api/classes', '/api/sections', '/api/subjects']}
            >
              Create Admin
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Dedicated admin page</span>
            <span className="app-meta-chip">School-scoped access</span>
          </>
        }
        stats={[
          {
            label: "Admin accounts",
            value: String(totalAdmins),
            meta: "Admins available across all pages for the active school.",
          },
          {
            label: "Access model",
            value: "Configurable",
            meta: "Admins can keep full access or be limited by class, section, and subject.",
          },
          {
            label: "Navigation",
            value: "Dedicated",
            meta: "Admins remain separate from students and teachers for faster management.",
          },
          {
            label: "Management flow",
            value: "Create + View + Edit",
            meta: "Use this page for browsing while keeping detail and edit flows immediately available.",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Admin List</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          {error ? <div className="app-feedback app-feedback-error mb-4">{error}</div> : null}
          {!error && admins.length === 0 ? (
            <div className="app-empty-state">No admins found.</div>
          ) : !error ? (
            <div className="space-y-3">
              <ListPaginationLinks
                page={page}
                totalPages={pages}
                totalItems={totalAdmins}
                pageSize={ADMINS_PAGE_SIZE}
                itemLabel="admins"
                previousHref={previousHref}
                nextHref={nextHref}
              />
              <div className="space-y-2 md:hidden">
                {admins.map((admin) => (
                  <article
                    key={admin._id}
                    className="rounded-[1.05rem] border border-border/68 bg-background/90 px-3.5 py-3.5 shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {admin.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {admin.email || "No email"}
                          </p>
                        </div>
                        <Badge className="capitalize">{admin.role}</Badge>
                      </div>
                      <div className="rounded-lg border border-border/55 bg-background/72 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                          Phone
                        </p>
                        <p className="mt-1 text-sm text-foreground">
                          {admin.mobileNumber || "-"}
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="app-row-action-button app-row-action-button-accent w-full"
                        >
                          <AppPrefetchLink
                            href={buildHrefWithReturnTo(
                              `${ADMINS_BASE_PATH}/${admin._id}`,
                              currentPath,
                            )}
                            relatedApiPrefetches={[
                              `/api/users/${admin._id}`,
                              "/api/classes",
                              "/api/sections",
                              "/api/subjects",
                            ]}
                            aria-label={`View ${admin.name}`}
                            title="View admin"
                          >
                            <Eye className="h-4 w-4" />
                            View Admin
                          </AppPrefetchLink>
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="app-row-action-button w-full"
                        >
                          <AppPrefetchLink
                            href={buildHrefWithReturnTo(
                              `${ADMINS_BASE_PATH}/edit/${admin._id}`,
                              currentPath,
                            )}
                            relatedApiPrefetches={[
                              `/api/users/${admin._id}`,
                              "/api/classes",
                              "/api/sections",
                              "/api/subjects",
                            ]}
                            aria-label={`Edit ${admin.name}`}
                            title="Edit admin"
                          >
                            <Edit className="h-4 w-4" />
                            Edit Admin
                          </AppPrefetchLink>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden md:block app-table-wrap"><Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin._id}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell>{admin.email || "-"}</TableCell>
                      <TableCell>{admin.mobileNumber || "-"}</TableCell>
                      <TableCell>
                        <Badge className="capitalize">{admin.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="app-row-action-group justify-end">
                          <AppPrefetchLink
                            href={buildHrefWithReturnTo(
                              `${ADMINS_BASE_PATH}/${admin._id}`,
                              currentPath,
                            )}
                            relatedApiPrefetches={[
                              `/api/users/${admin._id}`,
                              '/api/classes',
                              '/api/sections',
                              '/api/subjects',
                            ]}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="app-row-action-button"
                              aria-label={`View ${admin.name}`}
                              title="View admin"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </AppPrefetchLink>
                          <AppPrefetchLink
                            href={buildHrefWithReturnTo(
                              `${ADMINS_BASE_PATH}/edit/${admin._id}`,
                              currentPath,
                            )}
                            relatedApiPrefetches={[
                              `/api/users/${admin._id}`,
                              '/api/classes',
                              '/api/sections',
                              '/api/subjects',
                            ]}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="app-row-action-button app-row-action-button-accent"
                              aria-label={`Edit ${admin.name}`}
                              title="Edit admin"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                          </AppPrefetchLink>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageShell>
  );
}
