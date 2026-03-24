"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { ArrowLeft, GraduationCap, ShieldCheck, Users } from "lucide-react";

import PageHero from "@/components/layout/PageHero";
import PageShell from "@/components/layout/PageShell";
import MultiSelectChecklist from "@/components/multi-select-checklist";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import FeedbackNotice, {
  type FeedbackNoticeVariant,
} from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { useBackNavigation } from "@/hooks/useReturnNavigation";
import { fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";
import {
  downloadCsvTemplate,
  parseUploadFile,
} from "@/lib/client/bulk-upload";
import {
  buildWorkspaceUserBulkRows,
  WORKSPACE_USER_BULK_TEMPLATES,
} from "@/lib/client/workspace-user-bulk";
import { cn } from "@/lib/utils";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

type Role = "teacher" | "student" | "admin";

type CreateUserPageClientProps = {
  initialClasses: WorkspaceClassItem[];
  initialSections: WorkspaceAcademicSectionItem[];
  initialSubjects: WorkspaceSubjectItem[];
  initialSchoolKey?: string;
  initialMessage?: string | null;
};

const rolePresets = [
  {
    value: "admin" as const,
    title: "Admin",
    description: "School-wide operators with full or restricted academic scope.",
    icon: ShieldCheck,
  },
  {
    value: "teacher" as const,
    title: "Teacher",
    description: "Teaching accounts scoped by classes, sections, and subjects.",
    icon: Users,
  },
  {
    value: "student" as const,
    title: "Student",
    description: "Learners who sign in with roll number and can take online tests.",
    icon: GraduationCap,
  },
];

const defaultFormState = {
  name: "",
  email: "",
  password: "",
  mobileNumber: "",
  role: "teacher" as Role,
  classId: "",
  academicSection: "",
  rollNumber: "",
  enrolledAt: "",
  classIds: [] as string[],
  academicSectionIds: [] as string[],
  subjectIds: [] as string[],
  hasAllClasses: false,
  hasAllSections: true,
  hasAllSubjects: false,
};

function getSectionClassId(section: WorkspaceAcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

function resolveEffectiveAdminScope(state: {
  role?: Role;
  classIds?: string[];
  subjectIds?: string[];
  hasAllClasses?: boolean;
  hasAllSections?: boolean;
  hasAllSubjects?: boolean;
}) {
  if (state.role !== "admin") {
    return {
      hasAllClasses: false,
      hasAllSections: state.role === "student" ? false : state.hasAllSections !== false,
      hasAllSubjects: false,
    };
  }

  const hasSelectedClasses = Array.isArray(state.classIds) && state.classIds.length > 0;
  const hasSelectedSubjects = Array.isArray(state.subjectIds) && state.subjectIds.length > 0;

  if (
    !state.hasAllClasses &&
    !state.hasAllSubjects &&
    !hasSelectedClasses &&
    !hasSelectedSubjects
  ) {
    return {
      hasAllClasses: true,
      hasAllSections: true,
      hasAllSubjects: true,
    };
  }

  return {
    hasAllClasses: state.hasAllClasses === true,
    hasAllSections: state.hasAllSections !== false,
    hasAllSubjects: state.hasAllSubjects === true,
  };
}

export default function CreateUserPageClient({
  initialClasses,
  initialSections,
  initialSubjects,
  initialSchoolKey,
  initialMessage = null,
}: CreateUserPageClientProps) {
  const { navigateBack } = useBackNavigation("/workspace/manage/users");
  const { toast } = useToast();

  const [formData, setFormData] = useState(defaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    variant: FeedbackNoticeVariant;
  } | null>(
    initialMessage
      ? {
          message: initialMessage,
          variant: "error",
        }
      : null,
  );
  const [bulkFeedback, setBulkFeedback] = useState<{
    message: string;
    variant: FeedbackNoticeVariant;
  } | null>(null);

  const activeRolePreset = useMemo(
    () => rolePresets.find((preset) => preset.value === formData.role) || rolePresets[1],
    [formData.role],
  );

  const availableSections = useMemo(() => {
    if (formData.role === "student") {
      if (!formData.classId) return [] as WorkspaceAcademicSectionItem[];
      return initialSections.filter((section) => getSectionClassId(section) === formData.classId);
    }

    if (formData.role === "admin" && formData.hasAllClasses) {
      return initialSections;
    }

    const selectedClassIds = new Set(formData.classIds);
    return initialSections.filter((section) => selectedClassIds.has(getSectionClassId(section)));
  }, [
    formData.classId,
    formData.classIds,
    formData.hasAllClasses,
    formData.role,
    initialSections,
  ]);

  const availableSectionIds = useMemo(
    () => new Set(availableSections.map((section) => section._id)),
    [availableSections],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((currentState) => ({
      ...currentState,
      [name]: value,
    }));
  };

  const handleRoleChange = (value: Role) => {
    setFeedback(null);
    setBulkFeedback(null);
    setFormData((currentState) => ({
      ...currentState,
      role: value,
      password: value === "student" ? "" : currentState.password,
      classId: value === "student" ? currentState.classId : "",
      academicSection: value === "student" ? currentState.academicSection : "",
      rollNumber: value === "student" ? currentState.rollNumber : "",
      enrolledAt: value === "student" ? currentState.enrolledAt : "",
      classIds: value === "student" ? [] : currentState.classIds,
      academicSectionIds: value === "student" ? [] : currentState.academicSectionIds,
      subjectIds: value === "student" ? [] : currentState.subjectIds,
      hasAllClasses:
        value === "admin"
          ? currentState.role === "admin"
            ? currentState.hasAllClasses
            : true
          : false,
      hasAllSections:
        value === "student"
          ? false
          : value === "admin"
            ? currentState.role === "admin"
              ? currentState.hasAllSections
              : true
            : true,
      hasAllSubjects:
        value === "admin"
          ? currentState.role === "admin"
            ? currentState.hasAllSubjects
            : true
          : false,
    }));
  };

  const handleClassChange = (value: string) => {
    setFormData((currentState) => ({
      ...currentState,
      classId: value,
      academicSection: "",
    }));
  };

  const setCreateMultiValues = (
    field: "classIds" | "subjectIds" | "academicSectionIds",
    nextValues: string[],
  ) => {
    setFormData((currentState) => {
      if (field !== "classIds") {
        return { ...currentState, [field]: nextValues };
      }

      const nextClassIds = nextValues;
      const nextClassIdSet = new Set(nextClassIds);
      const nextAcademicSectionIds = currentState.academicSectionIds.filter((sectionId) => {
        if (currentState.role === "admin" && currentState.hasAllClasses) return true;
        const section = initialSections.find((item) => item._id === sectionId);
        return section ? nextClassIdSet.has(getSectionClassId(section)) : false;
      });

      return {
        ...currentState,
        classIds: nextClassIds,
        academicSectionIds: nextAcademicSectionIds,
      };
    });
  };

  const resetForm = () => {
    setFormData(defaultFormState);
  };

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const effectiveAdminScope = resolveEffectiveAdminScope(formData);

      if (!formData.name.trim()) {
        throw new Error("Full name is required.");
      }

      if (!formData.mobileNumber.trim()) {
        throw new Error("Phone number is required.");
      }

      if (formData.role === "student" && (!formData.classId || !formData.rollNumber.trim())) {
        throw new Error("For student role, class and roll number are required.");
      }

      if (
        formData.role === "teacher" &&
        (formData.classIds.length === 0 || formData.subjectIds.length === 0)
      ) {
        throw new Error("For teacher role, select at least one class and one subject.");
      }

      if (
        formData.role === "teacher" &&
        !formData.hasAllSections &&
        formData.academicSectionIds.filter((sectionId) => availableSectionIds.has(sectionId)).length === 0
      ) {
        throw new Error("Select at least one section or enable all sections.");
      }

      const body: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        mobileNumber: formData.mobileNumber,
        role: formData.role,
      };

      if (formData.role !== "student" && formData.password.trim()) {
        body.password = formData.password;
      }

      if (formData.role === "student") {
        body.class = formData.classId;
        body.academicSection = formData.academicSection || undefined;
        body.rollNumber = formData.rollNumber;
        body.enrolledAt = formData.enrolledAt ? new Date(formData.enrolledAt) : undefined;
      } else {
        body.classIds =
          formData.role === "admin" && effectiveAdminScope.hasAllClasses
            ? []
            : formData.classIds;
        body.academicSectionIds =
          (formData.role === "admin"
            ? effectiveAdminScope.hasAllSections
            : formData.hasAllSections)
            ? []
            : formData.academicSectionIds.filter((sectionId) => availableSectionIds.has(sectionId));
        body.subjectIds =
          formData.role === "admin" && effectiveAdminScope.hasAllSubjects
            ? []
            : formData.subjectIds;
        body.hasAllClasses =
          formData.role === "admin" ? effectiveAdminScope.hasAllClasses : false;
        body.hasAllSections =
          formData.role === "admin"
            ? effectiveAdminScope.hasAllSections
            : formData.hasAllSections;
        body.hasAllSubjects =
          formData.role === "admin" ? effectiveAdminScope.hasAllSubjects : false;
      }

      const schoolKey = resolveClientSchoolKey(initialSchoolKey);
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      const data = await fetchApiJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        schoolKey,
        fallbackMessage: "We couldn't create this user.",
      });

      resetForm();
      setFeedback({
        message: `User "${data.user?.name || formData.name}" created successfully.`,
        variant: "success",
      });
      toast({
        title: "User created",
        description: `User "${data.user?.name || formData.name}" has been created.`,
      });
    } catch (error: any) {
      const message = error?.message || "We couldn't create this user.";
      setFeedback({
        message,
        variant: "error",
      });
      toast({
        title: "Couldn't create user",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsBulkUploading(true);
    setBulkFeedback(null);

    try {
      const rows = await parseUploadFile(file);
      const { users, skippedRows } = buildWorkspaceUserBulkRows({
        role: formData.role,
        rows,
        classes: initialClasses,
        sections: initialSections,
        subjects: initialSubjects,
      });

      if (users.length === 0) {
        throw new Error(
          skippedRows[0] || "No valid rows were found in the uploaded file.",
        );
      }

      const schoolKey = resolveClientSchoolKey(initialSchoolKey);
      if (!schoolKey) {
        throw new Error("Please select a school in the navbar first.");
      }

      const data = await fetchApiJson<any>("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
        schoolKey,
        fallbackMessage: "We couldn't complete the bulk upload.",
      });

      const results = Array.isArray(data.results) ? data.results : [];
      const failed = results.filter((result: any) => !result.success);
      const created = results.filter((result: any) => result.success && !result.existed);
      const existing = results.filter((result: any) => result.existed);

      const summary = [
        `Bulk upload complete for ${activeRolePreset.title.toLowerCase()}s.`,
        `Created: ${created.length}.`,
        `Existing: ${existing.length}.`,
        `Failed after upload: ${failed.length}.`,
        skippedRows.length ? `Skipped before upload: ${skippedRows.length}.` : null,
      ]
        .filter(Boolean)
        .join(" ");

      setBulkFeedback({
        message:
          skippedRows.length > 0
            ? `${summary} First skipped row: ${skippedRows[0]}`
            : summary,
        variant:
          failed.length > 0 || skippedRows.length > 0
            ? created.length > 0 || existing.length > 0
              ? "warning"
              : "error"
            : "success",
      });
    } catch (error: any) {
      setBulkFeedback({
        message: error?.message || "We couldn't complete the bulk upload.",
        variant: "error",
      });
    } finally {
      event.target.value = "";
      setIsBulkUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = WORKSPACE_USER_BULK_TEMPLATES[formData.role];
    downloadCsvTemplate(template.filename, template.headers, template.sampleRows);
  };

  const currentSchoolKey = resolveClientSchoolKey(initialSchoolKey);

  return (
    <PageShell width="wide" padding="relaxed">
      <PageHero
        eyebrow="School Workspace"
        title="Create Users"
        description="Create a single account or import multiple students, teachers, or admins from one dedicated role-aware setup page."
        actions={
          <Button type="button" variant="outline" onClick={navigateBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
            </span>
            <span className="app-meta-chip">Bulk upload ready</span>
          </>
        }
        stats={[
          {
            label: "Create role",
            value: activeRolePreset.title,
            meta: activeRolePreset.description,
          },
          {
            label: "Classes loaded",
            value: String(initialClasses.length),
            meta: "Available academic classes in the active school.",
          },
          {
            label: "Sections loaded",
            value: String(initialSections.length),
            meta: "Used for student placement and scoped staff access.",
          },
          {
            label: "Subjects loaded",
            value: String(initialSubjects.length),
            meta: "Needed for teacher and restricted admin scope.",
          },
        ]}
      />

      {feedback ? (
        <FeedbackNotice variant={feedback.variant}>{feedback.message}</FeedbackNotice>
      ) : null}

      <div className="app-editor-grid">
        <div className="app-editor-main">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Create Individual User</CardTitle>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleCreateUser} className="space-y-5">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Account role
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Choose the account type first so the fields and access rules stay aligned.
                    </p>
                  </div>

                  <div className="app-role-switcher">
                    <div className="app-role-switcher-grid">
                      {rolePresets.map((preset) => {
                        const Icon = preset.icon;
                        const isActive = formData.role === preset.value;

                        return (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => handleRoleChange(preset.value)}
                            className={cn(
                              "app-role-switcher-button",
                              isActive && "app-role-switcher-button-active",
                            )}
                            aria-pressed={isActive}
                          >
                            <div className="app-role-switcher-icon">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="app-role-switcher-copy">
                              <div className="app-role-switcher-title">{preset.title}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="app-form-callout">
                    <p className="font-medium text-foreground">
                      {activeRolePreset.description}
                    </p>
                    <p className="mt-1.5">
                      {formData.role === "student"
                        ? "Students sign in with their roll number, and the initial password defaults to that roll number."
                        : formData.role === "admin"
                          ? "Admins can keep full-school access or be limited by class, section, and subject."
                          : "Teachers need explicit class and subject assignments, with optional all-section access."}
                    </p>
                  </div>
                </div>

                <div className="app-section space-y-4">
                  <div className="app-form-section-heading">
                    <p className="app-form-section-title">Basic details</p>
                  </div>

                  <div className="app-field-group">
                    <Label htmlFor="create-name">Full Name</Label>
                    <Input
                      id="create-name"
                      name="name"
                      placeholder="Full Name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="app-field-group">
                      <Label htmlFor="create-email">Email</Label>
                      <Input
                        id="create-email"
                        name="email"
                        type="email"
                        placeholder={
                          formData.role === "student"
                            ? "Email address (optional)"
                            : "Email address"
                        }
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="app-field-group">
                      <Label htmlFor="create-mobile">Phone Number</Label>
                      <Input
                        id="create-mobile"
                        name="mobileNumber"
                        placeholder="Phone number"
                        value={formData.mobileNumber}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  {formData.role === "student" ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                      Student passwords are initialized to the roll number. Students can change them later from the student account page.
                    </div>
                  ) : (
                    <div className="app-field-group">
                      <Label htmlFor="create-password">Password</Label>
                      <Input
                        id="create-password"
                        name="password"
                        type="password"
                        placeholder="Leave blank to auto-handle defaults where allowed"
                        value={formData.password}
                        onChange={handleInputChange}
                      />
                    </div>
                  )}
                </div>

                {formData.role === "student" ? (
                  <div className="app-section space-y-3">
                    <div className="app-form-section-heading">
                      <p className="app-form-section-title">Student placement</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Class</Label>
                        <Select value={formData.classId} onValueChange={handleClassChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            {initialClasses.map((classItem) => (
                              <SelectItem key={classItem._id} value={classItem._id}>
                                {classItem.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Section</Label>
                        <Select
                          value={formData.academicSection || "none"}
                          onValueChange={(value) =>
                            setFormData((currentState) => ({
                              ...currentState,
                              academicSection: value === "none" ? "" : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select section" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Section</SelectItem>
                            {availableSections.map((section) => (
                              <SelectItem key={section._id} value={section._id}>
                                {section.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Roll Number / Username</Label>
                        <Input
                          name="rollNumber"
                          placeholder="Roll number"
                          value={formData.rollNumber}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Enrolled At</Label>
                        <Input
                          name="enrolledAt"
                          type="date"
                          value={formData.enrolledAt}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="app-section space-y-4">
                    <div className="app-form-section-heading">
                      <p className="app-form-section-title">Academic access</p>
                    </div>

                    {formData.role === "admin" ? (
                      <div className="space-y-2">
                        <div className="app-toggle-grid">
                          <label
                            className={cn(
                              "app-toggle-card",
                              formData.hasAllClasses && "app-toggle-card-active",
                            )}
                          >
                            <Checkbox
                              checked={formData.hasAllClasses}
                              onCheckedChange={(checked) =>
                                setFormData((currentState) => ({
                                  ...currentState,
                                  hasAllClasses: checked === true,
                                }))
                              }
                            />
                            <span className="app-toggle-card-copy">
                              <span className="app-toggle-card-title">All Classes</span>
                            </span>
                          </label>
                          <label
                            className={cn(
                              "app-toggle-card",
                              formData.hasAllSubjects && "app-toggle-card-active",
                            )}
                          >
                            <Checkbox
                              checked={formData.hasAllSubjects}
                              onCheckedChange={(checked) =>
                                setFormData((currentState) => ({
                                  ...currentState,
                                  hasAllSubjects: checked === true,
                                }))
                              }
                            />
                            <span className="app-toggle-card-copy">
                              <span className="app-toggle-card-title">All Subjects</span>
                            </span>
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <label
                      className={cn(
                        "app-toggle-card",
                        formData.hasAllSections && "app-toggle-card-active",
                      )}
                    >
                      <Checkbox
                        checked={formData.hasAllSections}
                        onCheckedChange={(checked) =>
                          setFormData((currentState) => ({
                            ...currentState,
                            hasAllSections: checked === true,
                            academicSectionIds:
                              checked === true ? [] : currentState.academicSectionIds,
                          }))
                        }
                      />
                      <span className="app-toggle-card-copy">
                        <span className="app-toggle-card-title">All Sections</span>
                      </span>
                    </label>

                    {!formData.hasAllClasses ? (
                      <div className="space-y-2">
                        <Label>Classes</Label>
                        <MultiSelectChecklist
                          items={initialClasses.map((classItem) => ({
                            id: classItem._id,
                            label: classItem.name,
                          }))}
                          selectedIds={formData.classIds}
                          onChange={(ids) => setCreateMultiValues("classIds", ids)}
                        />
                      </div>
                    ) : null}

                    {!formData.hasAllSections ? (
                      <div className="space-y-2">
                        <Label>Sections</Label>
                        <MultiSelectChecklist
                          items={availableSections.map((section) => ({
                            id: section._id,
                            label: (
                              <span>
                                {section.name}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  (
                                  {initialClasses.find(
                                    (classItem) => classItem._id === getSectionClassId(section),
                                  )?.name || "Class"}
                                  )
                                </span>
                              </span>
                            ),
                          }))}
                          selectedIds={formData.academicSectionIds}
                          onChange={(ids) => setCreateMultiValues("academicSectionIds", ids)}
                          emptyContent={
                            formData.role === "admin" && formData.hasAllClasses
                              ? "No sections created yet."
                              : "Select classes first."
                          }
                        />
                      </div>
                    ) : null}

                    {!formData.hasAllSubjects ? (
                      <div className="space-y-2">
                        <Label>Subjects</Label>
                        <MultiSelectChecklist
                          items={initialSubjects.map((subject) => ({
                            id: subject._id,
                            label: subject.name,
                          }))}
                          selectedIds={formData.subjectIds}
                          onChange={(ids) => setCreateMultiValues("subjectIds", ids)}
                        />
                      </div>
                    ) : null}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner /> : "Create User"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="app-editor-aside">
          <BulkUploadPanel
            title={`Bulk Upload ${activeRolePreset.title}s`}
            description="Upload a CSV or Excel sheet using the role-specific template. Names are created in the active school only."
            inputId="bulk-upload-users"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            loading={isBulkUploading}
            loadingLabel="Uploading users..."
            disabled={initialClasses.length === 0 && formData.role !== "admin"}
            feedback={bulkFeedback}
            tips={WORKSPACE_USER_BULK_TEMPLATES[formData.role].tips}
          />
        </div>
      </div>
    </PageShell>
  );
}
