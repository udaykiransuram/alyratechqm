import {
  getUploadCell,
  parseUploadBoolean,
  parseUploadDate,
  splitUploadListCell,
  type ParsedUploadRow,
} from "@/lib/client/bulk-upload";
import { normalizeUserGender } from "@/lib/user-gender";
import type {
  WorkspaceAcademicSectionItem,
  WorkspaceClassItem,
  WorkspaceSubjectItem,
} from "@/lib/workspace/support-types";

export type WorkspaceBulkUserRole = "student" | "teacher" | "admin";

type BuildWorkspaceUserBulkRowsArgs = {
  role: WorkspaceBulkUserRole;
  rows: ParsedUploadRow[];
  classes: WorkspaceClassItem[];
  sections: WorkspaceAcademicSectionItem[];
  subjects: WorkspaceSubjectItem[];
};

type BuildWorkspaceUserBulkRowsResult = {
  users: Array<Record<string, unknown>>;
  skippedRows: string[];
};

export type WorkspaceBulkStructureChangeItem = {
  _id?: string;
  name?: string;
  classId?: string;
  className?: string;
};

type BulkUploadTemplate = {
  filename: string;
  headers: string[];
  sampleRows: string[][];
  tips: string[];
};

export const WORKSPACE_USER_BULK_TEMPLATES: Record<
  WorkspaceBulkUserRole,
  BulkUploadTemplate
> = {
  student: {
    filename: "students-bulk-template.csv",
    headers: [
      "name",
      "fatherName",
      "gender",
      "email",
      "mobileNumber",
      "class",
      "section",
      "rollNumber",
      "enrolledAt",
    ],
    sampleRows: [
      [
        "Aarav Sharma",
        "Rakesh Sharma",
        "male",
        "aarav@example.com",
        "9876543210",
        "Grade 10",
        "A",
        "10A-001",
        "2026-04-01",
      ],
    ],
    tips: [
      "Use the class and section names you want in the workspace. Missing class and section names are created during bulk upload.",
      "The fatherName column is optional, but it helps when schools verify students through family records.",
      "Use `male`, `female`, or `other` in the gender column when you want to save it.",
      "Students sign in with the roll number. If no password is supplied, saved phone-number digits become the default password exactly as stored (including country code digits, if present).",
    ],
  },
  teacher: {
    filename: "teachers-bulk-template.csv",
    headers: [
      "name",
      "gender",
      "email",
      "mobileNumber",
      "password",
      "classes",
      "sections",
      "subjects",
      "hasAllSections",
    ],
    sampleRows: [
      [
        "Meera Nair",
        "female",
        "meera@example.com",
        "9876500000",
        "teacher@123",
        "Grade 10|Grade 11",
        "Grade 10:A|Grade 11:B",
        "Mathematics|Science",
        "false",
      ],
    ],
    tips: [
      "Use `male`, `female`, or `other` in the gender column when you want to save it.",
      "Separate multiple classes, sections, and subjects with the `|` character.",
      "Missing classes and subjects are created during bulk upload, and sections are always created inside a class.",
      "If the same section names repeat across the selected classes, entering `A|B` applies those section names to each selected class.",
      "Use `Class Name:Section Name` when a section should be limited to one class or when the row does not list classes.",
    ],
  },
  admin: {
    filename: "admins-bulk-template.csv",
    headers: [
      "name",
      "gender",
      "email",
      "mobileNumber",
      "password",
      "hasAllClasses",
      "hasAllSections",
      "hasAllSubjects",
      "classes",
      "sections",
      "subjects",
    ],
    sampleRows: [
      [
        "Ritu Verma",
        "female",
        "ritu@example.com",
        "9876511111",
        "admin@123",
        "false",
        "false",
        "false",
        "Grade 9|Grade 10",
        "Grade 9:A|Grade 10:B",
        "Mathematics|Science",
      ],
    ],
    tips: [
      "Use `male`, `female`, or `other` in the gender column when you want to save it.",
      "Leave the class, section, or subject columns empty when the corresponding `hasAll...` flag is `true`.",
      "Missing classes and subjects are created during bulk upload, and sections are always created inside a class.",
      "When the same section names repeat across the selected classes, entering `A|B` applies those section names to each selected class.",
      "Use `Class Name:Section Name` when a section should be tied to one specific class or when class scope is not listed in the row.",
      "Use `true` or `false` in the scope columns to control whether the admin has full access.",
    ],
  },
};

