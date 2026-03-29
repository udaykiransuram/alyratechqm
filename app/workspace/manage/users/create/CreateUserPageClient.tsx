"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { GraduationCap, ShieldCheck, Users } from "lucide-react";

import MultiSelectChecklist from "@/components/multi-select-checklist";
import BulkUploadPanel from "@/components/workspace/BulkUploadPanel";
import WorkspaceCreateGuideCard from "@/components/workspace/WorkspaceCreateGuideCard";
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
    note: "Full-school or restricted operations",
    description: "School-wide operators with full or restricted academic scope.",
    icon: ShieldCheck,
  },
  {
    value: "teacher" as const,
    title: "Teacher",
    note: "Class and subject-scoped access",
    description: "Teaching accounts scoped by classes, sections, and subjects.",
    icon: Users,
  },
  {
    value: "student" as const,
    title: "Student",
    note: "Roll-number sign-in for tests",
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

  const roleGuidance =
    formData.role === "student"
      ? "Students sign in with their roll number, and the first password defaults to the saved phone-number digits exactly as stored (including country code digits, if saved)."
      : formData.role === "admin"
        ? "Admins can stay school-wide or be narrowed to selected classes, sections, and subjects."
        : "Teachers need at least one class and one subject, with optional all-section access.";

  const bulkUploadDescription =
    formData.role === "student"
      ? "Import students with class, section, roll number, and contact details."
      : formData.role === "admin"
        ? "Import admins in bulk and decide whether they stay school-wide or use a narrower academic scope."
        : "Import teachers in bulk with the class, section, and subject scope they need.";

  const createGuideItems =
    formData.role === "student"
      ? [
          {
            title: "Roll number becomes login",
            note: "Students use the roll number as the username, while the first password uses saved phone-number digits exactly as stored.",
          },
          {
            title: "Class comes first",
            note: "Pick the class before the section so placement and test eligibility stay accurate.",
          },
          {
            title: "Bulk import is ready",
            note: "Use the template when a whole class needs to be created together.",
          },
        ]
      : formData.role === "admin"
        ? [
            {
              title: "Admins can stay school-wide",
              note: "Leave everything open when this admin should operate across the full school.",
            },
            {
              title: "Narrow scope only when needed",
              note: "Use classes, sections, and subjects only when the admin should stay restricted.",
            },
            {
              title: "Keep leadership covered",
              note: "Make sure each school always has at least one active admin who can manage users.",
            },
          ]
        : [
            {
              title: "Choose classes and subjects",
              note: "Teachers need at least one class and one subject before the account is useful.",
            },
            {
              title: "Keep all sections on when possible",
              note: "Only narrow section access when the teacher should not see every section in the selected classes.",
            },
            {
              title: "Bulk import handles bigger teams",
              note: "Use the template when you need to assign multiple teachers in one go.",
            },
          ];

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
    <WorkspaceCreateShell
      eyebrow="School workspace"
      title="Create users"
      description="Use one focused screen to create students, teachers, or school admins without leaving the active school context."
      backLabel="Back to Users"
      onBack={navigateBack}
      badges={
        <>
          <span className="app-meta-chip">{`Role: ${activeRolePreset.title}`}</span>
          <span className="app-meta-chip">
            {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
          </span>
          <span className="app-meta-chip">Bulk import ready</span>
        </>
      }
      aside={
        <>
          <WorkspaceCreateGuideCard
            title={`${activeRolePreset.title} setup`}
            description={activeRolePreset.description}
            items={createGuideItems}
          />

          <BulkUploadPanel
            title={`Bulk Upload ${activeRolePreset.title}s`}
            description={bulkUploadDescription}
            inputId="bulk-upload-users"
            onFileChange={handleBulkUpload}
            onDownloadTemplate={downloadTemplate}
            templateLabel={`Download ${activeRolePreset.title} Template`}
            loading={isBulkUploading}
            loadingLabel="Uploading users..."
            disabled={initialClasses.length === 0 && formData.role !== "admin"}
            feedback={bulkFeedback}
            tips={WORKSPACE_USER_BULK_TEMPLATES[formData.role].tips}
          />
        </>
      }
    >
      {feedback ? (
        <FeedbackNotice variant={feedback.variant}>{feedback.message}</FeedbackNotice>
      ) : null}

      <Card className="app-surface overflow-hidden">
        <CardHeader className="app-section-header space-y-2.5">
          <CardTitle>Create individual user</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Choose the role first, then enter identity details and the right school scope.
          </p>
        </CardHeader>
        <CardContent className="app-section-body">
          <form onSubmit={handleCreateUser} className="space-y-6">
            <div className="space-y-3">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">Account role</p>
                <p className="app-form-section-copy">
                  Switch roles here to reveal only the fields that matter for this account type.
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
                          <div className="app-role-switcher-note">{preset.note}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="app-form-callout">
                <p className="font-semibold text-foreground">{`${activeRolePreset.title} accounts`}</p>
                <p className="mt-1.5">{roleGuidance}</p>
              </div>
            </div>

            <div className="app-section space-y-4">
              <div className="app-form-section-heading">
                <p className="app-form-section-title">Basic details</p>
                <p className="app-form-section-copy">
                  These are the core identity and contact fields visible to the school team.
                </p>
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
                <div className="app-form-callout">
                <p className="font-semibold text-foreground">Student sign-in</p>
                <p className="mt-1.5">
                    Username is the roll number. The initial password is the saved phone-number digits exactly as stored, including country code digits if they were saved.
                </p>
                <p className="mt-1.5">
                  If the student later changes the password or cannot sign in, admins can use the student detail/edit credentials panel to reset to phone digits or issue a temporary password.
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
                <div className="app-form-section-heading">
                  <p className="app-form-section-title">Student placement</p>
                  <p className="app-form-section-copy">
                    Choose class placement and the roll number the student will use to sign in.
                  </p>
                </div>

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
                <div className="app-form-section-heading">
                  <p className="app-form-section-title">Academic access</p>
                  <p className="app-form-section-copy">
                    Keep access school-wide, or narrow it to the exact classes, sections, and subjects this user should handle.
                  </p>
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
                          <span className="app-toggle-card-note">
                            Skip manual class selection and keep class coverage school-wide.
                          </span>
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
                          <span className="app-toggle-card-note">
                            Keep every subject available instead of narrowing to a smaller set.
                          </span>
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
                    <span className="app-toggle-card-note">
                      Use every section inside the chosen classes without selecting them one by one.
                    </span>
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
                      helperText={
                        formData.role === "admin"
                          ? "Pick classes only when this admin should not see the whole school."
                          : "Teachers need at least one class so their papers, analytics, and student workflows stay relevant."
                      }
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
                      helperText={
                        formData.role === "admin" && formData.hasAllClasses
                          ? "All sections in the school are available here."
                          : "Only sections connected to the selected classes appear here."
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
                      helperText={
                        formData.role === "admin"
                          ? "Pick subjects only when this admin should stay subject-scoped."
                          : "Teachers need at least one subject to work inside papers, questions, and analytics."
                      }
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
    </WorkspaceCreateShell>
  );
}
