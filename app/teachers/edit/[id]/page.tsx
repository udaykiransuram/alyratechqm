"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import MultiSelectChecklist from "@/components/multi-select-checklist";
import { Checkbox } from "@/components/ui/checkbox";
import PageLoadingState from "@/components/ui/page-loading-state";

interface ClassItem {
  _id: string;
  name: string;
}

interface SubjectItem {
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

export default function EditTeacherPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const { navigateBack } = useBackNavigation(`/teachers/${id}`);

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
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
    classIds: [] as string[],
    academicSectionIds: [] as string[],
    hasAllSections: true,
    subjectIds: [] as string[],
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [uRes, cRes, secRes, sRes] = await Promise.all([
          fetch("/api/users/" + id),
          fetch("/api/classes"),
          fetch("/api/sections"),
          fetch("/api/subjects"),
        ]);
        const uJson = await uRes.json();
        const cJson = await cRes.json();
        const secJson = await secRes.json();
        const sJson = await sRes.json();
        if (!mounted) return;
        if (!uJson.success) throw new Error(uJson.message || "Failed to load teacher");
        const user = uJson.user || {};
        setForm({
          name: user.name || "",
          email: user.email || "",
          password: "",
          mobileNumber: user.mobileNumber || "",
          classIds: (user.classIds || []).map(String),
          academicSectionIds: (user.academicSectionIds || []).map(String),
          hasAllSections:
            typeof user.hasAllSections === "boolean" ? user.hasAllSections : true,
          subjectIds: (user.subjectIds || []).map(String),
        });
        setClasses(cJson.classes || []);
        setSections(secJson.sections || []);
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

  const availableSections = useMemo(() => {
    const selectedClassIds = new Set(form.classIds);
    return sections.filter((section) => selectedClassIds.has(getSectionClassId(section)));
  }, [sections, form.classIds]);

  const availableSectionIds = useMemo(
    () => new Set(availableSections.map((section) => section._id)),
    [availableSections],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const updateToggle = (field: "hasAllSections", checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: checked,
      ...(field === "hasAllSections" && checked ? { academicSectionIds: [] } : {}),
    }));
  };

  const updateSelection = (
    field: "classIds" | "subjectIds" | "academicSectionIds",
    nextValues: string[],
  ) => {
    setForm((prev) => {
      if (field !== "classIds") {
        return { ...prev, [field]: nextValues };
      }

      const nextClassIds = nextValues;
      const nextClassIdSet = new Set(nextClassIds);
      const nextAcademicSectionIds = prev.academicSectionIds.filter((sectionId) => {
        const section = sections.find((item) => item._id === sectionId);
        return section ? nextClassIdSet.has(getSectionClassId(section)) : false;
      });

      return {
        ...prev,
        classIds: nextClassIds,
        academicSectionIds: nextAcademicSectionIds,
      };
    });
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
          role: "teacher",
          email: form.email.trim(),
          mobileNumber: form.mobileNumber.trim(),
          password: form.password || undefined,
          classIds: form.classIds,
          hasAllSections: form.hasAllSections,
          academicSectionIds: form.hasAllSections
            ? []
            : form.academicSectionIds.filter((sectionId) => availableSectionIds.has(sectionId)),
          subjectIds: form.subjectIds,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to update teacher");
      setMessage("Teacher updated successfully.");
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
        title="Loading teacher details"
        description="Preparing the teacher edit form and assignment controls."
      />
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
          <h1 className="app-page-title">Edit Teacher</h1>
          <p className="app-page-subtitle">
            Update teacher profile information and refine class, section, and subject access.
          </p>
        </div>
        <button type="button" onClick={navigateBack} className="app-button-secondary">
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

          <div className="app-field-group">
            <label className="app-field-label">Classes</label>
            <MultiSelectChecklist
              items={classes.map((classItem) => ({
                id: classItem._id,
                label: classItem.name,
              }))}
              selectedIds={form.classIds}
              onChange={(ids) => updateSelection("classIds", ids)}
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm font-medium text-foreground">
            <Checkbox
              checked={form.hasAllSections}
              onCheckedChange={(checked) => updateToggle("hasAllSections", checked === true)}
              className="mt-0.5"
            />
            <span>Access to all sections in selected classes</span>
          </label>

          {!form.hasAllSections && (
            <div className="app-field-group">
              <label className="app-field-label">Sections</label>
              <MultiSelectChecklist
                items={availableSections.map((section) => ({
                  id: section._id,
                  label: (
                    <span>
                      {section.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({classes.find((classItem) => classItem._id === getSectionClassId(section))?.name || "Class"})
                      </span>
                    </span>
                  ),
                }))}
                selectedIds={form.academicSectionIds}
                onChange={(ids) => updateSelection("academicSectionIds", ids)}
                emptyContent="Select one or more classes to choose sections."
              />
            </div>
          )}

          <div className="app-field-group">
            <label className="app-field-label">Subjects</label>
            <MultiSelectChecklist
              items={subjects.map((subject) => ({
                id: subject._id,
                label: subject.name,
              }))}
              selectedIds={form.subjectIds}
              onChange={(ids) => updateSelection("subjectIds", ids)}
            />
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
