"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import PageLoadingState from "@/components/ui/page-loading-state";
import { Button } from "@/components/ui/button";
import PageHero from "@/components/layout/PageHero";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ClassItem {
  _id: string;
  name: string;
}

interface AcademicSectionItem {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
}

function getSectionClassId(section: AcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

export default function EditStudentPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { navigateBack } = useBackNavigation(`/students/${id}`);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    class: "",
    academicSection: "",
    rollNumber: "",
    enrolledAt: "",
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [uRes, cRes, sRes] = await Promise.all([
          fetch("/api/users/" + id),
          fetch("/api/classes"),
          fetch("/api/sections"),
        ]);
        const uJson = await uRes.json();
        const cJson = await cRes.json();
        const sJson = await sRes.json();
        if (!mounted) return;
        if (!uJson.success) {
          throw new Error(uJson.message || "Failed to load user");
        }
        if (!cJson.success) {
          throw new Error(cJson.message || "Failed to load classes");
        }
        if (!sJson.success) {
          throw new Error(sJson.message || "Failed to load sections");
        }
        const user = uJson.user || {};
        setForm({
          name: user.name || "",
          email: user.email || "",
          password: "",
          mobileNumber: user.mobileNumber || "",
          class: user.class ? String(user.class) : "",
          academicSection: user.academicSection ? String(user.academicSection) : "",
          rollNumber: user.rollNumber || "",
          enrolledAt: user.enrolledAt
            ? new Date(user.enrolledAt).toISOString().split("T")[0]
            : "",
        });
        setClasses(cJson.classes || []);
        setSections(sJson.sections || []);
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

  const filteredSections = useMemo(
    () => sections.filter((section) => getSectionClassId(section) === form.class),
    [sections, form.class],
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "class" ? { academicSection: "" } : {}),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/users/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: "student",
          email: form.email.trim(),
          mobileNumber: form.mobileNumber.trim(),
          password: form.password || undefined,
          class: form.class,
          academicSection: form.academicSection,
          rollNumber: form.rollNumber.trim(),
          enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to update");
      setMessage("Student updated successfully.");
      setTimeout(() => navigateBack(), 600);
    } catch (e: any) {
      setError(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLoadingState
        title="Loading student details"
        description="Preparing the student edit form and section assignment options."
      />
    );
  }

  if (error) {
    return (
      <div className="app-page-shell max-w-xl px-4 py-5 sm:px-0">
        <div className="app-feedback app-feedback-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Edit Student"
        description="Update student identity, placement, and credentials from the same standardized school workspace used across all people management."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Details
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Student account</span>
            <span className="app-meta-chip">
              {form.rollNumber ? `Username: ${form.rollNumber}` : "Username pending"}
            </span>
          </>
        }
        stats={[
          {
            label: "Classes loaded",
            value: String(classes.length),
            meta: "Available class placements for this student.",
          },
          {
            label: "Visible sections",
            value: String(filteredSections.length),
            meta: "Sections available for the currently selected class.",
          },
          {
            label: "Form state",
            value: saving ? "Saving" : "Ready",
            meta: "Changes are applied to the current school tenant only.",
          },
          {
            label: "Password reset",
            value: "Manual",
            meta: "Use the roll number to restore the default password.",
          },
        ]}
      />

      {message ? <div className="app-feedback app-feedback-success">{message}</div> : null}
      {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Student Profile</CardTitle>
              <CardDescription>
                Update the student’s school placement, contact information, and sign-in credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="app-field-group">
                  <label className="app-field-label" htmlFor="name">Name</label>
                  <input id="name" name="name" placeholder="Enter student name" value={form.name} onChange={handleChange} required className="app-form-input" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="email">Email (Optional)</label>
                    <input id="email" name="email" placeholder="Enter email" value={form.email} onChange={handleChange} type="email" className="app-form-input" />
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="mobileNumber">Parent Mobile Number</label>
                    <input id="mobileNumber" name="mobileNumber" placeholder="Enter WhatsApp number" value={form.mobileNumber} onChange={handleChange} className="app-form-input" />
                  </div>
                </div>

                <div className="app-field-group">
                  <label className="app-field-label" htmlFor="password">New Password</label>
                  <input id="password" name="password" placeholder="Leave blank to keep the current password" value={form.password} onChange={handleChange} type="password" className="app-form-input" />
                  <p className="text-xs text-muted-foreground">
                    Enter the roll number here if you want to reset the student back to the default password.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="class">Class</label>
                    <select id="class" name="class" value={form.class} onChange={handleChange} required className="app-form-input">
                      <option value="">Select Class</option>
                      {classes.map((classItem) => (
                        <option key={classItem._id} value={classItem._id}>
                          {classItem.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="academicSection">Section</label>
                    <select
                      id="academicSection"
                      name="academicSection"
                      value={form.academicSection}
                      onChange={handleChange}
                      required
                      disabled={!form.class}
                      className="app-form-input"
                    >
                      <option value="">Select Section</option>
                      {filteredSections.map((section) => (
                        <option key={section._id} value={section._id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="rollNumber">Roll Number / Username</label>
                    <input id="rollNumber" name="rollNumber" placeholder="Enter roll number" value={form.rollNumber} onChange={handleChange} required className="app-form-input" />
                    <p className="text-xs text-muted-foreground">
                      Students sign in with this roll number as their username.
                    </p>
                  </div>
                </div>

                <div className="app-field-group">
                  <label className="app-field-label" htmlFor="enrolledAt">Enrollment Date</label>
                  <input id="enrolledAt" name="enrolledAt" value={form.enrolledAt} onChange={handleChange} type="date" className="app-form-input" />
                </div>

                <button type="submit" disabled={saving} className="app-button-primary w-full">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="app-editor-aside">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Credential Notes</CardTitle>
              <CardDescription>
                Keep the student portal behavior predictable after edits.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-note-list">
                <div className="app-note-item">
                  Roll number stays the username used at sign in.
                </div>
                <div className="app-note-item">
                  Changing class or section can change which tests appear on the student dashboard.
                </div>
                <div className="app-note-item">
                  Enter the roll number in the password field when you want to restore the default password.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
