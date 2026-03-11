"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import PageLoadingState from "@/components/ui/page-loading-state";

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
      <div className="app-page-shell max-w-xl px-4 py-6 sm:px-0">
        <div className="app-feedback app-feedback-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-xl px-4 py-6 sm:px-0">
      <div className="app-page-header-row">
        <div className="app-page-header">
          <h1 className="app-page-title">Edit Student</h1>
          <p className="app-page-subtitle">
            Update student details, class placement, section assignment, and enrollment information.
          </p>
        </div>
        <button type="button" onClick={navigateBack} className="app-button-secondary">
          Back
        </button>
      </div>

      <div className="app-surface app-surface-body">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="app-field-group">
            <label className="app-field-label" htmlFor="name">Name</label>
            <input id="name" name="name" placeholder="Enter student name" value={form.name} onChange={handleChange} required className="app-form-input" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="app-field-group">
              <label className="app-field-label" htmlFor="email">Email</label>
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
              <label className="app-field-label" htmlFor="rollNumber">Roll Number</label>
              <input id="rollNumber" name="rollNumber" placeholder="Enter roll number" value={form.rollNumber} onChange={handleChange} required className="app-form-input" />
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

        {message ? <div className="app-feedback app-feedback-success">{message}</div> : null}
        {error ? <div className="app-feedback app-feedback-error">{error}</div> : null}
      </div>
    </div>
  );
}
