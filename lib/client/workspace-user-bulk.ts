import {
  getUploadCell,
  parseUploadBoolean,
  parseUploadDate,
  splitUploadListCell,
  toUploadLookupKey,
  type ParsedUploadRow,
} from "@/lib/client/bulk-upload";
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
        "aarav@example.com",
        "9876543210",
        "Grade 10",
        "A",
        "10A-001",
        "2026-04-01",
      ],
    ],
    tips: [
      "Use class and section names exactly as they appear in the workspace.",
      "Students sign in with the roll number. If no password is supplied, the roll number becomes the default password.",
    ],
  },
  teacher: {
    filename: "teachers-bulk-template.csv",
    headers: [
      "name",
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
      "Separate multiple classes, sections, and subjects with the `|` character.",
      "For sections, use `Class Name:Section Name` when section names repeat across classes.",
    ],
  },
  admin: {
    filename: "admins-bulk-template.csv",
    headers: [
      "name",
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
      "Leave the class, section, or subject columns empty when the corresponding `hasAll...` flag is `true`.",
      "Use `true` or `false` in the scope columns to control whether the admin has full access.",
    ],
  },
};

function getSectionClassId(section: WorkspaceAcademicSectionItem) {
  return typeof section.class === "string" ? section.class : section.class?._id || "";
}

function buildClassLookup(classes: WorkspaceClassItem[]) {
  const lookup = new Map<string, WorkspaceClassItem>();
  classes.forEach((classItem) => {
    lookup.set(classItem._id, classItem);
    lookup.set(toUploadLookupKey(classItem.name), classItem);
  });
  return lookup;
}

function buildSubjectLookup(subjects: WorkspaceSubjectItem[]) {
  const lookup = new Map<string, WorkspaceSubjectItem>();
  subjects.forEach((subject) => {
    lookup.set(subject._id, subject);
    lookup.set(toUploadLookupKey(subject.name), subject);
    if (subject.code) {
      lookup.set(toUploadLookupKey(subject.code), subject);
    }
  });
  return lookup;
}

function resolveClassIds(
  value: unknown,
  classes: WorkspaceClassItem[],
) {
  const classLookup = buildClassLookup(classes);
  const tokens = splitUploadListCell(value);
  const ids = new Set<string>();
  const unresolved: string[] = [];

  tokens.forEach((token) => {
    const match = classLookup.get(token) || classLookup.get(toUploadLookupKey(token));
    if (match?._id) {
      ids.add(match._id);
      return;
    }
    unresolved.push(token);
  });

  return {
    ids: Array.from(ids),
    unresolved,
  };
}

function resolveSubjectIds(
  value: unknown,
  subjects: WorkspaceSubjectItem[],
) {
  const subjectLookup = buildSubjectLookup(subjects);
  const tokens = splitUploadListCell(value);
  const ids = new Set<string>();
  const unresolved: string[] = [];

  tokens.forEach((token) => {
    const lookupToken = toUploadLookupKey(token);
    const match = subjectLookup.get(token) || subjectLookup.get(lookupToken);
    if (match?._id) {
      ids.add(match._id);
      return;
    }
    unresolved.push(token);
  });

  return {
    ids: Array.from(ids),
    unresolved,
  };
}

