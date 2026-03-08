"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface ClassItem {
  _id: string;
  name: string;
}

interface SubjectItem {
  _id: string;
  name: string;
}

export default function EditAdminPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id as string) || "";

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    hasAllClasses: true,
    hasAllSubjects: true,
    classIds: [] as string[],
    subjectIds: [] as string[],
  });

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
        if (!uJson.success)
          throw new Error(uJson.message || "Failed to load admin");
        const u = uJson.user || {};
        setForm({
          name: u.name || "",
          email: u.email || "",
          password: "",
          mobileNumber: u.mobileNumber || "",
          hasAllClasses: Boolean(u.hasAllClasses),
          hasAllSubjects: Boolean(u.hasAllSubjects),
          classIds: (u.classIds || []).map(String),
          subjectIds: (u.subjectIds || []).map(String),
        });
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const toggleSelection = (field: "classIds" | "subjectIds", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
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
          role: "admin",
          email: form.email.trim(),
          mobileNumber: form.mobileNumber.trim(),
          password: form.password || undefined,
          hasAllClasses: form.hasAllClasses,
          hasAllSubjects: form.hasAllSubjects,
          classIds: form.hasAllClasses ? [] : form.classIds,
          subjectIds: form.hasAllSubjects ? [] : form.subjectIds,
        }),
      });
      const data = await res.json();
      if (!data.success)
        throw new Error(data.message || "Failed to update admin");
      setMessage("Admin updated successfully.");
      setTimeout(() => router.push("/admins/" + id), 600);
    } catch (e: any) {
      setError(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-page-shell max-w-2xl px-4 py-6 sm:px-0">
        <div className="app-feedback app-feedback-info">Loading admin details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page-shell max-w-2xl px-4 py-6 sm:px-0">
        <div className="app-feedback app-feedback-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="app-page-shell max-w-2xl px-4 py-6 sm:px-0">
      <div className="app-page-header-row">
        <div className="app-page-header">
          <h1 className="app-page-title">Edit Admin</h1>
          <p className="app-page-subtitle">
            Update admin profile details and refine class and subject access.
          </p>
        </div>
        <button type="button" onClick={() => router.push(`/admins/${id}`)} className="app-button-secondary">
          Back to Details
        </button>
      </div>

      <div className="app-surface app-surface-body">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="app-field-group">
            <label className="app-field-label" htmlFor="name">Name</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} required className="app-form-input" placeholder="Name" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="app-field-group">
              <label className="app-field-label" htmlFor="email">Email</label>
              <input id="email" name="email" value={form.email} onChange={handleChange} type="email" className="app-form-input" placeholder="Email" />
            </div>
            <div className="app-field-group">
              <label className="app-field-label" htmlFor="mobileNumber">Phone Number</label>
              <input id="mobileNumber" name="mobileNumber" value={form.mobileNumber} onChange={handleChange} required className="app-form-input" placeholder="Phone Number" />
            </div>
          </div>

          <div className="app-field-group">
            <label className="app-field-label" htmlFor="password">New Password</label>
            <input id="password" name="password" value={form.password} onChange={handleChange} type="password" className="app-form-input" placeholder="Leave blank to keep the current password" />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
            <input type="checkbox" name="hasAllClasses" checked={form.hasAllClasses} onChange={handleChange} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />
            <span>Access to all classes</span>
          </label>

          {!form.hasAllClasses && (
            <div className="app-field-group">
              <label className="app-field-label">Classes</label>
              <div className="app-selection-list">
                {classes.map((cls) => (
                  <label key={cls._id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={form.classIds.includes(cls._id)}
                      onChange={() => toggleSelection("classIds", cls._id)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <span>{cls.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
            <input type="checkbox" name="hasAllSubjects" checked={form.hasAllSubjects} onChange={handleChange} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />
            <span>Access to all subjects</span>
          </label>

          {!form.hasAllSubjects && (
            <div className="app-field-group">
              <label className="app-field-label">Subjects</label>
              <div className="app-selection-list">
                {subjects.map((subject) => (
                  <label key={subject._id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={form.subjectIds.includes(subject._id)}
                      onChange={() => toggleSelection("subjectIds", subject._id)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <span>{subject.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <button type="submit" disabled={saving} className="app-button-primary w-full">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {message ? <div className="app-feedback app-feedback-success">{message}</div> : null}
      </div>
    </div>
  );
}
