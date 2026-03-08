"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface ClassItem {
  _id: string;
  name: string;
}

export default function EditStudentPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [classes, setClasses] = useState<ClassItem[]>([]);
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
    rollNumber: "",
    enrolledAt: "",
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [uRes, cRes] = await Promise.all([
          fetch("/api/users/" + id),
          fetch("/api/classes"),
        ]);
        const uJson = await uRes.json();
        const cJson = await cRes.json();
        if (!mounted) return;
        if (!uJson.success)
          throw new Error(uJson.message || "Failed to load user");
        if (!cJson.success)
          throw new Error(cJson.message || "Failed to load classes");
        const u = uJson.user || {};
        setForm({
          name: u.name || "",
          email: u.email || "",
          password: "",
          mobileNumber: u.mobileNumber || "",
          class: u.class ? String(u.class) : "",
          rollNumber: u.rollNumber || "",
          enrolledAt: u.enrolledAt
            ? new Date(u.enrolledAt).toISOString().split("T")[0]
            : "",
        });
        setClasses(cJson.classes || []);
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
          rollNumber: form.rollNumber.trim(),
          enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to update");
      setMessage("Student updated successfully.");
      setTimeout(() => router.push("/students/" + id), 600);
    } catch (e: any) {
      setError(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-page-shell max-w-xl px-4 py-6 sm:px-0">
        <div className="app-feedback app-feedback-info">Loading student details...</div>
      </div>
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
            Update student details, class placement, and enrollment information.
          </p>
        </div>
        <button type="button" onClick={() => router.back()} className="app-button-secondary">
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

          <div className="grid gap-4 md:grid-cols-2">
            <div className="app-field-group">
              <label className="app-field-label" htmlFor="class">Class</label>
              <select id="class" name="class" value={form.class} onChange={handleChange} required className="app-form-input">
                <option value="">Select Class</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name}
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
