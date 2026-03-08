"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TeacherUser {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: "teacher";
}

function getSchoolKeyFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTeachers = async () => {
      try {
        setLoading(true);
        const schoolKey = getSchoolKeyFromCookie();
        const url =
          "/api/users?role=teacher" +
          (schoolKey ? `&school=${encodeURIComponent(schoolKey)}` : "");
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (!data.success)
          throw new Error(data.message || "Failed to load teachers");
        setTeachers(data.users || []);
      } catch (e: any) {
        setError(e.message || "Failed to load teachers");
      } finally {
        setLoading(false);
      }
    };

    loadTeachers();
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
            <div className="app-empty-state">Loading teachers...</div>
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
                        <Link href={`/teachers/${teacher._id}`}>View</Link>
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
