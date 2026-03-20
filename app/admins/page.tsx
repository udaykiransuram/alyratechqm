"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function AdminsPage() {
  const { buildReturnHref } = useReturnHrefBuilder("/admins");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAdmins = async () => {
      try {
        setLoading(true);
        const data = await fetchApiJson<any>("/api/users?role=admin", {
          cache: "no-store",
          fallbackMessage: "Failed to load admins.",
        });
        setAdmins(Array.isArray(data.users) ? data.users : []);
      } catch (e: any) {
        setError(e.message || "Failed to load admins");
      } finally {
        setLoading(false);
      }
    };

    void loadAdmins();
  }, []);

  return (
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Admins"
        description="Review school admin accounts and keep high-access users on a dedicated, predictable management path."
        actions={
          <Button asChild>
            <Link href="/admins/create">Create Admin</Link>
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
            value: String(admins.length),
            meta: "Admins loaded for the active school workspace.",
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
          {loading ? (
            <PageLoadingState
              title="Loading admins"
              description="Preparing admin accounts and access information."
              className="px-0 py-0"
              contentClassName="max-w-none"
              dense
            />
          ) : error ? (
            <div className="app-feedback app-feedback-error">{error}</div>
          ) : admins.length === 0 ? (
            <div className="app-empty-state">No admins found.</div>
          ) : (
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
                      <Button asChild variant="outline" size="sm">
                        <Link href={buildReturnHref(`/admins/${admin._id}`)}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
