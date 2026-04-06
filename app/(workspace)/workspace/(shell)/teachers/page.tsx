import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
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

const TEACHERS_PAGE_SIZE = 25;
const TEACHERS_BASE_PATH = "/workspace/teachers";


type TeachersPageProps = {
  searchParams: Promise<{
    page?: string | string[];
  }>;
};

export default async function TeachersPage({
  searchParams,
}: TeachersPageProps) {
  const resolvedSearchParams = await searchParams;
  const requestedPage = resolveWorkspaceListPage(resolvedSearchParams?.page);
  const { schoolKey } = await requireWorkspaceStaffSession();

  let teachers: Awaited<
    ReturnType<typeof getWorkspaceUserDirectoryPageData>
  >["users"] = [];
  let totalTeachers = 0;
  let page = requestedPage;
  let pages = 1;
  let error: string | null = null;

  try {
    const teacherDirectory = await getWorkspaceUserDirectoryPageData({
      schoolKey,
      role: "teacher",
      page: requestedPage,
      pageSize: TEACHERS_PAGE_SIZE,
    });

    teachers = teacherDirectory.users;
    totalTeachers = teacherDirectory.totalUsers;
    page = teacherDirectory.page;
    pages = teacherDirectory.pages;
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load teachers.";
  }

  const currentPath = buildWorkspaceListPageHref(TEACHERS_BASE_PATH, page);
  const previousHref =
    page > 1 ? buildWorkspaceListPageHref(TEACHERS_BASE_PATH, page - 1) : null;
  const nextHref =
    page < pages
      ? buildWorkspaceListPageHref(TEACHERS_BASE_PATH, page + 1)
      : null;

  return (
    <PageShell width="wide" padding="standard">
      <PageHero
        variant="directory"
        eyebrow="People"
        title="Teachers"
        description="View and manage teacher accounts with the same workspace structure used across students and admins."
        actions={
          <Button asChild className="app-button-page">
            <AppPrefetchLink
              href="/workspace/teachers/create"
              prefetchOnMount
              relatedApiPrefetches={['/api/classes', '/api/sections', '/api/subjects']}
            >
              Create Teacher
            </AppPrefetchLink>
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Dedicated teacher page</span>
            <span className="app-meta-chip">Scope-aware access</span>
          </>
        }
        stats={[
          {
            label: "Teacher accounts",
            value: String(totalTeachers),
            meta: "Teachers available across all pages for the current school.",
          },
          {
            label: "Access model",
            value: "Scoped",
            meta: "Teachers can be limited by class, section, and subject.",
          },
          {
            label: "Directory view",
            value: "Dedicated",
            meta: "Teachers keep their own page instead of being merged away.",
          },
          {
            label: "Management flow",
            value: "Create + View",
            meta: "Use this page for browsing and the form pages for full edits.",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Teacher Directory</CardTitle>
              <p className="text-sm leading-6 text-muted-foreground">
                Review teacher accounts for the active school and open the dedicated detail page when you need the full scope breakdown.
              </p>
            </div>
            <div className="app-chip-cloud">
              <span className="app-meta-chip">{totalTeachers} teacher account{totalTeachers === 1 ? "" : "s"}</span>
              <span className="app-meta-chip">Dedicated teacher pages kept</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="app-section-body">
          {error ? <div className="app-feedback app-feedback-error mb-4">{error}</div> : null}
          {!error && teachers.length === 0 ? (
            <div className="app-empty-state">No teachers found.</div>
          ) : !error ? (
            <div className="space-y-3">
              <ListPaginationLinks
                page={page}
                totalPages={pages}
                totalItems={totalTeachers}
                pageSize={TEACHERS_PAGE_SIZE}
                itemLabel="teachers"
                previousHref={previousHref}
                nextHref={nextHref}
              />
              <div className="app-table-wrap">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teachers.map((teacher) => (
                      <TableRow key={teacher._id}>
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div>{teacher.name}</div>
                            <div className="text-xs text-muted-foreground">
                              Teacher profile and scope review
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{teacher.email || "-"}</TableCell>
                        <TableCell>{teacher.mobileNumber || "-"}</TableCell>
                        <TableCell>
                          <Badge className="capitalize">{teacher.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild variant="outline" size="sm" className="app-button-compact">
                            <AppPrefetchLink
                              href={buildHrefWithReturnTo(
                                `${TEACHERS_BASE_PATH}/${teacher._id}`,
                                currentPath,
                              )}
                              relatedApiPrefetches={[
                                `/api/users/${teacher._id}`,
                                '/api/classes',
                                '/api/sections',
                                '/api/subjects',
                              ]}
                            >
                              View
                            </AppPrefetchLink>
                          </Button>
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
