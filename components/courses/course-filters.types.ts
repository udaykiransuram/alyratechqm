import type { SearchableCommandOption } from "@/components/ui/searchable-command-select";

export type CourseFiltersProps = {
  classId?: string;
  classOptions?: SearchableCommandOption[];
  sectionId?: string;
  sectionOptions?: SearchableCommandOption[];
  subjectId?: string;
  subjectOptions?: SearchableCommandOption[];
  query?: string;
  showClassFilter?: boolean;
  showSectionFilter?: boolean;
  showSubjectFilter?: boolean;
  variant?: "embedded" | "panel";
};
