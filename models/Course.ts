import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { applyArchiveFields, hasArchiveFields } from "@/lib/archive";
import { getModelRegistry } from "@/lib/mongoose-models";

import "./AcademicSection.ts";
import "./Class.ts";
import "./QuestionPaper.ts";
import "./Subject.ts";
import "./User.ts";

export interface ICourseBlock {
  id: string;
  type:
    | "module"
    | "lesson"
    | "text"
    | "image"
    | "youtube"
    | "resource"
    | "announcement"
    | "assessment";
  title?: string;
  summary?: string;
  estimatedMinutes?: number | null;
  items?: Array<{
    type: "text" | "image" | "youtube" | "resource";
    contentHtml?: string;
    imageUrl?: string;
    altText?: string;
    caption?: string;
    imageFit?: "contain" | "cover";
    imageWidth?: "compact" | "standard" | "full";
    imageHeight?: "small" | "medium" | "large" | "xlarge";
    videoId?: string;
    title?: string;
    fileUrl?: string;
    fileName?: string;
  }>;
  contentHtml?: string;
  imageUrl?: string;
  altText?: string;
  caption?: string;
  imageFit?: "contain" | "cover";
  imageWidth?: "compact" | "standard" | "full";
  imageHeight?: "small" | "medium" | "large" | "xlarge";
  videoId?: string;
  fileUrl?: string;
  fileName?: string;
  tone?: "info" | "success" | "warning";
  questionPaper?: Types.ObjectId;
  titleOverride?: string;
  required?: boolean;
  minimumScorePct?: number | null;
}

export interface ICourse extends Document {
  title: string;
  summary?: string;
  coverImageUrl?: string;
  coverImageAltText?: string;
  startsAt?: Date | null;
  dueAt?: Date | null;
  completionBadgeLabel?: string;
  enforceSequentialProgress: boolean;
  allowNotes: boolean;
  allowBookmarks: boolean;
  isTemplate: boolean;
  class: Types.ObjectId;
  subjectIds?: Types.ObjectId[];
  assignedAcademicSections?: Types.ObjectId[];
  status: "draft" | "published" | "archived";
  blocks: ICourseBlock[];
  createdBy: Types.ObjectId;
  publishedAt?: Date | null;
}

const CourseBlockSchema = new Schema<ICourseBlock>(
  {
    id: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: [
        "module",
        "lesson",
        "text",
        "image",
        "youtube",
        "resource",
        "announcement",
        "assessment",
      ],
    },
    title: {
      type: String,
      default: undefined,
    },
    summary: {
      type: String,
      default: undefined,
    },
    estimatedMinutes: {
      type: Number,
      min: 0,
      max: 600,
      default: undefined,
    },
    items: {
      type: [
        {
          type: {
            type: String,
            enum: ["text", "image", "youtube", "resource"],
            required: true,
          },
          contentHtml: {
            type: String,
            default: undefined,
          },
          imageUrl: {
            type: String,
            default: undefined,
          },
          altText: {
            type: String,
            default: undefined,
          },
          caption: {
            type: String,
            default: undefined,
          },
          imageFit: {
            type: String,
            enum: ["contain", "cover"],
            default: undefined,
          },
          imageWidth: {
            type: String,
            enum: ["compact", "standard", "full"],
            default: undefined,
          },
          imageHeight: {
            type: String,
            enum: ["small", "medium", "large", "xlarge"],
            default: undefined,
          },
          videoId: {
            type: String,
            default: undefined,
          },
          title: {
            type: String,
            default: undefined,
          },
          fileUrl: {
            type: String,
            default: undefined,
          },
          fileName: {
            type: String,
            default: undefined,
          },
        },
      ],
      default: undefined,
    },
    contentHtml: {
      type: String,
      default: undefined,
    },
    imageUrl: {
      type: String,
      default: undefined,
    },
    altText: {
      type: String,
      default: undefined,
    },
    caption: {
      type: String,
      default: undefined,
    },
    imageFit: {
      type: String,
      enum: ["contain", "cover"],
      default: undefined,
    },
    imageWidth: {
      type: String,
      enum: ["compact", "standard", "full"],
      default: undefined,
    },
    imageHeight: {
      type: String,
      enum: ["small", "medium", "large", "xlarge"],
      default: undefined,
    },
    videoId: {
      type: String,
      default: undefined,
    },
    fileUrl: {
      type: String,
      default: undefined,
    },
    fileName: {
      type: String,
      default: undefined,
    },
    tone: {
      type: String,
      enum: ["info", "success", "warning"],
      default: undefined,
    },
    questionPaper: {
      type: Schema.Types.ObjectId,
      ref: "QuestionPaper",
      default: undefined,
    },
    titleOverride: {
      type: String,
      default: undefined,
    },
    required: {
      type: Boolean,
      default: undefined,
    },
    minimumScorePct: {
      type: Number,
      min: 0,
      max: 100,
      default: undefined,
    },
  },
  {
    _id: false,
  },
);