function buildRowLabel(row: ParsedUploadRow, index: number) {
  const name = String(getUploadCell(row, "name") || "").trim();
  return name ? `Row ${index + 2} (${name})` : `Row ${index + 2}`;
}

export function buildWorkspaceUserBulkRows({
  role,
  rows,
  classes,
  sections,
  subjects,
}: BuildWorkspaceUserBulkRowsArgs): BuildWorkspaceUserBulkRowsResult {
  void classes;
  void sections;
  void subjects;
  const users: Array<Record<string, unknown>> = [];
  const skippedRows: string[] = [];

  rows.forEach((row, index) => {
    const rowLabel = buildRowLabel(row, index);
    const name = String(getUploadCell(row, "name") || "").trim();
    const fatherName = String(
      getUploadCell(row, "fathername", "father", "father_name"),
    ).trim();
    const email = String(getUploadCell(row, "email") || "").trim();
    const mobileNumber = String(
      getUploadCell(row, "mobilenumber", "mobile", "phone"),
    ).trim();
    const password = String(getUploadCell(row, "password") || "").trim();
    const rawGender = String(getUploadCell(row, "gender") || "").trim();
    const gender = normalizeUserGender(rawGender);

    if (!name || !mobileNumber) {
      skippedRows.push(`${rowLabel}: name and mobile number are required.`);
      return;
    }

    if (rawGender && !gender) {
      skippedRows.push(
        `${rowLabel}: gender must be male, female, or other.`,
      );
      return;
    }

    if (role === "student") {
      const classToken = getUploadCell(row, "classid", "class", "classname");
      const sectionToken = getUploadCell(
        row,
        "academicsectionid",
        "sectionid",
        "academicsection",
        "section",
        "sectionname",
      );
      const rollNumber = String(
        getUploadCell(row, "rollnumber", "username"),
      ).trim();
      const normalizedClass = String(classToken || "").trim();
      const normalizedSection = String(sectionToken || "").trim();

      if (!rollNumber || !normalizedClass) {
        skippedRows.push(
          `${rowLabel}: students need a class and a roll number.`,
        );
        return;
      }

      users.push({
        name,
        fatherName: fatherName || undefined,
        gender,
        email,
        mobileNumber,
        role,
        class: normalizedClass,
        academicSection: normalizedSection || undefined,
        rollNumber,
        enrolledAt: parseUploadDate(getUploadCell(row, "enrolledat", "admissiondate")),
      });
      return;
    }

    if (role === "teacher") {
      const classTokens = splitUploadListCell(
        getUploadCell(row, "classids", "classes", "classid", "class"),
      );
      const subjectTokens = splitUploadListCell(
        getUploadCell(row, "subjectids", "subjects", "subjectid", "subject"),
      );
      const hasAllSections = parseUploadBoolean(
        getUploadCell(row, "hasallsections"),
        true,
      );
      const sectionTokens = hasAllSections
        ? []
        : splitUploadListCell(
            getUploadCell(
              row,
              "academicsectionids",
              "sectionids",
              "academicsections",
              "sections",
            ),
          );

      if (classTokens.length === 0 || subjectTokens.length === 0) {
        skippedRows.push(
          `${rowLabel}: teachers need at least one class and one subject.`,
        );
        return;
      }

      users.push({
        name,
        gender,
        email,
        mobileNumber,
        password: password || undefined,
        role,
        classIds: classTokens,
        academicSectionIds: hasAllSections ? [] : sectionTokens,
        hasAllSections,
        subjectIds: subjectTokens,
      });
      return;
    }

    const hasAllClasses = parseUploadBoolean(
      getUploadCell(row, "hasallclasses"),
      true,
    );
    const hasAllSections = parseUploadBoolean(
      getUploadCell(row, "hasallsections"),
      true,
    );
    const hasAllSubjects = parseUploadBoolean(
      getUploadCell(row, "hasallsubjects"),
      true,
    );
    const classTokens = hasAllClasses
      ? []
      : splitUploadListCell(
          getUploadCell(row, "classids", "classes", "classid", "class"),
        );
    const subjectTokens = hasAllSubjects
      ? []
      : splitUploadListCell(
          getUploadCell(row, "subjectids", "subjects", "subjectid", "subject"),
        );
    const sectionTokens = hasAllSections
      ? []
      : splitUploadListCell(
          getUploadCell(
            row,
            "academicsectionids",
            "sectionids",
            "academicsections",
            "sections",
          ),
        );

    users.push({
      name,
      gender,
      email,
      mobileNumber,
      password: password || undefined,
      role,
      hasAllClasses,
      hasAllSections,
      hasAllSubjects,
      classIds: hasAllClasses ? [] : classTokens,
      academicSectionIds: hasAllSections ? [] : sectionTokens,
      subjectIds: hasAllSubjects ? [] : subjectTokens,
    });
  });

  return {
    users,
    skippedRows,
  };
}

