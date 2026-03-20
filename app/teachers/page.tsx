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
    <div className="app-page-shell max-w-6xl px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Teachers"
        description="View and manage teacher accounts with the same workspace structure used across students and admins."
        actions={
          <Button asChild>
            <Link href="/teachers/create">Create Teacher</Link>
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
            value: String(teachers.length),
            meta: "Teachers loaded for the current school workspace.",
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

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Teacher workspace model</p>
          <h2 className="app-spotlight-title">
            Keep teacher access clear by class, section, and subject
          </h2>
          <p className="app-spotlight-copy">
            This page stays dedicated to teachers so admins can review access at
            a glance before opening the detail and edit flows.
          </p>
          <div className="app-flow-list">
            <div className="app-flow-item">
              <div className="app-flow-index">1</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Create the account</p>
                <p className="app-flow-note">
                  Add identity details and the initial teacher credential.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">2</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Scope the access</p>
                <p className="app-flow-note">
                  Limit classes, sections, and subjects to the teacher&apos;s real teaching area.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">3</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Review details</p>
                <p className="app-flow-note">
                  Use the detail page to confirm access before or after edits.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Quick notes</p>
          <h2 className="text-lg font-semibold text-foreground">
            What this list is optimized for
          </h2>
          <div className="mt-4 space-y-2">
            <div className="app-note-item">
              Teachers remain separate from students and admins so the access model stays readable.
            </div>
            <div className="app-note-item">
              The teacher detail page is the best place to review exact class, section, and subject scope.
            </div>
            <div className="app-note-item">
              Use the main user-management flow when you need password maintenance across roles.
            </div>
          </div>
        </div>
      </div>

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
              <span className="app-meta-chip">{teachers.length} teacher account{teachers.length === 1 ? "" : "s"}</span>
              <span className="app-meta-chip">Dedicated teacher pages kept</span>
            </div>
          </div>
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