function resolveSectionIds(
  value: unknown,
  sections: WorkspaceAcademicSectionItem[],
  classes: WorkspaceClassItem[],
  classScopeIds: string[] = [],
) {
  const tokens = splitUploadListCell(value);
  const ids = new Set<string>();
  const unresolved: string[] = [];
  const scopedClassIds = new Set(classScopeIds);
  const classLookup = buildClassLookup(classes);

  tokens.forEach((token) => {
    const directMatch = sections.find((section) => section._id === token);
    if (directMatch?._id) {
      ids.add(directMatch._id);
      return;
    }

    const classSectionMatch = token.match(/^(.+?)(?::|>|\/)(.+)$/);
    if (classSectionMatch) {
      const classToken = classSectionMatch[1]?.trim();
      const sectionToken = classSectionMatch[2]?.trim();
      const classMatch =
        classLookup.get(classToken) || classLookup.get(toUploadLookupKey(classToken));

      if (classMatch?._id) {
        const sectionMatch = sections.find(
          (section) =>
            getSectionClassId(section) === classMatch._id &&
            toUploadLookupKey(section.name) === toUploadLookupKey(sectionToken),
        );

        if (sectionMatch?._id) {
          ids.add(sectionMatch._id);
          return;
        }
      }
    }

    const candidateSections = sections.filter((section) => {
      if (toUploadLookupKey(section.name) !== toUploadLookupKey(token)) {
        return false;
      }

      if (scopedClassIds.size === 0) {
        return true;
      }

      return scopedClassIds.has(getSectionClassId(section));
    });

    if (candidateSections.length === 1) {
      ids.add(candidateSections[0]._id);
      return;
    }

    unresolved.push(token);
  });

  return {
    ids: Array.from(ids),
    unresolved,
  };
}

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
  const users: Array<Record<string, unknown>> = [];
  const skippedRows: string[] = [];

  rows.forEach((row, index) => {
    const rowLabel = buildRowLabel(row, index);
    const name = String(getUploadCell(row, "name") || "").trim();
    const email = String(getUploadCell(row, "email") || "").trim();
    const mobileNumber = String(
      getUploadCell(row, "mobilenumber", "mobile", "phone"),
    ).trim();
    const password = String(getUploadCell(row, "password") || "").trim();

    if (!name || !mobileNumber) {
      skippedRows.push(`${rowLabel}: name and mobile number are required.`);
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
      const classResolution = resolveClassIds(classToken, classes);

      if (!rollNumber || classResolution.ids.length !== 1) {
        skippedRows.push(
          `${rowLabel}: students need one valid class and a roll number.`,
        );
        return;
      }

      const classId = classResolution.ids[0];
      const sectionResolution = String(sectionToken).trim()
        ? resolveSectionIds(sectionToken, sections, classes, [classId])
        : { ids: [], unresolved: [] as string[] };

      if (sectionResolution.unresolved.length > 0) {
        skippedRows.push(
          `${rowLabel}: couldn't resolve sections ${sectionResolution.unresolved.join(", ")}.`,
        );
        return;
      }

      users.push({
        name,
        email,
        mobileNumber,
        role,
        class: classId,
        academicSection: sectionResolution.ids[0] || undefined,
        rollNumber,
        enrolledAt: parseUploadDate(getUploadCell(row, "enrolledat", "admissiondate")),
      });
      return;
    }

    if (role === "teacher") {
      const classResolution = resolveClassIds(
        getUploadCell(row, "classids", "classes", "classid", "class"),
        classes,
      );
      const subjectResolution = resolveSubjectIds(
        getUploadCell(row, "subjectids", "subjects", "subjectid", "subject"),
        subjects,
      );
      const hasAllSections = parseUploadBoolean(
        getUploadCell(row, "hasallsections"),
        true,
      );
      const sectionResolution = hasAllSections
        ? { ids: [], unresolved: [] as string[] }
        : resolveSectionIds(
            getUploadCell(
              row,
              "academicsectionids",
              "sectionids",
              "academicsections",
              "sections",
            ),
            sections,
            classes,
            classResolution.ids,
          );

      if (classResolution.unresolved.length > 0) {
        skippedRows.push(
          `${rowLabel}: couldn't resolve classes ${classResolution.unresolved.join(", ")}.`,
        );
        return;
      }

      if (subjectResolution.unresolved.length > 0) {
        skippedRows.push(
          `${rowLabel}: couldn't resolve subjects ${subjectResolution.unresolved.join(", ")}.`,
        );
        return;
      }

      if (sectionResolution.unresolved.length > 0) {
        skippedRows.push(
          `${rowLabel}: couldn't resolve sections ${sectionResolution.unresolved.join(", ")}.`,
        );
        return;
      }

      if (classResolution.ids.length === 0 || subjectResolution.ids.length === 0) {
        skippedRows.push(
          `${rowLabel}: teachers need at least one class and one subject.`,
        );
        return;
      }

      users.push({
        name,
        email,
        mobileNumber,
        password: password || undefined,
        role,
        classIds: classResolution.ids,
        academicSectionIds: hasAllSections ? [] : sectionResolution.ids,
        hasAllSections,
        subjectIds: subjectResolution.ids,
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
    const classResolution = hasAllClasses
      ? { ids: [], unresolved: [] as string[] }
      : resolveClassIds(
          getUploadCell(row, "classids", "classes", "classid", "class"),
          classes,
        );
    const subjectResolution = hasAllSubjects
      ? { ids: [], unresolved: [] as string[] }
      : resolveSubjectIds(
          getUploadCell(row, "subjectids", "subjects", "subjectid", "subject"),
          subjects,
        );
    const sectionResolution = hasAllSections
      ? { ids: [], unresolved: [] as string[] }
      : resolveSectionIds(
          getUploadCell(
            row,
            "academicsectionids",
            "sectionids",
            "academicsections",
            "sections",
          ),
          sections,
          classes,
          classResolution.ids,
        );

    if (classResolution.unresolved.length > 0) {
      skippedRows.push(
        `${rowLabel}: couldn't resolve classes ${classResolution.unresolved.join(", ")}.`,
      );
      return;
    }

    if (subjectResolution.unresolved.length > 0) {
      skippedRows.push(
        `${rowLabel}: couldn't resolve subjects ${subjectResolution.unresolved.join(", ")}.`,
      );
      return;
    }

    if (sectionResolution.unresolved.length > 0) {
      skippedRows.push(
        `${rowLabel}: couldn't resolve sections ${sectionResolution.unresolved.join(", ")}.`,
      );
      return;
    }

    users.push({
      name,
      email,
      mobileNumber,
      password: password || undefined,
      role,
      hasAllClasses,
      hasAllSections,
      hasAllSubjects,
      classIds: hasAllClasses ? [] : classResolution.ids,
      academicSectionIds: hasAllSections ? [] : sectionResolution.ids,
      subjectIds: hasAllSubjects ? [] : subjectResolution.ids,
    });
  });

  return {
    users,
    skippedRows,
  };
}
