import type {
  CourseImageFit,
  CourseImageHeight,
  CourseImageWidth,
} from "@/lib/courses/types";

export const COURSE_IMAGE_FIT_OPTIONS = [
  { value: "contain" as const, label: "Show full image" },
  { value: "cover" as const, label: "Fill frame" },
];

export const COURSE_IMAGE_WIDTH_OPTIONS = [
  { value: "compact" as const, label: "Compact" },
  { value: "standard" as const, label: "Standard" },
  { value: "full" as const, label: "Full width" },
];

export const COURSE_IMAGE_HEIGHT_OPTIONS = [
  { value: "small" as const, label: "Small" },
  { value: "medium" as const, label: "Medium" },
  { value: "large" as const, label: "Large" },
  { value: "xlarge" as const, label: "Extra large" },
];

export function resolveCourseImageFit(value: unknown): CourseImageFit {
  return value === "cover" ? "cover" : "contain";
}

export function resolveCourseImageWidth(value: unknown): CourseImageWidth {
  switch (value) {
    case "compact":
    case "full":
      return value;
    default:
      return "standard";
  }
}

export function resolveCourseImageHeight(value: unknown): CourseImageHeight {
  switch (value) {
    case "small":
    case "medium":
    case "xlarge":
      return value;
    default:
      return "large";
  }
}

export function getCourseImageDisplayClasses(params?: {
  imageFit?: CourseImageFit;
  imageWidth?: CourseImageWidth;
  imageHeight?: CourseImageHeight;
}) {
  const imageFit = resolveCourseImageFit(params?.imageFit);
  const imageWidth = resolveCourseImageWidth(params?.imageWidth);
  const imageHeight = resolveCourseImageHeight(params?.imageHeight);

  const widthClassName =
    imageWidth === "compact"
      ? "max-w-2xl"
      : imageWidth === "full"
        ? "max-w-full"
        : "max-w-4xl";

  const containHeightClassName =
    imageHeight === "small"
      ? "max-h-[280px]"
      : imageHeight === "medium"
        ? "max-h-[420px]"
        : imageHeight === "xlarge"
          ? "max-h-[720px]"
          : "max-h-[560px]";

  const coverHeightClassName =
    imageHeight === "small"
      ? "h-[280px]"
      : imageHeight === "medium"
        ? "h-[420px]"
        : imageHeight === "xlarge"
          ? "h-[720px]"
          : "h-[560px]";

  return {
    imageFit,
    imageWidth,
    imageHeight,
    wrapperClassName: `mx-auto w-full ${widthClassName}`,
    frameClassName:
      imageFit === "cover"
        ? `overflow-hidden rounded-[1.25rem] border border-border/60 bg-muted/10 ${coverHeightClassName}`
        : "flex items-center justify-center overflow-hidden rounded-[1.25rem] border border-border/60 bg-muted/10 p-3",
    imageClassName:
      imageFit === "cover"
        ? "h-full w-full object-cover"
        : `mx-auto h-auto w-auto max-w-full object-contain ${containHeightClassName}`,
  };
}
