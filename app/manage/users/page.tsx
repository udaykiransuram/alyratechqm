"use client";

import Link from "next/link";
import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Pencil,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import MultiSelectChecklist from "@/components/multi-select-checklist";
import PageHero from "@/components/layout/PageHero";
import { buildPartialLoadMessage, fetchApiJson, resolveClientSchoolKey } from "@/lib/client/api";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  mobileNumber?: string;
  class?: string;
  academicSection?: string;
  rollNumber?: string;
  enrolledAt?: string;
  classIds?: string[];
  academicSectionIds?: string[];
  subjectIds?: string[];
  hasAllClasses?: boolean;
  hasAllSections?: boolean;
  hasAllSubjects?: boolean;
}

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

type Role = "teacher" | "student" | "admin";
type EditableUser = Partial<User> & { password?: string };

const NO_SCHOOL_USERS_MESSAGE = "Select a school workspace to load users.";

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

const userAreaLinks = [
  {
    title: "Admins page",
    description: "Focused list for school admin records and maintenance.",
    href: "/admins",
    icon: ShieldCheck,
  },
  {
    title: "Teachers page",
    description: "Browse teacher records separately from student enrollment work.",
    href: "/teachers",
    icon: Users,
  },
  {
    title: "Students page",
    description: "Jump to student-centric records, tests, and roll-number navigation.",
    href: "/students",
    icon: GraduationCap,
  },
];

