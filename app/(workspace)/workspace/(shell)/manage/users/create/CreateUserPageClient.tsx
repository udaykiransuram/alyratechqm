"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { GraduationCap, ShieldCheck, Users } from "lucide-react";

import MultiSelectChecklist from "@/components/multi-select-checklist";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import {
  WorkspaceCreateModeToggle,
  type WorkspaceCreateMode,
} from "@/components/workspace/WorkspaceCreateGuideCard";
import WorkspaceCreateShell from "@/components/workspace/WorkspaceCreateShell";
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
  buildWorkspaceBulkStructureSummary,
  buildWorkspaceUserBulkRows,
  WORKSPACE_USER_BULK_TEMPLATES,
} from "@/lib/client/workspace-user-bulk";
import { USER_GENDER_OPTIONS } from "@/lib/user-gender";
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
    note: "Full-school or restricted operations",
    icon: ShieldCheck,
  },
  {
    value: "teacher" as const,
    title: "Teacher",
    note: "Class and subject-scoped access",
    icon: Users,
  },
  {
    value: "student" as const,
    title: "Student",
    note: "Roll-number sign-in for tests",
    icon: GraduationCap,
  },
];

const defaultFormState = {
  name: "",
  email: "",
  password: "",
  mobileNumber: "",
  gender: "",
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
  const router = useRouter();
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
  const [createMode, setCreateMode] = useState<WorkspaceCreateMode>("single");

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
        gender: formData.gender || undefined,
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
      const structureSummary = buildWorkspaceBulkStructureSummary(data);
      const failed = results.filter((result: any) => !result.success);
      const created = results.filter((result: any) => result.success && !result.existed);
      const existing = results.filter((result: any) => result.existed);

      const summary = [
        `Bulk upload complete for ${activeRolePreset.title.toLowerCase()}s.`,
        ...structureSummary,
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
      router.refresh();
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
    <WorkspaceCreateShell
      eyebrow="School workspace"
      title="Create users"
      description="Create one user or switch to bulk upload."
      backLabel="Back to Users"
      onBack={navigateBack}
      mainClassName="space-y-4"
      badges={
        <>
          <span className="app-meta-chip">{`Role: ${activeRolePreset.title}`}</span>
          <span className="app-meta-chip">
            {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
          </span>
        </>
      }
    >
      <Card className="app-surface overflow-hidden">
        <CardContent className="app-section-body space-y-3">
          <p className="app-form-section-title">Account role</p>
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
                      <div className="app-role-switcher-note">{preset.note}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <WorkspaceCreateModeToggle
        value={createMode}
        onChange={setCreateMode}
        singleLabel={`Single ${activeRolePreset.title.toLowerCase()}`}
        bulkLabel={`Bulk ${activeRolePreset.title.toLowerCase()}s`}
      />

      {feedback ? (
        <FeedbackNotice variant={feedback.variant}>{feedback.message}</FeedbackNotice>
      ) : null}

      {createMode === "single" ? (
        <Card className="app-surface overflow-hidden">
          <CardHeader className="app-section-header space-y-2.5">
            <CardTitle>{`Create ${activeRolePreset.title}`}</CardTitle>
          </CardHeader>
          <CardContent className="app-section-body">
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="app-section space-y-4">
                <p className="app-form-section-title">Basic details</p>

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

                <div className="grid gap-4 md:grid-cols-3">
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

                  <div className="app-field-group">
                    <Label htmlFor="create-gender">Gender</Label>
                    <Select
                      value={formData.gender || "unspecified"}
                      onValueChange={(value) =>
                        setFormData((currentState) => ({
                          ...currentState,
                          gender: value === "unspecified" ? "" : value,
                        }))
                      }
                    >
                      <SelectTrigger id="create-gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unspecified">Select gender</SelectItem>
                        {USER_GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.role === "student" ? (
                  <div className="app-form-callout">
                    <p className="font-semibold text-foreground">Student sign-in</p>
                    <p className="mt-1.5">
                      Username uses the roll number. The first password uses the saved phone
                      digits.
                    </p>
                  </div>
                ) : (
                  <div className="app-field-group">
                    <Label htmlFor="create-password">Password</Label>
                    <Input
                      id="create-password"
                      name="password"
                      type="password"
                      placeholder="Set the first password"
                      value={formData.password}
                      onChange={handleInputChange}
                    />
                  </div>
                )}
              </div>

              {formData.role === "student" ? (
                <div className="app-section space-y-4">
                  <p className="app-form-section-title">Student placement</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="create-student-class">Class</Label>
                      <Select value={formData.classId} onValueChange={handleClassChange}>
                        <SelectTrigger id="create-student-class">
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
                      <Label htmlFor="create-roll-number">Roll Number / Username</Label>
                      <Input
                        id="create-roll-number"
                        name="rollNumber"
                        placeholder="Roll number"
                        value={formData.rollNumber}
                        onChange={handleInputChange}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="create-student-section">Section</Label>
                      <Select
                        value={formData.academicSection || "none"}
                        onValueChange={(value) =>
                          setFormData((currentState) => ({
                            ...currentState,
                            academicSection: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger id="create-student-section">
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
                      <Label htmlFor="create-enrolled-at">Enrolled At</Label>
                      <Input
                        id="create-enrolled-at"
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
                  <p className="app-form-section-title">Academic access</p>

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
                        className="p-2.5"
                        listClassName="max-h-44 p-2"
                        itemClassName="px-2.5 py-2"
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
                        className="p-2.5"
                        listClassName="max-h-44 p-2"
                        itemClassName="px-2.5 py-2"
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
                        className="p-2.5"
                        listClassName="max-h-44 p-2"
                        itemClassName="px-2.5 py-2"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Spinner /> : `Create ${activeRolePreset.title}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <BulkUploadPanel
          title={`Bulk upload ${activeRolePreset.title.toLowerCase()}s`}
          inputId="bulk-upload-users"
          onFileChange={handleBulkUpload}
          onDownloadTemplate={downloadTemplate}
          templateLabel={`Download ${activeRolePreset.title} Template`}
          loading={isBulkUploading}
          loadingLabel="Uploading users..."
          compact
          feedback={bulkFeedback}
          tips={WORKSPACE_USER_BULK_TEMPLATES[formData.role].tips}
        />
      )}
    </WorkspaceCreateShell>
  );
}
