"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface UserItem {
  _id: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  role: string;
  classIds?: string[];
  subjectIds?: string[];
  hasAllClasses?: boolean;
  hasAllSubjects?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ClassItem {
  _id: string;
  name: string;
}

interface SubjectItem {
  _id: string;
  name: string;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="app-detail-item">
      <div className="app-detail-label">{label}</div>
      <div className="app-detail-value">{value || "-"}</div>
    </div>
  );
}

export default function AdminDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserItem | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [uRes, cRes, sRes] = await Promise.all([
          fetch("/api/users/" + id),
          fetch("/api/classes"),
          fetch("/api/subjects"),
        ]);
        const uJson = await uRes.json();
        const cJson = await cRes.json();
        const sJson = await sRes.json();
        if (!mounted) return;
        if (!uJson.success) {
          throw new Error(uJson.message || "Failed to load admin");
        }
        setUser(uJson.user);
        setClasses(cJson.classes || []);
        setSubjects(sJson.subjects || []);
      } catch (e: any) {
        setError(e.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (id) load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const classNames = user?.hasAllClasses
    ? ["All Classes"]
    : (user?.classIds || []).map(
        (classId) => classes.find((c) => c._id === classId)?.name || classId,
      );

  const subjectNames = user?.hasAllSubjects
    ? ["All Subjects"]
    : (user?.subjectIds || []).map(
        (subjectId) =>
          subjects.find((s) => s._id === subjectId)?.name || subjectId,
      );

  return (
    <div className="container py-6 space-y-6">
      <div className="app-page-header-row">
        <div className="app-page-header">
          <h1 className="app-page-title">Admin Details</h1>
          <p className="app-page-subtitle">View admin profile and access settings.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/manage/users">
            <Button variant="outline">Back</Button>
          </Link>
          <Link href={`/admins/edit/${id}`}>
            <Button>Edit</Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="app-empty-state">Loading admin details...</div>
      ) : error ? (
        <div className="app-feedback app-feedback-error">{error}</div>
      ) : !user ? (
        <div className="app-empty-state">User not found.</div>
      ) : (
        <Card className="app-surface">
          <CardHeader className="app-section-header">
            <CardTitle className="text-xl font-semibold tracking-tight">{user.name}</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <div className="app-detail-grid">
              <DetailItem label="Email" value={user.email || "-"} />
              <DetailItem label="Phone" value={user.mobileNumber || "-"} />
              <DetailItem label="Classes Access" value={classNames.join(", ") || "-"} />
              <DetailItem label="Subjects Access" value={subjectNames.join(", ") || "-"} />
              <DetailItem
                label="Created"
                value={user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
              />
              <DetailItem
                label="Updated"
                value={user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "-"}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
