"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import PageHero from "@/components/layout/PageHero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
} from "@/lib/workspace/support-types";

function getSectionClassId(section: WorkspaceAcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

type CreateStudentPageClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSections: WorkspaceAcademicSectionItem[];
  initialMessage?: string | null;
};

export default function CreateStudentPageClient({
  initialClasses,
  initialSections,
  initialMessage = null,
}: CreateStudentPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/students");
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobileNumber: "",
    class: "",
    academicSection: "",
    rollNumber: "",
    enrolledAt: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(initialMessage);
  const [bulkLoading, setBulkLoading] = useState(false);

  const filteredSections = useMemo(
    () => initialSections.filter((section) => getSectionClassId(section) === form.class),
    [form.class, initialSections],
  );

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
      ...(name === "class" ? { academicSection: "" } : {}),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      const data = await fetchApiJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          mobileNumber: form.mobileNumber,
          class: form.class,
          academicSection: form.academicSection,
          rollNumber: form.rollNumber,
          role: "student",
          enrolledAt: form.enrolledAt ? new Date(form.enrolledAt) : undefined,
        }),
        schoolKey,
        fallbackMessage: "Error creating student",
      });

      setMessage(data.existed ? "Student already exists." : "Student created!");
      setForm({
        name: "",
        email: "",
        mobileNumber: "",
        class: "",
        academicSection: "",
        rollNumber: "",
        enrolledAt: "",
      });
    } catch (error: any) {
      setMessage(error?.message || "Error creating student");
    } finally {
      setLoading(false);
    }
  };

  const resolveClassIdByName = (className: string) => {
    const found = initialClasses.find(
      (classItem) =>
        classItem.name.trim().toLowerCase() === className.trim().toLowerCase(),
    );
    return found?._id || "";
  };

  const resolveAcademicSectionId = (classId: string, sectionName: string) => {
    if (!classId || !sectionName) return "";
    const found = initialSections.find(
      (section) =>
        getSectionClassId(section) === classId &&
        section.name.trim().toLowerCase() === sectionName.trim().toLowerCase(),
    );
    return found?._id || "";
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setMessage(null);

    let rawRows: any[] = [];
    if (file.name.endsWith(".csv")) {
      const text = await file.text();
      const lines = text.split("\n").filter(Boolean);
      const [header, ...rows] = lines;
      const columns = header.split(",").map((item) => item.trim());
      rawRows = rows.map((row) => {
        const values = row.split(",").map((item) => item.trim());
        const nextRow: any = {};
        columns.forEach((column, index) => {
          nextRow[column.toLowerCase()] = values[index] || "";
        });
        return nextRow;
      });
    } else if (file.name.endsWith(".xlsx")) {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet);
      rawRows = json.map((row: any) => {
        const nextRow: any = {};
        Object.keys(row).forEach((key) => {
          nextRow[key.toLowerCase()] = row[key];
        });
        return nextRow;
      });
    } else {
      setBulkLoading(false);
      setMessage("Unsupported file type. Please upload a CSV or Excel (.xlsx) file.");
      return;
    }

    const invalidRows: string[] = [];
    const students = rawRows
      .map((row: any) => {
        const className = String(row.class || row.classname || "").trim();
        const sectionName = String(
          row.section || row.academicsection || row.sectionname || "",
        ).trim();
        const classId = className ? resolveClassIdByName(className) : "";
        const academicSectionId = sectionName
          ? resolveAcademicSectionId(classId, sectionName)
          : "";

        if (!classId || !academicSectionId) {
          invalidRows.push(
            [row.name || "Unknown", className || "?", sectionName || "?"].join(" / "),
          );
        }

        return {
          ...row,
          role: "student",
          class: classId,
          academicSection: academicSectionId,
          enrolledAt:
            row.enrolledat || row.enrolledAt
              ? new Date(row.enrolledat || row.enrolledAt)
              : undefined,
        };
      })
      .filter((student) => student.class && student.academicSection);

    if (invalidRows.length > 0) {
      setMessage(
        `Some rows were skipped due to invalid class/section pairs: ${invalidRows.join(", ")}`,
      );
    }

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      const data = await fetchApiJson<any>("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students }),
        schoolKey,
        fallbackMessage: "Bulk upload failed.",
      });

      const failed = (data.results || []).filter((result: any) => !result.success);
      const succeeded = (data.results || []).filter(
        (result: any) => result.success && !result.existed,
      );
      const existed = (data.results || []).filter((result: any) => result.existed);
      setMessage(
        `Bulk upload complete. Created: ${succeeded.length}, Existing: ${existed.length}, Failed: ${failed.length}.`,
      );
    } catch (error: any) {
      setMessage(error?.message || "Bulk upload failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  const messageClassName =
    message?.toLowerCase().includes("error") ||
    message?.toLowerCase().includes("failed") ||
    message?.toLowerCase().includes("invalid")
      ? "app-feedback app-feedback-error"
      : "app-feedback app-feedback-success";

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Create Student"
        description="Add one student at a time or import a class list with the same credential and placement rules used by the student test portal."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Students
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Roll number username</span>
            <span className="app-meta-chip">Default password = roll number</span>
          </>
        }
        stats={[
          {
            label: "Classes loaded",
            value: String(initialClasses.length),
            meta: "Available class placements in the current school workspace.",
          },
          {
            label: "Sections loaded",
            value: String(initialSections.length),
            meta: "Sections available for class-based student assignment.",
          },
          {
            label: "Bulk import",
            value: bulkLoading ? "Uploading" : "Ready",
            meta: "CSV and Excel imports are supported here.",
          },
          {
            label: "Credential model",
            value: "Roll number default",
            meta: "Students start with the roll number as both username and default password.",
          },
        ]}
      />

      {message ? <div className={messageClassName}>{message}</div> : null}

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Student Profile</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Identity and contact</p>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="name">
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      placeholder="Enter student name"
                      value={form.name}
                      onChange={handleChange}
                      required
                      className="app-form-input"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="email">
                        Email (Optional)
                      </label>
                      <input
                        id="email"
                        name="email"
                        placeholder="Enter email"
                        value={form.email}
                        onChange={handleChange}
                        type="email"
                        className="app-form-input"
                      />
                    </div>
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="mobileNumber">
                        Parent Mobile Number
                      </label>
                      <input
                        id="mobileNumber"
                        name="mobileNumber"
                        placeholder="Enter WhatsApp number"
                        value={form.mobileNumber}
                        onChange={handleChange}
                        className="app-form-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Credentials</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Student usernames and initial passwords are set to the roll number.
                    Students can change their own password later from the student account page.
                  </p>
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">School placement</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="class">
                        Class
                      </label>
                      <select
                        id="class"
                        name="class"
                        value={form.class}
                        onChange={handleChange}
                        required
                        className="app-form-input"
                      >
                        <option value="">Select Class</option>
                        {initialClasses.map((classItem) => (
                          <option key={classItem._id} value={classItem._id}>
                            {classItem.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="app-field-group">
                      <label className="app-field-label" htmlFor="academicSection">
                        Section
                      </label>
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
                      <label className="app-field-label" htmlFor="rollNumber">
                        Roll Number / Username
                      </label>
                      <input
                        id="rollNumber"
                        name="rollNumber"
                        placeholder="Enter roll number"
                        value={form.rollNumber}
                        onChange={handleChange}
                        required
                        className="app-form-input"
                      />
                    </div>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="enrolledAt">
                      Enrollment Date
                    </label>
                    <input
                      id="enrolledAt"
                      name="enrolledAt"
                      value={form.enrolledAt}
                      onChange={handleChange}
                      type="date"
                      className="app-form-input"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="app-button-primary w-full">
                  {loading ? "Creating..." : "Create Student"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="app-editor-aside">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Bulk Upload Students</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <input
                type="file"
                accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleBulkUpload}
                disabled={bulkLoading}
                className="app-form-file"
              />

              {bulkLoading ? <p className="app-page-subtitle">Uploading...</p> : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
