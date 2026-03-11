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
import { useReturnHrefBuilder } from "@/hooks/useReturnNavigation";
import { fetchApiJson } from "@/lib/client/api";

interface TeacherUser {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: "teacher";
}

export default function TeachersPage() {
  const { buildReturnHref } = useReturnHrefBuilder("/teachers");
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        setLoading(true);
        const data = await fetchApiJson<any>("/api/users?role=teacher", {
          cache: "no-store",
          fallbackMessage: "Failed to load teachers.",
        });
        setTeachers(Array.isArray(data.users) ? data.users : []);
      } catch (e: any) {
        setError(e.message || "Failed to load teachers");
      } finally {
        setLoading(false);
      }
    };

    void loadTeachers();
  }, []);

  return (
    <div className="container py-6 space-y-6">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">Teachers</h1>
          <p className="app-page-subtitle">
            View and manage teachers.
          </p>
        </div>
        <Button asChild>
          <Link href="/teachers/create">Create Teacher</Link>
        </Button>
      </div>

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header">
          <CardTitle>Teacher List</CardTitle>
        </CardHeader>
        <CardContent className="app-section-body">
          {loading ? (
            <PageLoadingState
              title="Loading teachers"
              description="Preparing teacher accounts and assigned access scopes."
              className="px-0 py-0"
              contentClassName="max-w-none"
              dense
            />
          ) : error ? (
            <div className="app-feedback app-feedback-error">{error}</div>
          ) : teachers.length === 0 ? (
            <div className="app-empty-state">No teachers found.</div>
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
                {teachers.map((teacher) => (
                  <TableRow key={teacher._id}>
                    <TableCell className="font-medium">
                      {teacher.name}
                    </TableCell>
                    <TableCell>{teacher.email || "-"}</TableCell>
                    <TableCell>{teacher.mobileNumber || "-"}</TableCell>
                    <TableCell>
                      <Badge className="capitalize">{teacher.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={buildReturnHref(`/teachers/${teacher._id}`)}>View</Link>
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
