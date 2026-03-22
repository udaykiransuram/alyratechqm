"use client";

import { useEffect, useRef, useState } from "react";
import AppPrefetchLink from "@/components/navigation/AppPrefetchLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ListPagination from "@/components/ui/list-pagination";
import PageLoadingState from "@/components/ui/page-loading-state";
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
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";
import { fetchApiJson } from "@/lib/client/api";

interface TeacherUser {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: "teacher";
}

const TEACHERS_PAGE_SIZE = 25;
const TEACHERS_PAGE_CACHE_TTL_MS = 30_000;

type TeacherPageCacheEntry = {
  teachers: TeacherUser[];
  totalTeachers: number;
  pages: number;
  page: number;
  fetchedAt: number;
};

export default function TeachersPage() {
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/teachers");
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const pageCacheRef = useRef<Map<number, TeacherPageCacheEntry>>(new Map());
  const refreshing = loading && teachers.length > 0;

  useEffect(() => {
    let active = true;

    const applyCacheEntry = (entry: TeacherPageCacheEntry) => {
      if (!active) {
        return;
      }
      setTeachers(entry.teachers);
      setTotalTeachers(entry.totalTeachers);
      setPages(entry.pages);
      setPage(entry.page);
    };

    const prefetchTeachersPage = async (targetPage: number, totalPageCount: number) => {
      if (targetPage < 1 || targetPage > totalPageCount) {
        return;
      }

      const cachedEntry = pageCacheRef.current.get(targetPage);
      if (
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt < TEACHERS_PAGE_CACHE_TTL_MS
      ) {
        return;
      }

      try {
        const data = await fetchApiJson<any>(
          `/api/users?role=teacher&page=${targetPage}&limit=${TEACHERS_PAGE_SIZE}`,
          {
            cache: "no-store",
            fallbackMessage: "Failed to load teachers.",
          },
        );
        const resolvedPage = Math.max(1, Number(data.page) || targetPage);
        pageCacheRef.current.set(resolvedPage, {
          teachers: Array.isArray(data.users) ? data.users : [],
          totalTeachers: Math.max(0, Number(data.total) || 0),
          pages: Math.max(1, Number(data.pages) || 1),
          page: resolvedPage,
          fetchedAt: Date.now(),
        });
      } catch {
      }
    };

    const loadTeachers = async () => {
      const cachedEntry = pageCacheRef.current.get(page);
      const hasFreshCache =
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt < TEACHERS_PAGE_CACHE_TTL_MS;

      if (cachedEntry) {
        applyCacheEntry(cachedEntry);
        setError(null);
        if (hasFreshCache) {
          setLoading(false);
          void prefetchTeachersPage(page + 1, cachedEntry.pages);
          return;
        }
      }

      try {
        setLoading(true);
        if (!cachedEntry) {
          setError(null);
        }
        const data = await fetchApiJson<any>(
          `/api/users?role=teacher&page=${page}&limit=${TEACHERS_PAGE_SIZE}`,
          {
            cache: "no-store",
            fallbackMessage: "Failed to load teachers.",
          },
        );
        if (!active) {
          return;
        }
        const resolvedPage = Math.max(1, Number(data.page) || page);
        const nextEntry = {
          teachers: Array.isArray(data.users) ? data.users : [],
          totalTeachers: Math.max(0, Number(data.total) || 0),
          pages: Math.max(1, Number(data.pages) || 1),
          page: resolvedPage,
          fetchedAt: Date.now(),
        };
        pageCacheRef.current.set(resolvedPage, nextEntry);
        applyCacheEntry(nextEntry);
        void prefetchTeachersPage(resolvedPage + 1, nextEntry.pages);
      } catch (e: any) {
        if (!active || cachedEntry) {
          return;
        }
        setError(e.message || "Failed to load teachers");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadTeachers();

    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Teachers"
        description="View and manage teacher accounts with the same workspace structure used across students and admins."
        actions={
          <Button asChild>
            <AppPrefetchLink
              href="/workspace/teachers/create"
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
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
          </>
        }
        stats={[
          {
            label: "Teacher accounts",
            value: String(totalTeachers),
            meta: "Teachers available across all pages for the current school workspace.",
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
                Review teacher accounts for the active school workspace and open the dedicated detail page when you need the full scope breakdown.
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
          {loading && teachers.length === 0 ? (
            <PageLoadingState
              title="Loading teachers"
              description="Preparing teacher accounts and assigned access scopes."
              className="px-0 py-0"
              contentClassName="max-w-none"
              dense
            />
          ) : teachers.length === 0 ? (
            <div className="app-empty-state">No teachers found.</div>
          ) : (
            <div className="space-y-3">
              <ListPagination
                page={page}
                totalPages={pages}
                totalItems={totalTeachers}
                pageSize={TEACHERS_PAGE_SIZE}
                itemLabel="teachers"
                onPageChange={setPage}
                disabled={loading}
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
                              href={buildReturnHref(`/workspace/teachers/${teacher._id}`)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
