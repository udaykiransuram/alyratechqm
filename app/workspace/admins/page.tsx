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

interface AdminUser {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: "admin";
}

const ADMINS_PAGE_SIZE = 25;
const ADMINS_PAGE_CACHE_TTL_MS = 30_000;

type AdminPageCacheEntry = {
  admins: AdminUser[];
  totalAdmins: number;
  pages: number;
  page: number;
  fetchedAt: number;
};

export default function AdminsPage() {
  const { buildReturnHref } = useReturnHrefBuilder("/workspace/admins");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [totalAdmins, setTotalAdmins] = useState(0);
  const pageCacheRef = useRef<Map<number, AdminPageCacheEntry>>(new Map());
  const refreshing = loading && admins.length > 0;

  useEffect(() => {
    let active = true;

    const applyCacheEntry = (entry: AdminPageCacheEntry) => {
      if (!active) {
        return;
      }
      setAdmins(entry.admins);
      setTotalAdmins(entry.totalAdmins);
      setPages(entry.pages);
      setPage(entry.page);
    };

    const prefetchAdminsPage = async (targetPage: number, totalPageCount: number) => {
      if (targetPage < 1 || targetPage > totalPageCount) {
        return;
      }

      const cachedEntry = pageCacheRef.current.get(targetPage);
      if (
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt < ADMINS_PAGE_CACHE_TTL_MS
      ) {
        return;
      }

      try {
        const data = await fetchApiJson<any>(
          `/api/users?role=admin&page=${targetPage}&limit=${ADMINS_PAGE_SIZE}`,
          {
            cache: "no-store",
            fallbackMessage: "Failed to load admins.",
          },
        );
        const resolvedPage = Math.max(1, Number(data.page) || targetPage);
        pageCacheRef.current.set(resolvedPage, {
          admins: Array.isArray(data.users) ? data.users : [],
          totalAdmins: Math.max(0, Number(data.total) || 0),
          pages: Math.max(1, Number(data.pages) || 1),
          page: resolvedPage,
          fetchedAt: Date.now(),
        });
      } catch {
      }
    };

    const loadAdmins = async () => {
      const cachedEntry = pageCacheRef.current.get(page);
      const hasFreshCache =
        cachedEntry &&
        Date.now() - cachedEntry.fetchedAt < ADMINS_PAGE_CACHE_TTL_MS;

      if (cachedEntry) {
        applyCacheEntry(cachedEntry);
        setError(null);
        if (hasFreshCache) {
          setLoading(false);
          void prefetchAdminsPage(page + 1, cachedEntry.pages);
          return;
        }
      }

      try {
        setLoading(true);
        if (!cachedEntry) {
          setError(null);
        }
        const data = await fetchApiJson<any>(
          `/api/users?role=admin&page=${page}&limit=${ADMINS_PAGE_SIZE}`,
          {
            cache: "no-store",
            fallbackMessage: "Failed to load admins.",
          },
        );
        if (!active) {
          return;
        }
        const resolvedPage = Math.max(1, Number(data.page) || page);
        const nextEntry = {
          admins: Array.isArray(data.users) ? data.users : [],
          totalAdmins: Math.max(0, Number(data.total) || 0),
          pages: Math.max(1, Number(data.pages) || 1),
          page: resolvedPage,
          fetchedAt: Date.now(),
        };
        pageCacheRef.current.set(resolvedPage, nextEntry);
        applyCacheEntry(nextEntry);
        void prefetchAdminsPage(resolvedPage + 1, nextEntry.pages);
      } catch (e: any) {
        if (!active || cachedEntry) {
          return;
        }
        setError(e.message || "Failed to load admins");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadAdmins();

    return () => {
      active = false;
    };
  }, [page]);

  return (
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Admins"
        description="Review school admin accounts and keep high-access users on a dedicated, predictable management path."
        actions={
          <Button asChild>
            <AppPrefetchLink
              href="/workspace/admins/create"
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
            {refreshing ? <span className="app-meta-chip">Refreshing...</span> : null}
          </>
        }
        stats={[
          {
            label: "Admin accounts",
            value: String(totalAdmins),
            meta: "Admins available across all pages for the active school workspace.",
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
            value: "Create + View",
            meta: "Use this page for browsing and the detail flow for edits.",
          },
        ]}
      />

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Admin List</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          {error ? <div className="app-feedback app-feedback-error mb-4">{error}</div> : null}
          {loading && admins.length === 0 ? (
            <PageLoadingState
              title="Loading admins"
              description="Preparing admin accounts and access information."
              className="px-0 py-0"
              contentClassName="max-w-none"
              dense
            />
          ) : admins.length === 0 ? (
            <div className="app-empty-state">No admins found.</div>
          ) : (
            <div className="space-y-3">
              <ListPagination
                page={page}
                totalPages={pages}
                totalItems={totalAdmins}
                pageSize={ADMINS_PAGE_SIZE}
                itemLabel="admins"
                onPageChange={setPage}
                disabled={loading}
              />
              <div className="app-table-wrap"><Table>
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
                  {admins.map((admin) => (
                    <TableRow key={admin._id}>
                      <TableCell className="font-medium">{admin.name}</TableCell>
                      <TableCell>{admin.email || "-"}</TableCell>
                      <TableCell>{admin.mobileNumber || "-"}</TableCell>
                      <TableCell>
                        <Badge className="capitalize">{admin.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm" className="app-button-compact">
                          <AppPrefetchLink
                            href={buildReturnHref(`/workspace/admins/${admin._id}`)}
                            relatedApiPrefetches={[
                              `/api/users/${admin._id}`,
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
