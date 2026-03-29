"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_GENDER_OPTIONS } from "@/lib/user-gender";

type ClassItem = {
  _id: string;
  name: string;
};

type AcademicSectionItem = {
  _id: string;
  name: string;
  class?: { _id: string; name: string } | string;
};

type StudentEditDraft = {
  _id: string;
  name: string;
  gender: string;
  fatherName: string;
  mobileNumber: string;
  classId: string;
  academicSectionId: string;
  rollNumber: string;
  enrolledAt: string;
};

type StudentEditDialogProps = {
  open: boolean;
  student: StudentEditDraft | null;
  classes: ClassItem[];
  sections: AcademicSectionItem[];
  onClose: () => void;
  onSaved: () => void;
};

function getSectionClassId(section: AcademicSectionItem) {
  const rawClass = section.class as any;
  return typeof section.class === "string"
    ? section.class
    : String(rawClass?._id || rawClass || "");
}

export default function StudentEditDialog({
  open,
  student,
  classes,
  sections,
  onClose,
  onSaved,
}: StudentEditDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [academicSectionId, setAcademicSectionId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [enrolledAt, setEnrolledAt] = useState("");

  useEffect(() => {
    if (!open || !student) return;
    setName(student.name);
    setGender(student.gender);
    setFatherName(student.fatherName);
    setMobileNumber(student.mobileNumber);
    setClassId(student.classId);
    setAcademicSectionId(student.academicSectionId);
    setRollNumber(student.rollNumber);
    setEnrolledAt(student.enrolledAt);
  }, [open, student]);

  const editSections = useMemo(
    () => sections.filter((section) => getSectionClassId(section) === classId),
    [classId, sections],
  );

  const saveEdit = async () => {
    if (!student) return;
    try {
      setSaving(true);
      const body: any = {
        name,
        gender: gender || undefined,
        fatherName,
        mobileNumber,
        role: "student",
        class: classId,
        academicSection: academicSectionId,
        rollNumber,
      };
      if (enrolledAt) {
        body.enrolledAt = new Date(enrolledAt);
      }

      const response = await fetch(`/api/users/${student._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to update");
      }

      onClose();
      onSaved();
    } catch (error: any) {
      alert(error.message || "Failed to update student");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              className="col-span-3"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="father-name" className="text-right">
              Father
            </Label>
            <Input
              id="father-name"
              className="col-span-3"
              value={fatherName}
              onChange={(event) => setFatherName(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Gender</Label>
            <div className="col-span-3">
              <Select
                value={gender || "unspecified"}
                onValueChange={(value) =>
                  setGender(value === "unspecified" ? "" : value)
                }
              >
                <SelectTrigger className="app-control-compact">
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="mobile-number" className="text-right">
              Mobile
            </Label>
            <Input
              id="mobile-number"
              className="col-span-3"
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Class</Label>
            <div className="col-span-3">
              <Select
                value={classId}
                onValueChange={(value) => {
                  setClassId(value);
                  setAcademicSectionId("");
                }}
              >
                <SelectTrigger className="app-control-compact">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((classItem) => (
                    <SelectItem key={classItem._id} value={classItem._id}>
                      {classItem.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Section</Label>
            <div className="col-span-3">
              <Select value={academicSectionId} onValueChange={setAcademicSectionId}>
                <SelectTrigger className="app-control-compact">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {editSections.map((section) => (
                    <SelectItem key={section._id} value={section._id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="roll" className="text-right">
              Roll No.
            </Label>
            <Input
              id="roll"
              className="col-span-3"
              value={rollNumber}
              onChange={(event) => setRollNumber(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="enrolled" className="text-right">
              Enrolled At
            </Label>
            <Input
              id="enrolled"
              className="col-span-3"
              type="date"
              value={enrolledAt}
              onChange={(event) => setEnrolledAt(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void saveEdit()} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