function formatStructureChangeList(
  items: WorkspaceBulkStructureChangeItem[],
  getLabel: (item: WorkspaceBulkStructureChangeItem) => string,
) {
  const labels = items
    .map(getLabel)
    .map((value) => value.trim())
    .filter(Boolean);

  if (labels.length === 0) {
    return "";
  }

  const preview = labels.slice(0, 3);
  const remaining = labels.length - preview.length;
  return remaining > 0
    ? `${preview.join(", ")} +${remaining} more`
    : preview.join(", ");
}

export function buildWorkspaceBulkStructureSummary(data: {
  createdClasses?: WorkspaceBulkStructureChangeItem[];
  restoredClasses?: WorkspaceBulkStructureChangeItem[];
  createdSections?: WorkspaceBulkStructureChangeItem[];
  restoredSections?: WorkspaceBulkStructureChangeItem[];
  createdSubjects?: WorkspaceBulkStructureChangeItem[];
  restoredSubjects?: WorkspaceBulkStructureChangeItem[];
}) {
  const createdClasses = Array.isArray(data?.createdClasses)
    ? data.createdClasses
    : [];
  const restoredClasses = Array.isArray(data?.restoredClasses)
    ? data.restoredClasses
    : [];
  const createdSections = Array.isArray(data?.createdSections)
    ? data.createdSections
    : [];
  const restoredSections = Array.isArray(data?.restoredSections)
    ? data.restoredSections
    : [];
  const createdSubjects = Array.isArray(data?.createdSubjects)
    ? data.createdSubjects
    : [];
  const restoredSubjects = Array.isArray(data?.restoredSubjects)
    ? data.restoredSubjects
    : [];

  return [
    createdClasses.length
      ? `Classes created: ${createdClasses.length} (${formatStructureChangeList(
          createdClasses,
          (item) => item.name || "",
        )}).`
      : null,
    restoredClasses.length
      ? `Classes restored: ${restoredClasses.length} (${formatStructureChangeList(
          restoredClasses,
          (item) => item.name || "",
        )}).`
      : null,
    createdSections.length
      ? `Sections created: ${createdSections.length} (${formatStructureChangeList(
          createdSections,
          (item) =>
            item.className ? `${item.className}:${item.name || ""}` : item.name || "",
        )}).`
      : null,
    restoredSections.length
      ? `Sections restored: ${restoredSections.length} (${formatStructureChangeList(
          restoredSections,
          (item) =>
            item.className ? `${item.className}:${item.name || ""}` : item.name || "",
        )}).`
      : null,
    createdSubjects.length
      ? `Subjects created: ${createdSubjects.length} (${formatStructureChangeList(
          createdSubjects,
          (item) => item.name || "",
        )}).`
      : null,
    restoredSubjects.length
      ? `Subjects restored: ${restoredSubjects.length} (${formatStructureChangeList(
          restoredSubjects,
          (item) => item.name || "",
        )}).`
      : null,
  ].filter(Boolean);
}
