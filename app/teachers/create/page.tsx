"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import MultiSelectChecklist from "@/components/multi-select-checklist";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function CreateTeacherPage() {
  const router = useRouter();
  const { navigateBack } = useBackNavigation('/teachers');
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
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [setupNotice, setSetupNotice] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        setSetupNotice("Select a school workspace to load teacher assignment options.");
        return;
      }

      const [classesResult, sectionsResult, subjectsResult] = await Promise.allSettled([
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
        fetchApiJson<any>("/api/subjects", {
          cache: "no-store",
          schoolKey,
          fallbackMessage: "Failed to load subjects.",
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
      const nextSubjects =
        subjectsResult.status === "fulfilled" && Array.isArray(subjectsResult.value.subjects)
          ? subjectsResult.value.subjects
          : [];

      setClasses(nextClasses);
      setSections(nextSections);
      setSubjects(nextSubjects);
      setSetupNotice(
        buildPartialLoadMessage([
          ...(classesResult.status === "rejected" ? ["Class options"] : []),
          ...(sectionsResult.status === "rejected" ? ["Section options"] : []),
          ...(subjectsResult.status === "rejected" ? ["Subject options"] : []),
        ]) || (!nextClasses.length && !nextSections.length && !nextSubjects.length ? "No classes, sections, or subjects are available for this school yet." : null),
      );
    })();
  }, []);

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
    setLoading(true);
    setMessage(null);

    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      await fetchApiJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          role: "teacher",
          academicSectionIds: form.hasAllSections
            ? []
            : form.academicSectionIds.filter((sectionId) => availableSectionIds.has(sectionId)),
        }),
        schoolKey,
        fallbackMessage: "Error creating teacher",
      });

      setMessage("Teacher created successfully!");
      setForm({
        name: "",
        email: "",
        password: "",
        mobileNumber: "",
        classIds: [],
        academicSectionIds: [],
        hasAllSections: true,
        subjectIds: [],
      });
      setTimeout(() => router.push("/manage/users"), 800);
    } catch (error: any) {
      setMessage(error?.message || "Error creating teacher");
    } finally {
      setLoading(false);
    }
  };

  const messageClassName =
    message?.toLowerCase().includes("error") ||
    message?.toLowerCase().includes("failed")
      ? "app-feedback app-feedback-error"
      : "app-feedback app-feedback-success";

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-5 sm:px-0">
      <PageHero
        eyebrow="People"
        title="Create Teacher"
        description="Create a teacher account and configure the exact class, section, and subject scope the teacher should see in the workspace."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Teachers
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">Scoped teacher access</span>
            <span className="app-meta-chip">Class + subject required</span>
          </>
        }
        stats={[
          {
            label: "Classes selected",
            value: String(form.classIds.length),
            meta: "Teachers must have at least one class assignment.",
          },
          {
            label: "Sections in scope",
            value: form.hasAllSections ? "All" : String(form.academicSectionIds.length),
            meta: form.hasAllSections ? "Teacher can work in all sections of selected classes." : "Only explicitly selected sections are enabled.",
          },
          {
            label: "Subjects selected",
            value: String(form.subjectIds.length),
            meta: "Teachers must have at least one subject assignment.",
          },
          {
            label: "Form state",
            value: loading ? "Saving" : "Ready",
            meta: "New teacher accounts are created inside the active school tenant.",
          },
        ]}
      />

      {setupNotice ? <div className="app-feedback app-feedback-info">{setupNotice}</div> : null}
      {message ? <div className={messageClassName}>{message}</div> : null}

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Teacher onboarding flow</p>
          <h2 className="app-spotlight-title">
            Create the account first, then shape the academic scope
          </h2>
          <p className="app-spotlight-copy">
            Teacher creation is designed around clear access boundaries so the
            right classes, sections, and subjects are available from day one.
          </p>
          <div className="app-flow-list">
            <div className="app-flow-item">
              <div className="app-flow-index">1</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Add identity details</p>
                <p className="app-flow-note">
                  Start with name, email, phone, and the teacher&apos;s first password.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">2</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Assign classes and sections</p>
                <p className="app-flow-note">
                  Scope section access only when the teacher should not see every section of the selected classes.
                </p>
              </div>
            </div>
            <div className="app-flow-item">
              <div className="app-flow-index">3</div>
              <div className="app-flow-copy">
                <p className="app-flow-title">Finish subject access</p>
                <p className="app-flow-note">
                  Subjects complete the teacher scope and keep the workspace focused.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Access defaults</p>
          <h2 className="text-lg font-semibold text-foreground">
            Teacher access should stay narrow and intentional
          </h2>
          <div className="mt-4 space-y-2">
            <div className="app-note-item">
              Teachers should always have at least one class and one subject assigned.
            </div>
            <div className="app-note-item">
              Leaving all sections enabled is the fastest default when the teacher serves the whole class group.
            </div>
            <div className="app-note-item">
              Restrict sections only when the teacher should not work across all sections in the selected classes.
            </div>
          </div>
        </div>
      </div>

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Teacher Profile</CardTitle>
              <CardDescription>
                Create the teacher identity first, then shape the academic access they should receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Identity and contact</p>
                    <p className="app-form-section-copy">
                      Start with the teacher&apos;s profile details before shaping academic access.
                    </p>
                  </div>
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
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Credentials</p>
                    <p className="app-form-section-copy">
                      Teachers continue to use email plus password as their school sign-in flow.
                    </p>
                  </div>
                  <div className="app-field-group">
                    <label className="app-field-label" htmlFor="password">Password</label>
                    <input id="password" name="password" placeholder="Create password" value={form.password} onChange={handleChange} type="password" className="app-form-input" />
                  </div>
                </div>

                <div className="app-section">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Academic access</p>
                    <p className="app-form-section-copy">
                      Choose the exact teaching scope the account should receive in the workspace.
                    </p>
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

                  <label
                    className={`app-toggle-card ${form.hasAllSections ? "app-toggle-card-active" : ""}`}
                  >
                    <Checkbox
                      checked={form.hasAllSections}
                      onCheckedChange={(checked) => updateToggle("hasAllSections", checked === true)}
                      className="mt-0.5"
                    />
                    <span className="app-toggle-card-copy">
                      <span className="app-toggle-card-title">
                        Access to all sections in selected classes
                      </span>
                      <span className="app-toggle-card-note">
                        Turn this off only when the teacher should be limited to specific sections.
                      </span>
                    </span>
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
                </div>

                <button type="submit" disabled={loading} className="app-button-primary w-full">
                  {loading ? "Creating..." : "Create Teacher"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="app-editor-aside">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Access Planning</CardTitle>
              <CardDescription>
                Use the same access language across every teacher account.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body">
              <div className="app-note-list">
                <div className="app-note-item">
                  Teachers need at least one class and one subject to operate usefully in the workspace.
                </div>
                <div className="app-note-item">
                  If all sections stay enabled, section selection is inherited from the chosen classes.
                </div>
                <div className="app-note-item">
                  Restrict sections only when a teacher should not see every section in the assigned classes.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