CourseBlockSchema.pre("validate", function (next) {
  const block = this as ICourseBlock & {
    invalidate: (path: string, message: string) => void;
    ownerDocument?: () => ICourse | null;
  };

  const type = String(block.type || "").trim();
  const parentCourse = typeof block.ownerDocument === "function" ? block.ownerDocument() : null;
  const enforcePublishedValidation = parentCourse?.status === "published";

  if (!block.id) {
    block.invalidate("id", "Block id is required.");
  }

  if (
    type === "assessment" &&
    block.minimumScorePct !== undefined &&
    block.minimumScorePct !== null &&
    (block.minimumScorePct < 0 || block.minimumScorePct > 100)
  ) {
    block.invalidate(
      "minimumScorePct",
      "Minimum score must be between 0 and 100.",
    );
  }

  if (!enforcePublishedValidation) {
    next();
    return;
  }

  if (type === "text") {
    if (!String(block.contentHtml || "").trim()) {
      block.invalidate("contentHtml", "Text blocks require content.");
    }
  }

  if (type === "lesson") {
    if (!String(block.title || "").trim()) {
      block.invalidate("title", "Lesson blocks require a title.");
    }

    const items = Array.isArray(block.items) ? block.items : [];
    if (items.length === 0) {
      block.invalidate("items", "Lesson blocks require at least one content item.");
    } else {
      items.forEach((item, index) => {
        const itemType = String(item?.type || "").trim();
        if (itemType === "text" && !String(item?.contentHtml || "").trim()) {
          block.invalidate(
            `items.${index}.contentHtml`,
            "Lesson text items require content.",
          );
        }
        if (itemType === "image" && !String(item?.imageUrl || "").trim()) {
          block.invalidate(
            `items.${index}.imageUrl`,
            "Lesson image items require an image URL.",
          );
        }
        if (itemType === "youtube" && !String(item?.videoId || "").trim()) {
          block.invalidate(
            `items.${index}.videoId`,
            "Lesson video items require a YouTube video id.",
          );
        }
        if (itemType === "resource") {
          if (!String(item?.title || "").trim()) {
            block.invalidate(
              `items.${index}.title`,
              "Lesson resource items require a title.",
            );
          }
          if (!String(item?.fileUrl || "").trim()) {
            block.invalidate(
              `items.${index}.fileUrl`,
              "Lesson resource items require a file URL.",
            );
          }
          if (!String(item?.fileName || "").trim()) {
            block.invalidate(
              `items.${index}.fileName`,
              "Lesson resource items require a file name.",
            );
          }
        }
      });
    }
  }

  if (type === "module") {
    if (!String(block.title || "").trim()) {
      block.invalidate("title", "Module blocks require a title.");
    }
  }

  if (type === "image") {
    if (!String(block.imageUrl || "").trim()) {
      block.invalidate("imageUrl", "Image blocks require an image URL.");
    }
  }

  if (type === "youtube") {
    if (!String(block.videoId || "").trim()) {
      block.invalidate("videoId", "YouTube blocks require a video id.");
    }
  }

  if (type === "resource") {
    if (!String(block.title || "").trim()) {
      block.invalidate("title", "Resource blocks require a title.");
    }
    if (!String(block.fileUrl || "").trim()) {
      block.invalidate("fileUrl", "Resource blocks require a file URL.");
    }
    if (!String(block.fileName || "").trim()) {
      block.invalidate("fileName", "Resource blocks require a file name.");
    }
  }

  if (type === "announcement") {
    if (!String(block.title || "").trim()) {
      block.invalidate("title", "Announcement blocks require a title.");
    }
    if (!String(block.contentHtml || "").trim()) {
      block.invalidate("contentHtml", "Announcement blocks require content.");
    }
  }

  if (type === "assessment") {
    if (!block.questionPaper) {
      block.invalidate(
        "questionPaper",
        "Assessment blocks require a linked question paper.",
      );
    }
  }

  next();
});

const CourseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: [true, "Course title is required."],
      trim: true,
    },
    summary: {
      type: String,
      default: "",
    },
    coverImageUrl: {
      type: String,
      default: "",
    },
    coverImageAltText: {
      type: String,
      default: "",
    },
    startsAt: {
      type: Date,
      default: null,
    },
    dueAt: {
      type: Date,
      default: null,
    },
    completionBadgeLabel: {
      type: String,
      default: "",
    },
    enforceSequentialProgress: {
      type: Boolean,
      default: false,
    },
    allowNotes: {
      type: Boolean,
      default: true,
    },
    allowBookmarks: {
      type: Boolean,
      default: true,
    },
    isTemplate: {
      type: Boolean,
      default: false,
      index: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    subjectIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Subject",
      },
    ],
    assignedAcademicSections: [
      {
        type: Schema.Types.ObjectId,
        ref: "AcademicSection",
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    blocks: {
      type: [CourseBlockSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

CourseSchema.index(
  { class: 1, status: 1, isArchived: 1 },
  { name: "course_class_status_archived_lookup" },
);
CourseSchema.index(
  { subjectIds: 1, isArchived: 1 },
  { name: "course_subjects_archived_lookup" },
);
CourseSchema.index(
  { assignedAcademicSections: 1, isArchived: 1 },
  { name: "course_sections_archived_lookup" },
);

applyArchiveFields(CourseSchema);

const modelRegistry = getModelRegistry();

const existingCourseModel = modelRegistry.Course as Model<ICourse> | undefined;

if (
  existingCourseModel &&
  (!existingCourseModel.schema.path("assignedAcademicSections") ||
    !existingCourseModel.schema.path("subjectIds") ||
    !existingCourseModel.schema.path("publishedAt") ||
    !existingCourseModel.schema.path("blocks.questionPaper") ||
    !existingCourseModel.schema.path("coverImageUrl") ||
    !existingCourseModel.schema.path("startsAt") ||
    !existingCourseModel.schema.path("dueAt") ||
    !existingCourseModel.schema.path("completionBadgeLabel") ||
    !existingCourseModel.schema.path("enforceSequentialProgress") ||
    !existingCourseModel.schema.path("allowNotes") ||
    !existingCourseModel.schema.path("allowBookmarks") ||
    !existingCourseModel.schema.path("isTemplate") ||
    !existingCourseModel.schema.path("blocks.title") ||
    !existingCourseModel.schema.path("blocks.fileUrl") ||
    !existingCourseModel.schema.path("blocks.fileName") ||
    !existingCourseModel.schema.path("blocks.tone") ||
    !existingCourseModel.schema.path("blocks.minimumScorePct") ||
    !existingCourseModel.schema.path("blocks.imageFit") ||
    !existingCourseModel.schema.path("blocks.imageWidth") ||
    !existingCourseModel.schema.path("blocks.imageHeight") ||
    !existingCourseModel.schema.path("blocks.items") ||
    !existingCourseModel.schema.path("blocks.estimatedMinutes") ||
    !hasArchiveFields(existingCourseModel))
) {
  delete modelRegistry.Course;
}

const Course: Model<ICourse> =
  (modelRegistry.Course as Model<ICourse>) ||
  mongoose.model<ICourse>("Course", CourseSchema);

export default Course;
