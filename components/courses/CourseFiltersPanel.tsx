import CourseFiltersClient from "@/components/courses/CourseFiltersClient";
import type { CourseFiltersProps } from "@/components/courses/course-filters.types";

export default function CourseFiltersPanel(props: CourseFiltersProps) {
  return <CourseFiltersClient {...props} />;
}
