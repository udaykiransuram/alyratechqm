"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function getSchoolKeyFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

interface ClassItem {
  _id: string;
  name: string;
}

interface SubjectItem {
  _id: string;
  name: string;
}

export default function CreateTeacherPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    classIds: [] as string[],
    subjectIds: [] as string[],
  });
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const schoolQuery = getSchoolKeyFromCookie()
      ? `?school=${getSchoolKeyFromCookie()}`
      : "";

    Promise.all([
      fetch(`/api/classes${schoolQuery}`),
      fetch(`/api/subjects${schoolQuery}`),
    ])
      .then(async ([classesRes, subjectsRes]) => {
        const classesData = await classesRes.json();
        const subjectsData = await subjectsRes.json();
        if (classesData.success) setClasses(classesData.classes || []);
        if (subjectsData.success) setSubjects(subjectsData.subjects || []);
      })
      .catch(() => {
        setMessage("Failed to load classes or subjects.");
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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
    setLoading(true);
    setMessage(null);

    const res = await fetch(
      "/api/users" +
        (getSchoolKeyFromCookie() ? `?school=${getSchoolKeyFromCookie()}` : ""),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: "teacher",
        }),
      },
    );

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setMessage("Teacher created successfully!");
      setForm({
        name: "",
        email: "",
        password: "",
        mobileNumber: "",
        classIds: [],
        subjectIds: [],
      });
      setTimeout(() => router.push("/manage/users"), 800);
    } else {
      setMessage(data.message || "Error creating teacher");
    }
  };

  const messageClassName = message?.toLowerCase().includes("error") ||
    message?.toLowerCase().includes("failed")
    ? "app-feedback app-feedback-error"
    : "app-feedback app-feedback-success";

  return (
    <div className="app-page-shell max-w-2xl px-4 py-6 sm:px-0">
      <div className="app-page-header">
        <h1 className="app-page-title">Create Teacher</h1>
        <p className="app-page-subtitle">
          Create a teacher profile and assign classes and subject access in one workflow.
        </p>
      </div>

      <div className="app-surface app-surface-body">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="app-field-group">
            <label className="app-field-label" htmlFor="name">Name</label>
            <input id="name" name="name" placeholder="Enter name" value={form.name} onChange={handleChange} required className="app-form-input" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="app-field-group">
              <label className="app-field-label" htmlFor="email">Email</label>
              <input id="email" name="email" placeholder="Enter email" value={form.email} onChange={handleChange} type="email" className="app-form-input" />
            </div>
            <div className="app-field-group">
              <label className="app-field-label" htmlFor="mobileNumber">Phone Number</label>
              <input id="mobileNumber" name="mobileNumber" placeholder="Enter phone number" value={form.mobileNumber} onChange={handleChange} required className="app-form-input" />
            </div>
          </div>

          <div className="app-field-group">
            <label className="app-field-label" htmlFor="password">Password</label>
            <input id="password" name="password" placeholder="Create password" value={form.password} onChange={handleChange} type="password" className="app-form-input" />
          </div>

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

          <button type="submit" disabled={loading} className="app-button-primary w-full">
            {loading ? "Creating..." : "Create Teacher"}
          </button>
        </form>

        {message ? <div className={messageClassName}>{message}</div> : null}
      </div>
    </div>
  );
}