function resolveEffectiveAdminScope(state: {
  role?: Role | User["role"];
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

  const hasSelectedClasses =
    Array.isArray(state.classIds) && state.classIds.length > 0;
  const hasSelectedSubjects =
    Array.isArray(state.subjectIds) && state.subjectIds.length > 0;

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

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [sections, setSections] = useState<AcademicSectionItem[]>([]);
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    password: string;
    mobileNumber: string;
    role: Role;
    classId?: string;
    academicSection?: string;
    rollNumber?: string;
    enrolledAt?: string;
    classIds: string[];
    academicSectionIds: string[];
    subjectIds: string[];
    hasAllClasses: boolean;
    hasAllSections: boolean;
    hasAllSubjects: boolean;
  }>({
    name: "",
    email: "",
    password: "",
    mobileNumber: "",
    role: "teacher",
    classId: "",
    academicSection: "",
    rollNumber: "",
    enrolledAt: "",
    classIds: [],
    academicSectionIds: [],
    subjectIds: [],
    hasAllClasses: false,
    hasAllSections: true,
    hasAllSubjects: false,
  });
  const [editData, setEditData] = useState<EditableUser>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [supportDataNotice, setSupportDataNotice] = useState<string | null>(null);
  const [currentSchoolKey, setCurrentSchoolKey] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 100;

  const { toast } = useToast();

  const loadUsers = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      setListError(null);

      const schoolKey = resolveClientSchoolKey();
      setCurrentSchoolKey(schoolKey);
      if (!schoolKey) {
        setUsers([]);
        setTotal(0);
        setPages(1);
        setPage(1);
        setListError(NO_SCHOOL_USERS_MESSAGE);
        return;
      }

      const data = await fetchApiJson<any>(`/api/users?limit=${limit}&page=${pageNum}`, {
        cache: "no-store",
        schoolKey,
        fallbackMessage: "Failed to load users.",
      });

      setUsers(Array.isArray(data.users) ? data.users : []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || pageNum);
    } catch (err: any) {
      const message = err.message || "Failed to load users.";
      setUsers([]);
      setTotal(0);
      setPages(1);
      setPage(1);
      setListError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const schoolKey = resolveClientSchoolKey();
      setCurrentSchoolKey(schoolKey);

      if (!schoolKey) {
        setSupportDataNotice('Select a school workspace to load class, section, and subject options.');
        await loadUsers(1);
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

      if (classesResult.status === "fulfilled") {
        setClasses(Array.isArray(classesResult.value.classes) ? classesResult.value.classes : []);
      }
      if (sectionsResult.status === "fulfilled") {
        setSections(Array.isArray(sectionsResult.value.sections) ? sectionsResult.value.sections : []);
      }
      if (subjectsResult.status === "fulfilled") {
        setSubjects(Array.isArray(subjectsResult.value.subjects) ? subjectsResult.value.subjects : []);
      }

      setSupportDataNotice(
        buildPartialLoadMessage([
          ...(classesResult.status === "rejected" ? ["Class scope options"] : []),
          ...(sectionsResult.status === "rejected" ? ["Section scope options"] : []),
          ...(subjectsResult.status === "rejected" ? ["Subject scope options"] : []),
        ]),
      );

      await loadUsers(1);
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableCreateSections = useMemo(() => {
    if (formData.role === "student") {
      if (!formData.classId) return [] as AcademicSectionItem[];
      return sections.filter((section) => getSectionClassId(section) === formData.classId);
    }
    if (formData.role === "admin" && formData.hasAllClasses) {
      return sections;
    }
    const selectedClassIds = new Set(formData.classIds);
    return sections.filter((section) => selectedClassIds.has(getSectionClassId(section)));
  }, [formData.classId, formData.classIds, formData.hasAllClasses, formData.role, sections]);

  const availableCreateSectionIds = useMemo(
    () => new Set(availableCreateSections.map((section) => section._id)),
    [availableCreateSections],
  );

  const availableEditSections = useMemo(() => {
    if (editData.role === "student") {
      if (!editData.class) return [] as AcademicSectionItem[];
      return sections.filter((section) => getSectionClassId(section) === editData.class);
    }
    if (editData.role === "admin" && editData.hasAllClasses === true) {
      return sections;
    }
    const selectedClassIds = new Set(editData.classIds || []);
    return sections.filter((section) => selectedClassIds.has(getSectionClassId(section)));
  }, [editData.class, editData.classIds, editData.hasAllClasses, editData.role, sections]);

  const availableEditSectionIds = useMemo(
    () => new Set(availableEditSections.map((section) => section._id)),
    [availableEditSections],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: Role) => {
    setFormData((prev) => ({
      ...prev,
      role: value,
      classId: value === "student" ? prev.classId : "",
      academicSection: value === "student" ? prev.academicSection : "",
      rollNumber: value === "student" ? prev.rollNumber : "",
      enrolledAt: value === "student" ? prev.enrolledAt : "",
      classIds: value === "student" ? [] : prev.classIds,
      academicSectionIds: value === "student" ? [] : prev.academicSectionIds,
      subjectIds: value === "student" ? [] : prev.subjectIds,
      hasAllClasses:
        value === "admin" ? (prev.role === "admin" ? prev.hasAllClasses : true) : false,
      hasAllSections:
        value === "student"
          ? false
          : value === "admin"
            ? prev.role === "admin"
              ? prev.hasAllSections
              : true
            : true,
      hasAllSubjects:
        value === "admin" ? (prev.role === "admin" ? prev.hasAllSubjects : true) : false,
    }));
  };

  const handleClassChange = (value: string) => {
    setFormData((prev) => ({ ...prev, classId: value, academicSection: "" }));
  };

  const setCreateMultiValues = (
    field: "classIds" | "subjectIds" | "academicSectionIds",
    nextValues: string[],
  ) => {
    setFormData((prev) => {
      if (field !== "classIds") {
        return { ...prev, [field]: nextValues };
      }

      const nextClassIds = nextValues;
      const nextClassIdSet = new Set(nextClassIds);
      const nextAcademicSectionIds = prev.academicSectionIds.filter((sectionId) => {
        if (prev.role === "admin" && prev.hasAllClasses) return true;
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

  const setEditMultiValues = (
    field: "classIds" | "subjectIds" | "academicSectionIds",
    nextValues: string[],
  ) => {
    setEditData((prev) => {
      if (field !== "classIds") {
        return { ...prev, [field]: nextValues };
      }

      const nextClassIds = nextValues;
      const nextClassIdSet = new Set(nextClassIds);
      const nextAcademicSectionIds = (prev.academicSectionIds || []).filter((sectionId) => {
        if (prev.role === "admin" && prev.hasAllClasses === true) return true;
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

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const effectiveAdminScope = resolveEffectiveAdminScope(formData);

      if (!formData.mobileNumber.trim()) {
        throw new Error("Phone Number is required.");
      }
      if (
        formData.role === "student" &&
        (!formData.classId || !formData.rollNumber)
      ) {
        throw new Error(
          "For Student role, Class and Roll Number are required.",
        );
      }
      if (
        formData.role === "teacher" &&
        (formData.classIds.length === 0 || formData.subjectIds.length === 0)
      ) {
        throw new Error(
          "For Teacher role, select at least one class and one subject.",
        );
      }
      if (
        formData.role === "teacher" &&
        !formData.hasAllSections &&
        formData.academicSectionIds.filter((sectionId) => availableCreateSectionIds.has(sectionId)).length === 0
      ) {
        throw new Error("Select at least one section or enable all sections.");
      }
      const body: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        mobileNumber: formData.mobileNumber,
        role: formData.role,
      };
      if (formData.role === "student") {
        body.class = formData.classId;
        body.academicSection = formData.academicSection || undefined;
        body.rollNumber = formData.rollNumber;
        body.enrolledAt = formData.enrolledAt
          ? new Date(formData.enrolledAt)
          : undefined;
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
          : formData.academicSectionIds.filter((sectionId) => availableCreateSectionIds.has(sectionId));
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
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error(NO_SCHOOL_USERS_MESSAGE);
      }
      const data = await fetchApiJson<any>("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        schoolKey,
        fallbackMessage: "Failed to create user.",
      });
      toast({
        title: "Success",
        description: `User "${data.user.name}" created.`,
      });
      await loadUsers(page);
      setFormData({
        name: "",
        email: "",
        password: "",
        mobileNumber: "",
        role: "teacher",
        classId: "",
        academicSection: "",
        rollNumber: "",
        enrolledAt: "",
        classIds: [],
        academicSectionIds: [],
        subjectIds: [],
        hasAllClasses: false,
        hasAllSections: true,
        hasAllSubjects: false,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (
      !editData._id ||
      !editData.name ||
      !editData.role ||
      !editData.mobileNumber
    ) {
      return;
    }
    setIsEditing(true);
    try {
      const effectiveAdminScope = resolveEffectiveAdminScope({
        role: editData.role,
        classIds: editData.classIds || [],
        subjectIds: editData.subjectIds || [],
        hasAllClasses: editData.hasAllClasses,
        hasAllSections: editData.hasAllSections,
        hasAllSubjects: editData.hasAllSubjects,
      });

      if (editData.role === "student" && (!editData.class || !editData.rollNumber)) {
        throw new Error("For Student role, Class and Roll Number are required.");
      }
      if (
        editData.role === "teacher" &&
        ((editData.classIds || []).length === 0 || (editData.subjectIds || []).length === 0)
      ) {
        throw new Error("For Teacher role, select at least one class and one subject.");
      }
      if (
        editData.role === "teacher" &&
        editData.hasAllSections !== true &&
        (editData.academicSectionIds || []).filter((sectionId) =>
          availableEditSectionIds.has(sectionId),
        ).length === 0
      ) {
        throw new Error("Select at least one section or enable all sections.");
      }

      const body: any = {
        name: editData.name,
        role: editData.role,
        email: editData.email,
        mobileNumber: editData.mobileNumber,
      };
      if (editData.password && editData.password.trim()) {
        body.password = editData.password;
      }

      if (editData.role === "student") {
        body.class = editData.class;
        body.academicSection = editData.academicSection || undefined;
        body.rollNumber = editData.rollNumber;
        body.enrolledAt = editData.enrolledAt;
      } else {
        body.classIds =
          editData.role === "admin" && effectiveAdminScope.hasAllClasses
            ? []
            : editData.classIds;
        body.academicSectionIds =
          (editData.role === "admin"
            ? effectiveAdminScope.hasAllSections
            : editData.hasAllSections)
          ? []
          : (editData.academicSectionIds || []).filter((sectionId) =>
              availableEditSectionIds.has(sectionId),
            );
        body.subjectIds =
          editData.role === "admin" && effectiveAdminScope.hasAllSubjects
            ? []
            : editData.subjectIds;
        body.hasAllClasses =
          editData.role === "admin" ? effectiveAdminScope.hasAllClasses : false;
        body.hasAllSections =
          editData.role === "admin"
            ? effectiveAdminScope.hasAllSections
            : editData.hasAllSections;
        body.hasAllSubjects =
          editData.role === "admin" ? effectiveAdminScope.hasAllSubjects : false;
      }

      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error(NO_SCHOOL_USERS_MESSAGE);
      }
      await fetchApiJson(`/api/users/${editData._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        schoolKey,
        fallbackMessage: "Failed to update user.",
      });
      toast({ title: "Success", description: "User updated successfully." });
      await loadUsers(page);
      setIsEditDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleArchiveUser = async (userId: string) => {
    try {
      const schoolKey = resolveClientSchoolKey();
      if (!schoolKey) {
        throw new Error(NO_SCHOOL_USERS_MESSAGE);
      }
      await fetchApiJson(`/api/users/${userId}`, {
        method: "DELETE",
        schoolKey,
        fallbackMessage: "Failed to archive user.",
      });
      toast({ title: "Success", description: "User archived successfully." });
      await loadUsers(page);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const getScopeSummary = (user: User) => {
    if (user.role === "student") {
      const className = classes.find((item) => item._id === user.class)?.name || user.class || "—";
      const sectionName = sections.find((item) => item._id === user.academicSection)?.name;
      return sectionName ? `${className} • ${sectionName}` : className;
    }

    const classLabel =
      user.role === "admin" && user.hasAllClasses
        ? 'All classes'
        : `${(user.classIds || []).length} class${(user.classIds || []).length === 1 ? '' : 'es'}`;
    const sectionLabel =
      user.hasAllSections
        ? 'all sections'
        : `${(user.academicSectionIds || []).length} section${(user.academicSectionIds || []).length === 1 ? '' : 's'}`;
    return `${classLabel} • ${sectionLabel}`;
  };

  const adminCount = useMemo(
    () => users.filter((user) => user.role === "admin").length,
    [users],
  );
  const teacherCount = useMemo(
    () => users.filter((user) => user.role === "teacher").length,
    [users],
  );
  const studentCount = useMemo(
    () => users.filter((user) => user.role === "student").length,
    [users],
  );

  return (
    <div className="app-page-shell max-w-[88rem] px-4 py-6 sm:px-0">
      <PageHero
        eyebrow="School Workspace"
        title="User Management"
        description="Create, view, and manage school user accounts from a single, role-aware workspace."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadUsers(page)}
            disabled={isLoading}
          >
            {isLoading ? <Spinner /> : "Refresh"}
          </Button>
        }
        meta={
          <>
            <span className="app-meta-chip">
              {currentSchoolKey ? `School: ${currentSchoolKey}` : "No school selected"}
            </span>
            <span className="app-meta-chip">Students use roll number login</span>
          </>
        }
        stats={[
          {
            label: "Total users",
            value: String(total),
            meta: currentSchoolKey
              ? "Users currently loaded for this school."
              : "Pick a school workspace to manage users.",
          },
          {
            label: "Admins",
            value: String(adminCount),
            meta: "Tenant admins with school management access.",
          },
          {
            label: "Teachers",
            value: String(teacherCount),
            meta: "Teaching accounts scoped by class, section, and subject.",
          },
          {
            label: "Students",
            value: String(studentCount),
            meta: "Learners who can sign in and access online tests.",
          },
        ]}
      />

      {supportDataNotice ? <div className="app-feedback app-feedback-info">{supportDataNotice}</div> : null}

      <div className="app-spotlight-grid">
        <div className="app-spotlight-card app-spotlight-card-strong">
          <p className="app-spotlight-label">Access model</p>
          <h2 className="app-spotlight-title">
            Onboard school users from one place, then move into focused role pages
          </h2>
          <p className="app-spotlight-copy">
            This screen is the unified control point for account creation,
            password reset, and role scope. The dedicated admin, teacher, and
            student pages still stay available for day-to-day browsing.
          </p>
          <div className="app-inline-stat-grid">
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Admins</p>
              <p className="app-inline-stat-value">{adminCount}</p>
              <p className="app-inline-stat-copy">
                Tenant operators with school-level management access.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Teachers</p>
              <p className="app-inline-stat-value">{teacherCount}</p>
              <p className="app-inline-stat-copy">
                Accounts scoped by academic assignments and subject ownership.
              </p>
            </div>
            <div className="app-inline-stat">
              <p className="app-inline-stat-label">Students</p>
              <p className="app-inline-stat-value">{studentCount}</p>
              <p className="app-inline-stat-copy">
                Students sign in with roll number as username and can later change passwords.
              </p>
            </div>
          </div>
        </div>

        <div className="app-surface app-surface-body">
          <p className="app-spotlight-label">Navigation shortcuts</p>
          <h2 className="text-lg font-semibold text-foreground">
            Dedicated lists stay easy to reach
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Use this page for creation and access control, then switch to the
            focused role pages when you want narrower browsing.
          </p>
          <div className="app-link-grid">
            {userAreaLinks.map((area) => {
              const Icon = area.icon;
              return (
                <Link key={area.title} href={area.href} className="app-link-card">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="app-link-card-title">{area.title}</p>
                      <p className="app-link-card-copy">{area.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-6">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <CardTitle>Create New User</CardTitle>
              <CardDescription>
                Add admins, teachers, and students without leaving the main management screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="app-section-body">
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Choose role
                    </p>
                    <Badge variant="outline" className="text-[11px]">
                      Unified create flow
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {rolePresets.map((preset) => {
                      const Icon = preset.icon;
                      const isActive = formData.role === preset.value;

                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => handleRoleChange(preset.value)}
                          className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                            isActive
                              ? "border-primary/40 bg-primary/5 shadow-sm"
                              : "border-border/70 bg-background hover:bg-accent/40"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-foreground">
                                {preset.title}
                              </div>
                              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                                {preset.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="app-section space-y-4">
                  <div>
                    <p className="app-spotlight-label">Basic details</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Set the user identity and first-time sign-in credentials.
                    </p>
                  </div>
                  <Input
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    name="email"
                    type="email"
                    placeholder={
                      formData.role === "student"
                        ? "Email Address (optional)"
                        : "Email Address"
                    }
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                  <Input
                    name="mobileNumber"
                    placeholder="Phone Number"
                    value={formData.mobileNumber}
                    onChange={handleInputChange}
                    required
                  />
                  <Input
                    name="password"
                    type="password"
                    placeholder={
                      formData.role === "student"
                        ? "Leave blank to use roll number"
                        : "Password"
                    }
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                  {formData.role === "student" ? (
                    <p className="text-xs text-muted-foreground">
                      Students sign in with roll number. If you leave password blank, the first password will match the roll number.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Teachers and admins continue to sign in with email plus password.
                    </p>
                  )}
                </div>
                {formData.role === "student" && (
                  <div className="app-section space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Roll number becomes the student username for sign in.
                    </p>
                    <div className="space-y-2">
                      <Label>Class</Label>
                      <Select
                        value={formData.classId}
                        onValueChange={handleClassChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Class" />
                        </SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.name}
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
                          setFormData((prev) => ({
                            ...prev,
                            academicSection: value === "none" ? "" : value,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Section</SelectItem>
                          {availableCreateSections.map((section) => (
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
                        placeholder="Roll Number"
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
                )}
                {(formData.role === "teacher" || formData.role === "admin") && (
                  <div className="app-section space-y-4">
                    {formData.role === "admin" && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Admins default to full school access. Turn these off only if you want to restrict the admin to specific classes, sections, or subjects.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={formData.hasAllClasses}
                              onCheckedChange={(checked) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  hasAllClasses: checked === true,
                                }))
                              }
                            />
                            <span>All Classes</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={formData.hasAllSubjects}
                              onCheckedChange={(checked) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  hasAllSubjects: checked === true,
                                }))
                              }
                            />
                            <span>All Subjects</span>
                          </label>
                        </div>
                      </div>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={formData.hasAllSections}
                        onCheckedChange={(checked) =>
                          setFormData((prev) => ({
                            ...prev,
                            hasAllSections: checked === true,
                            academicSectionIds: checked === true ? [] : prev.academicSectionIds,
                          }))
                        }
                      />
                      <span>All Sections</span>
                    </label>
                    {!formData.hasAllClasses && (
                      <div className="space-y-2">
                        <Label>Classes</Label>
                        <MultiSelectChecklist
                          items={classes.map((classItem) => ({
                            id: classItem._id,
                            label: classItem.name,
                          }))}
                          selectedIds={formData.classIds}
                          onChange={(ids) => setCreateMultiValues("classIds", ids)}
                        />
                      </div>
                    )}
                    {!formData.hasAllSections && (
                      <div className="space-y-2">
                        <Label>Sections</Label>
                        <MultiSelectChecklist
                          items={availableCreateSections.map((section) => ({
                            id: section._id,
                            label: (
                              <span>
                                {section.name}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({classes.find((item) => item._id === getSectionClassId(section))?.name || 'Class'})
                                </span>
                              </span>
                            ),
                          }))}
                          selectedIds={formData.academicSectionIds}
                          onChange={(ids) => setCreateMultiValues("academicSectionIds", ids)}
                          emptyContent={formData.role === "admin" && formData.hasAllClasses
                            ? "No sections created yet."
                            : "Select classes first."}
                        />
                      </div>
                    )}
                    {!formData.hasAllSubjects && (
                      <div className="space-y-2">
                        <Label>Subjects</Label>
                        <MultiSelectChecklist
                          items={subjects.map((subject) => ({
                            id: subject._id,
                            label: subject.name,
                          }))}
                          selectedIds={formData.subjectIds}
                          onChange={(ids) => setCreateMultiValues("subjectIds", ids)}
                        />
                      </div>
                    )}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? <Spinner /> : "Create User"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-3">
          <Card className="app-surface overflow-hidden">
            <CardHeader className="app-section-header">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>Existing Users</CardTitle>
                  <CardDescription>
                    Review current users, reset passwords, and keep school access roles organized.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Roll-number student usernames</Badge>
                  <Badge variant="outline">Password reset from edit</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="app-section-body">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : listError ? (
                <div className={listError === NO_SCHOOL_USERS_MESSAGE ? "app-feedback app-feedback-info" : "app-feedback app-feedback-error"}>
                  {listError}
                </div>
              ) : (
                <>
                  <div className="app-toolbar mb-4">
                    <div className="app-toolbar-row">
                      <div className="app-toolbar-copy">
                        <p className="app-toolbar-title">Loaded users</p>
                        <p className="app-toolbar-note">
                          Total {total} users. Page {page} of {pages}.
                        </p>
                      </div>
                      <div className="app-toolbar-actions">
                        <Badge variant="outline">{adminCount} admins</Badge>
                        <Badge variant="outline">{teacherCount} teachers</Badge>
                        <Badge variant="outline">{studentCount} students</Badge>
                      </div>
                      <div className="app-toolbar-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() => loadUsers(page - 1)}
                        >
                          <ChevronLeft className="h-4 w-4" /> Prev
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page >= pages}
                          onClick={() => loadUsers(page + 1)}
                        >
                          Next <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="app-table-wrap">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Scope</TableHead>
                          <TableHead className="text-right w-[180px]">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                              No users found for the selected school.
                            </TableCell>
                          </TableRow>
                        ) : users.map((user) => (
                        <TableRow key={user._id}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div>{user.name}</div>
                              {user.role === "student" && user.rollNumber ? (
                                <div className="text-xs text-muted-foreground">
                                  Username: {user.rollNumber}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>{user.email || "—"}</TableCell>
                          <TableCell>{user.mobileNumber || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                user.role === "admin" ? "default" : "secondary"
                              }
                              className="capitalize"
                            >
                              {user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {getScopeSummary(user)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Dialog
                                open={
                                  isEditDialogOpen && editData._id === user._id
                                }
                                onOpenChange={(open) => {
                                  if (!open) setEditData({});
                                  setIsEditDialogOpen(open);
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const initialAdminScope = resolveEffectiveAdminScope({
                                        role: user.role,
                                        classIds: user.classIds || [],
                                        subjectIds: user.subjectIds || [],
                                        hasAllClasses: user.hasAllClasses || false,
                                        hasAllSections:
                                          typeof user.hasAllSections === "boolean"
                                            ? user.hasAllSections
                                            : user.role === "student"
                                              ? false
                                              : true,
                                        hasAllSubjects: user.hasAllSubjects || false,
                                      });

                                      setEditData({
                                        ...user,
                                        class: user.class || "",
                                        academicSection: user.academicSection || "",
                                        classIds: user.classIds || [],
                                        academicSectionIds: user.academicSectionIds || [],
                                        subjectIds: user.subjectIds || [],
                                        hasAllClasses: initialAdminScope.hasAllClasses,
                                        hasAllSections: initialAdminScope.hasAllSections,
                                        hasAllSubjects: initialAdminScope.hasAllSubjects,
                                        rollNumber: user.rollNumber || "",
                                        enrolledAt: user.enrolledAt || "",
                                        password: "",
                                      });
                                      setIsEditDialogOpen(true);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>
                                      Edit User: {editData.name}
                                    </DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-name">Name</Label>
                                      <Input
                                        id="edit-name"
                                        value={editData.name || ""}
                                        onChange={(e) =>
                                          setEditData((d) => ({
                                            ...d,
                                            name: e.target.value,
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Email (cannot be changed)</Label>
                                      <Input
                                        value={editData.email || ""}
                                        disabled
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-mobile">
                                        Phone Number
                                      </Label>
                                      <Input
                                        id="edit-mobile"
                                        value={editData.mobileNumber || ""}
                                        onChange={(e) =>
                                          setEditData((d) => ({
                                            ...d,
                                            mobileNumber: e.target.value,
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-password">
                                        Reset Password
                                      </Label>
                                      <Input
                                        id="edit-password"
                                        type="password"
                                        placeholder={
                                          editData.role === "student"
                                            ? "Leave blank to keep current password"
                                            : "Leave blank to keep the current password"
                                        }
                                        value={editData.password || ""}
                                        onChange={(e) =>
                                          setEditData((d) => ({
                                            ...d,
                                            password: e.target.value,
                                          }))
                                        }
                                      />
                                      {editData.role === "student" ? (
                                        <p className="text-xs text-muted-foreground">
                                          Enter the roll number to reset the student back to the default password.
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-role">Role</Label>
                                      <Select
                                        value={editData.role}
                                        onValueChange={(value) =>
                                          setEditData((d) => ({
                                            ...d,
                                            role: value as User["role"],
                                            class:
                                              value === "student" ? d.class || "" : "",
                                            academicSection:
                                              value === "student"
                                                ? d.academicSection || ""
                                                : "",
                                            classIds:
                                              value === "student" ? [] : d.classIds || [],
                                            academicSectionIds:
                                              value === "student"
                                                ? []
                                                : d.academicSectionIds || [],
                                            subjectIds:
                                              value === "student" ? [] : d.subjectIds || [],
                                            hasAllClasses:
                                              value === "admin"
                                                ? d.role === "admin"
                                                  ? d.hasAllClasses || false
                                                  : true
                                                : false,
                                            hasAllSections:
                                              value === "student"
                                                ? false
                                                : value === "admin"
                                                  ? d.role === "admin"
                                                    ? d.hasAllSections ?? true
                                                    : true
                                                  : true,
                                            hasAllSubjects:
                                              value === "admin"
                                                ? d.role === "admin"
                                                  ? d.hasAllSubjects || false
                                                  : true
                                                : false,
                                            rollNumber:
                                              value === "student" ? d.rollNumber || "" : "",
                                            enrolledAt:
                                              value === "student" ? d.enrolledAt || "" : "",
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="teacher">
                                            Teacher
                                          </SelectItem>
                                          <SelectItem value="student">
                                            Student
                                          </SelectItem>
                                          <SelectItem value="admin">
                                            Admin
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {editData.role === "student" && (
                                      <div className="app-section space-y-4">
                                        <p className="text-xs text-muted-foreground">
                                          Students sign in with roll number as their username.
                                        </p>
                                        <div className="space-y-2">
                                          <Label>Class</Label>
                                          <Select
                                            value={editData.class || ""}
                                            onValueChange={(value) =>
                                              setEditData((d) => ({
                                                ...d,
                                                class: value,
                                                academicSection: "",
                                              }))
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select Class" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {classes.map((c) => (
                                                <SelectItem key={c._id} value={c._id}>
                                                  {c.name}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Section</Label>
                                          <Select
                                            value={editData.academicSection || "none"}
                                            onValueChange={(value) =>
                                              setEditData((d) => ({
                                                ...d,
                                                academicSection: value === "none" ? "" : value,
                                              }))
                                            }
                                          >
                                            <SelectTrigger>
                                              <SelectValue placeholder="Select Section" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="none">No Section</SelectItem>
                                              {availableEditSections.map((section) => (
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
                                            value={editData.rollNumber || ""}
                                            onChange={(e) =>
                                              setEditData((d) => ({
                                                ...d,
                                                rollNumber: e.target.value,
                                              }))
                                            }
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Enrolled At</Label>
                                          <Input
                                            type="date"
                                            value={
                                              editData.enrolledAt
                                                ? String(editData.enrolledAt).slice(0, 10)
                                                : ""
                                            }
                                            onChange={(e) =>
                                              setEditData((d) => ({
                                                ...d,
                                                enrolledAt: e.target.value,
                                              }))
                                            }
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {(editData.role === "teacher" ||
                                      editData.role === "admin") && (
                                      <div className="app-section space-y-4">
                                        {editData.role === "admin" && (
                                          <div className="space-y-2">
                                            <p className="text-xs text-muted-foreground">
                                              Admins default to full school access. Turn these off only if you want to restrict the admin to specific classes, sections, or subjects.
                                            </p>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                              <label className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                  checked={editData.hasAllClasses === true}
                                                  onCheckedChange={(checked) =>
                                                    setEditData((d) => ({
                                                      ...d,
                                                      hasAllClasses: checked === true,
                                                    }))
                                                  }
                                                />
                                                <span>All Classes</span>
                                              </label>
                                              <label className="flex items-center gap-2 text-sm">
                                                <Checkbox
                                                  checked={editData.hasAllSubjects === true}
                                                  onCheckedChange={(checked) =>
                                                    setEditData((d) => ({
                                                      ...d,
                                                      hasAllSubjects: checked === true,
                                                    }))
                                                  }
                                                />
                                                <span>All Subjects</span>
                                              </label>
                                            </div>
                                          </div>
                                        )}
                                        <label className="flex items-center gap-2 text-sm">
                                          <Checkbox
                                            checked={editData.hasAllSections === true}
                                            onCheckedChange={(checked) =>
                                              setEditData((d) => ({
                                                ...d,
                                                hasAllSections: checked === true,
                                                academicSectionIds:
                                                  checked === true ? [] : d.academicSectionIds || [],
                                              }))
                                            }
                                          />
                                          <span>All Sections</span>
                                        </label>
                                        {editData.hasAllClasses !== true && (
                                          <div className="space-y-2">
                                            <Label>Classes</Label>
                                            <MultiSelectChecklist
                                              items={classes.map((classItem) => ({
                                                id: classItem._id,
                                                label: classItem.name,
                                              }))}
                                              selectedIds={editData.classIds || []}
                                              onChange={(ids) => setEditMultiValues("classIds", ids)}
                                            />
                                          </div>
                                        )}
                                        {editData.hasAllSections !== true && (
                                          <div className="space-y-2">
                                            <Label>Sections</Label>
                                            <MultiSelectChecklist
                                              items={availableEditSections.map((section) => ({
                                                id: section._id,
                                                label: (
                                                  <span>
                                                    {section.name}
                                                    <span className="ml-1 text-xs text-muted-foreground">
                                                      ({classes.find((item) => item._id === getSectionClassId(section))?.name || 'Class'})
                                                    </span>
                                                  </span>
                                                ),
                                              }))}
                                              selectedIds={editData.academicSectionIds || []}
                                              onChange={(ids) => setEditMultiValues("academicSectionIds", ids)}
                                              emptyContent={editData.role === "admin" && editData.hasAllClasses === true
                                                ? "No sections created yet."
                                                : "Select classes first."}
                                            />
                                          </div>
                                        )}
                                        {editData.hasAllSubjects !== true && (
                                          <div className="space-y-2">
                                            <Label>Subjects</Label>
                                            <MultiSelectChecklist
                                              items={subjects.map((subject) => ({
                                                id: subject._id,
                                                label: subject.name,
                                              }))}
                                              selectedIds={editData.subjectIds || []}
                                              onChange={(ids) => setEditMultiValues("subjectIds", ids)}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <DialogFooter>
                                    <DialogClose asChild>
                                      <Button variant="outline">Cancel</Button>
                                    </DialogClose>
                                    <Button
                                      onClick={handleEditUser}
                                      disabled={isEditing}
                                    >
                                      {isEditing && <Spinner />} Save Changes
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                    Archive
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Archive user?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will archive the user{" "}
                                      <strong className="mx-1">
                                        {user.name}
                                      </strong>
                                      .
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleArchiveUser(user._id)}
                                    >
                                      Archive
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
