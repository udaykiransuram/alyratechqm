"use client";

import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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

const NO_SCHOOL_USERS_MESSAGE = "Select a school workspace to load users.";

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
  const [editData, setEditData] = useState<Partial<User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [supportDataNotice, setSupportDataNotice] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(100);

  const { toast } = useToast();

  const loadUsers = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      setListError(null);

      const schoolKey = resolveClientSchoolKey();
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
      hasAllClasses: value === "admin" ? prev.hasAllClasses : false,
      hasAllSections: value === "student" ? false : value === "admin" ? prev.hasAllSections : true,
      hasAllSubjects: value === "admin" ? prev.hasAllSubjects : false,
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
        (formData.role === "teacher" || formData.role === "admin") &&
        !formData.hasAllSections &&
        formData.academicSectionIds.filter((sectionId) => availableCreateSectionIds.has(sectionId)).length === 0
      ) {
        throw new Error("Select at least one section or enable all sections.");
      }
      if (
        formData.role === "admin" &&
        ((!formData.hasAllClasses && formData.classIds.length === 0) ||
          (!formData.hasAllSubjects && formData.subjectIds.length === 0))
      ) {
        throw new Error(
          "For Admin role, enable all classes/subjects or select at least one class and one subject.",
        );
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
        body.classIds = formData.role === "admin" && formData.hasAllClasses ? [] : formData.classIds;
        body.academicSectionIds = formData.hasAllSections
          ? []
          : formData.academicSectionIds.filter((sectionId) => availableCreateSectionIds.has(sectionId));
        body.subjectIds = formData.role === "admin" && formData.hasAllSubjects ? [] : formData.subjectIds;
        body.hasAllClasses =
          formData.role === "admin" ? formData.hasAllClasses : false;
        body.hasAllSections = formData.hasAllSections;
        body.hasAllSubjects =
          formData.role === "admin" ? formData.hasAllSubjects : false;
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
        (editData.role === "teacher" || editData.role === "admin") &&
        editData.hasAllSections !== true &&
        (editData.academicSectionIds || []).filter((sectionId) =>
          availableEditSectionIds.has(sectionId),
        ).length === 0
      ) {
        throw new Error("Select at least one section or enable all sections.");
      }
      if (
        editData.role === "admin" &&
        ((!editData.hasAllClasses && (editData.classIds || []).length === 0) ||
          (!editData.hasAllSubjects && (editData.subjectIds || []).length === 0))
      ) {
        throw new Error(
          "For Admin role, enable all classes/subjects or select at least one class and one subject.",
        );
      }

      const body: any = {
        name: editData.name,
        role: editData.role,
        email: editData.email,
        mobileNumber: editData.mobileNumber,
      };

      if (editData.role === "student") {
        body.class = editData.class;
        body.academicSection = editData.academicSection || undefined;
        body.rollNumber = editData.rollNumber;
        body.enrolledAt = editData.enrolledAt;
      } else {
        body.classIds = editData.role === "admin" && editData.hasAllClasses ? [] : editData.classIds;
        body.academicSectionIds = editData.hasAllSections
          ? []
          : (editData.academicSectionIds || []).filter((sectionId) =>
              availableEditSectionIds.has(sectionId),
            );
        body.subjectIds = editData.role === "admin" && editData.hasAllSubjects ? [] : editData.subjectIds;
        body.hasAllClasses = editData.role === "admin" ? editData.hasAllClasses : false;
        body.hasAllSections = editData.hasAllSections;
        body.hasAllSubjects = editData.role === "admin" ? editData.hasAllSubjects : false;
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

  return (
    <div className="container space-y-6">
      <div className="app-page-header-row">
        <div>
          <h1 className="app-page-title">User Management</h1>
          <p className="app-page-subtitle">
            Create, view, and manage user accounts.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadUsers(page)} disabled={isLoading}>
          {isLoading ? <Spinner /> : "Refresh"}
        </Button>
      </div>

      {supportDataNotice ? <div className="app-feedback app-feedback-info">{supportDataNotice}</div> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
        <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New User</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateUser} className="space-y-4">
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
                  placeholder="Email Address"
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
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => handleRoleChange(v as Role)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.role === "student" && (
                  <div className="space-y-3 border rounded-md p-3">
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
                      <Label>Roll Number</Label>
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
                  <div className="space-y-4 border rounded-md p-3">
                    {formData.role === "admin" && (
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
          <Card>
            <CardHeader>
              <CardTitle>Existing Users</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                      Total: {total} • Page {page} of {pages}
                    </div>
                    <div>
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
                        className="ml-2"
                        disabled={page >= pages}
                        onClick={() => loadUsers(page + 1)}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
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
                          <TableHead className="text-right w-[100px]">
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
                            {user.name}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
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
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditData({
                                      ...user,
                                      class: user.class || "",
                                      academicSection: user.academicSection || "",
                                      classIds: user.classIds || [],
                                      academicSectionIds: user.academicSectionIds || [],
                                      subjectIds: user.subjectIds || [],
                                      hasAllClasses: user.hasAllClasses || false,
                                      hasAllSections:
                                        typeof user.hasAllSections === "boolean"
                                          ? user.hasAllSections
                                          : user.role === "student"
                                            ? false
                                            : true,
                                      hasAllSubjects: user.hasAllSubjects || false,
                                      rollNumber: user.rollNumber || "",
                                      enrolledAt: user.enrolledAt || "",
                                    });
                                    setIsEditDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4 text-muted-foreground" />
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
                                            value === "admin" ? d.hasAllClasses || false : false,
                                          hasAllSections:
                                            value === "student"
                                              ? false
                                              : value === "admin"
                                                ? d.hasAllSections ?? true
                                                : true,
                                          hasAllSubjects:
                                            value === "admin" ? d.hasAllSubjects || false : false,
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
                                    <div className="space-y-4 border rounded-md p-3">
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
                                        <Label>Roll Number</Label>
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
                                    <div className="space-y-4 border rounded-md p-3">
                                      {editData.role === "admin" && (
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
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
