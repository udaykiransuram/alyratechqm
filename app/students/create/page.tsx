"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button";
import PageHero from "@/components/layout/PageHero";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson, buildPartialLoadMessage, resolveClientSchoolKey } from "@/lib/client/api";

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

export default function CreateStudentPage() {
  const { navigateBack } = useBackNavigation('/students');
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
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setSetupNotice("Select a school workspace to load class and section options.");
        return;
      }

      const [classesResult, sectionsResult] = await Promise.allSettled([
        fetchApiJson<any>("/api/classes", {
          cache: "no-store",
          schoolKey,
          fallbackMessage: "Failed to load classes.",
        }),
        fetchApiJson<any>("/api/sections", {
          cache: "no-store",
          schoolKey,
          fallbackMessage: "Failed to load sections.",
        }),
      ]);

      const nextClasses =
        classesResult.status === "fulfilled" && Array.isArray(classesResult.value.classes)
          ? classesResult.value.classes
          : [];
      const nextSections =
        sectionsResult.status === "fulfilled" && Array.isArray(sectionsResult.value.sections)
          ? sectionsResult.value.sections
          : [];

      setClasses(nextClasses);
      setSections(nextSections);
      setSetupNotice(
        buildPartialLoadMessage([
          ...(classesResult.status === "rejected" ? ["Class options"] : []),
          ...(sectionsResult.status === "rejected" ? ["Section options"] : []),
        ]) || (!nextClasses.length && !nextSections.length ? "No classes or sections are available for this school yet." : null),
      );
    })();
  }, []);

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
          ...form,
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
        password: "",
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
    const found = classes.find(
      (classItem) =>
        classItem.name.trim().toLowerCase() === className.trim().toLowerCase(),
    );
    return found?._id || "";
  };

  const resolveAcademicSectionId = (classId: string, sectionName: string) => {
    if (!classId || !sectionName) return "";
    const found = sections.find(
      (section) =>
        getSectionClassId(section) === classId &&
        section.name.trim().toLowerCase() === sectionName.trim().toLowerCase(),
    );
    return found?._id || "";
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
        const obj: any = {};
        columns.forEach((column, index) => {
          obj[column.toLowerCase()] = values[index] || "";
        });
        return obj;
      });
    } else if (file.name.endsWith(".xlsx")) {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet);
      rawRows = json.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach((key) => {
          newRow[key.toLowerCase()] = row[key];
        });
        return newRow;
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
          enrolledAt: row.enrolledat || row.enrolledAt ? new Date(row.enrolledat || row.enrolledAt) : undefined,
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
            value: String(classes.length),
            meta: "Available class placements in the current school workspace.",
          },
          {
            label: "Sections loaded",
            value: String(sections.length),
            meta: "Sections available for class-based student assignment.",
          },
          {
            label: "Bulk import",
            value: bulkLoading ? "Uploading" : "Ready",
            meta: "CSV and Excel imports are supported here.",
          },
          {
            label: "Credential model",
            value: "Roll number + password",
            meta: "Students sign in with roll number as the username.",
          },
        ]}
      />

      {setupNotice ? <div className="app-feedback app-feedback-info">{setupNotice}</div> : null}
      {message ? <div className={messageClassName}>{message}</div> : null}

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Student onboarding flow</p>
          <h2 className="app-spotlight-title">
            Set identity, assign placement, and keep sign-in simple
          </h2>
          <p className="app-spotlight-copy">
            This flow is optimized for school admins who need to create students
            quickly while keeping login details predictable for portal access
            and online tests.
          </p>
          <div className="app-flow-list">
            <div className="app-flow-item">
              <div className="app-flow-index">1</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Add the student profile</p>
                <p className="app-flow-note">
                  Capture the name, contact data, and any optional email.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">2</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Assign class and section</p>
                <p className="app-flow-note">
                  Placement controls what the student can see in the academic workspace.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">3</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Use roll number credentials</p>
                <p className="app-flow-note">
                  Students sign in with roll number, and the first password can match it by default.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Default behavior</p>
          <h2 className="text-lg font-semibold text-foreground">
            Keep onboarding easy for schools and students
          </h2>
          <div className="mt-4 space-y-2">
            <div className="app-note-item">
              Roll number acts as the student username throughout the portal.
            </div>
            <div className="app-note-item">
              Leaving password blank uses the roll number as the first password.
            </div>
            <div className="app-note-item">
              Bulk import follows the same credential and class-section rules as manual creation.
            </div>
          </div>
        </div>
      </div>

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Student Profile</CardTitle>
              <CardDescription>
                Capture the student’s identity, class placement, and initial sign-in credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Identity and contact</p>
                    <p className="app-form-section-copy">
                      Start with the student identity and the main parent contact for communication.
                    </p>
                  </div>
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
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Credentials</p>
                    <p className="app-form-section-copy">
                      Student login stays simple: roll number is the username, and password can default to the same value.
                    </p>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="password">Password</label>
                    <input id="password" name="password" placeholder="Leave blank to use roll number" value={form.password} onChange={handleChange} type="password" className="app-form-input" />
                    <div className="app-form-callout">
                      If you leave this blank, the student&apos;s first password will be the same as the roll number.
                    </div>
                  </div>
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">School placement</p>
                    <p className="app-form-section-copy">
                      Placement affects student visibility across classes, sections, analytics, and online tests.
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
                        Students use this value as their username when they sign in.
                      </p>
                    </div>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="enrolledAt">Enrollment Date</label>
                    <input id="enrolledAt" name="enrolledAt" value={form.enrolledAt} onChange={handleChange} type="date" className="app-form-input" />
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
              <CardTitle>Student Sign-in Rules</CardTitle>
              <CardDescription>
                Keep the setup predictable for schools and students.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-note-list">
                <div className="app-note-item">
                  Roll number is the student username in the portal.
                </div>
                <div className="app-note-item">
                  Leaving password blank sets the first password to the roll number.
                </div>
                <div className="app-note-item">
                  Class and section placement determine which online tests the student can see.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Bulk Upload Students</CardTitle>
              <CardDescription>
                CSV or Excel columns: <code>name,email,password,mobileNumber,class,section,rollNumber,enrolledAt</code>
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body space-y-4">
              <div className="app-form-callout">
                If the <code>password</code> column is blank, the import will use each student&apos;s <code>rollNumber</code> as the default password.
              </div>

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
