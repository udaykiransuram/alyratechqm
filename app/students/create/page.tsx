"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

function getSchoolKeyFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )schoolKey=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export default function CreateStudentPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    class: "",
    rollNumber: "",
    enrolledAt: "",
  });
  const [classes, setClasses] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetch(
      "/api/classes" +
        (getSchoolKeyFromCookie() ? `?school=${getSchoolKeyFromCookie()}` : ""),
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setClasses(data.classes);
      });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
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
          role: "student",
          enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
        }),
      },
    );

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      setMessage("Student created!");
      setForm({
        name: "",
        email: "",
        password: "",
        mobileNumber: "",
        class: "",
        rollNumber: "",
        enrolledAt: "",
      });
    } else {
      setMessage(data.message || "Error creating student");
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setMessage(null);

    let students: any[] = [];

    if (file.name.endsWith(".csv")) {
      const text = await file.text();
      const lines = text.split("\n").filter(Boolean);
      const [header, ...rows] = lines;
      const columns = header.split(",").map((h) => h.trim());
      students = rows
        .map((row) => {
          const values = row.split(",").map((v) => v.trim());
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = values[idx] || "";
          });
          obj.role = "student";
          if (obj.class) {
            const found = classes.find(
              (c) =>
                c.name.trim().toLowerCase() === obj.class.trim().toLowerCase(),
            );
            obj.class = found ? found._id : "";
          }
          if (obj.enrolledAt) obj.enrolledAt = new Date(obj.enrolledAt);
          return obj;
        })
        .filter((s) => s.class);

      const unmatched = rows
        .map((row) => {
          const values = row.split(",").map((v) => v.trim());
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = values[idx] || "";
          });
          return obj.class;
        })
        .filter(
          (className) =>
            className &&
            !classes.find(
              (c) =>
                c.name.trim().toLowerCase() === className.trim().toLowerCase(),
            ),
        );

      if (unmatched.length > 0) {
        setMessage(`Unmatched class names: ${unmatched.join(", ")}`);
      }
    } else if (file.name.endsWith(".xlsx")) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet);

      const normalizedJson = json.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach((key) => {
          newRow[key.toLowerCase()] = row[key];
        });
        return newRow;
      });

      students = normalizedJson
        .map((row: any) => {
          if (row.class) {
            const found = classes.find(
              (c) =>
                c.name.trim().toLowerCase() ===
                String(row.class).trim().toLowerCase(),
            );
            row.class = found ? found._id : "";
          }
          return {
            ...row,
            role: "student",
            enrolledAt: row.enrolledAt ? new Date(row.enrolledAt) : undefined,
          };
        })
        .filter((s) => s.class);
    } else {
      setBulkLoading(false);
      setMessage(
        "Unsupported file type. Please upload a CSV or Excel (.xlsx) file.",
      );
      return;
    }

    const skipped = students.filter((s) => !s.class);
    if (skipped.length > 0) {
      setMessage(
        `Some students were skipped due to invalid class: ${skipped.map((s) => s.name).join(", ")}`,
      );
    }

    const res = await fetch(
      "/api/users/bulk" +
        (getSchoolKeyFromCookie() ? `?school=${getSchoolKeyFromCookie()}` : ""),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students }),
      },
    );
    const data = await res.json();
    setBulkLoading(false);

    if (data.success) {
      const failed = (data.results || []).filter((r: any) => !r.success);
      const succeeded = (data.results || []).filter(
        (r: any) => r.success && !r.existed,
      );
      const existed = (data.results || []).filter((r: any) => r.existed);

      let msg = `Bulk upload successful! ${succeeded.length} students created.`;
      if (existed.length > 0) {
        msg += ` ${existed.length} already existed.`;
      }
      if (failed.length > 0) {
        msg += ` ${failed.length} failed: `;
        msg += failed
          .map((f: any) => {
            const rowNum =
              (f.student?.__rownum__ ??
                f.student?.__rowNum__ ??
                f.student?.rownum ??
                f.student?.rowNum ??
                0) + 2;
            return `Row ${rowNum || "?"} (${f.student?.name || "Unknown"}): ${f.message}`;
          })
          .join("; ");
      }
      setMessage(msg);
    } else {
      setMessage(data.message || "Bulk upload failed");
    }
    e.target.value = "";
  };

  let messageClassName = "app-feedback app-feedback-success";
  if (message?.toLowerCase().includes("error") || message?.toLowerCase().includes("failed") || message?.toLowerCase().includes("unsupported")) {
    messageClassName = "app-feedback app-feedback-error";
  } else if (message?.toLowerCase().includes("skipped") || message?.toLowerCase().includes("unmatched")) {
    messageClassName = "app-feedback app-feedback-info";
  }

  return (
    <div className="app-page-shell max-w-xl px-4 py-6 sm:px-0">
      <div className="app-page-header">
        <h1 className="app-page-title">Create Student</h1>
        <p className="app-page-subtitle">
          Add a student manually or upload a batch from CSV or Excel.
        </p>
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
            <label className="app-field-label" htmlFor="password">Password</label>
            <input id="password" name="password" placeholder="Create password" value={form.password} onChange={handleChange} type="password" className="app-form-input" />
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

          <button type="submit" disabled={loading} className="app-button-primary w-full">
            {loading ? "Creating..." : "Create Student"}
          </button>
        </form>

        <div className="app-section">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Bulk Upload Students
            </h2>
            <p className="app-page-subtitle">
              CSV or Excel columns: <code>name,email,password,class,rollNumber,enrolledAt</code>
            </p>
          </div>

          <input
            type="file"
            accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleBulkUpload}
            disabled={bulkLoading}
            className="app-form-file"
          />

          {bulkLoading ? <p className="app-page-subtitle">Uploading...</p> : null}
        </div>

        {message ? <div className={messageClassName}>{message}</div> : null}
      </div>
    </div>
  );
}
