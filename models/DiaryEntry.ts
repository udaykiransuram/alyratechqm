import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { applyArchiveFields, hasArchiveFields } from "@/lib/archive";
import { hasDiaryHtmlContent } from "@/lib/diary/shared";
import { getModelRegistry } from "@/lib/mongoose-models";

import "./AcademicSection.ts";
import "./Class.ts";
import "./Subject.ts";
import "./User.ts";

export interface IDiaryResource {
  id: string;
  type: "image" | "youtube" | "file";
  url?: string;
  altText?: string;
  caption?: string;
  videoId?: string;
  fileName?: string;
}

export interface IDiaryEntry extends Document {
  title: string;
  entryDate: string;
  class: Types.ObjectId;
  assignedAcademicSections?: Types.ObjectId[];
  subject: Types.ObjectId;
  status: "draft" | "published" | "archived";
  scopeKey: string;
  lessonSummaryHtml?: string;
  homeworkHtml?: string;
  teacherNoteHtml?: string;
  resources: IDiaryResource[];
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  publishedAt?: Date | null;
  isArchived?: boolean;
  archivedAt?: Date | null;
  archivedBy?: Types.ObjectId | null;
}

const DiaryResourceSchema = new Schema<IDiaryResource>(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["image", "youtube", "file"],
    },
    url: {
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
    videoId: {
      type: String,
      default: undefined,
    },
    fileName: {
      type: String,
      default: undefined,
    },
  },
  {
    _id: false,
  },
);

DiaryResourceSchema.pre("validate", function (next) {
  const resource = this as IDiaryResource & {
    invalidate: (path: string, message: string) => void;
  };
  const type = String(resource.type || "").trim();

  if (!resource.id) {
    resource.invalidate("id", "Resource id is required.");
  }

  if (type === "image" && !String(resource.url || "").trim()) {
    resource.invalidate("url", "Diary image resources need an uploaded image.");
  }

  if (type === "youtube" && !String(resource.videoId || "").trim()) {
    resource.invalidate("videoId", "Diary video resources need a YouTube video.");
  }

  if (
    type === "file" &&
    (!String(resource.url || "").trim() ||
      !String(resource.fileName || "").trim())
  ) {
    resource.invalidate("url", "Diary file resources need an uploaded file.");
  }

  next();
});

const DiaryEntrySchema = new Schema<IDiaryEntry>(
  {
    title: {
      type: String,
      required: [true, "Diary title is required."],
      trim: true,
      maxlength: 180,
    },
    entryDate: {
      type: String,
      required: [true, "Diary date is required."],
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    assignedAcademicSections: [
      {
        type: Schema.Types.ObjectId,
        ref: "AcademicSection",
      },
    ],
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    scopeKey: {
      type: String,
      required: true,
      trim: true,
    },
    lessonSummaryHtml: {
      type: String,
      default: undefined,
    },
    homeworkHtml: {
      type: String,
      default: undefined,
    },
    teacherNoteHtml: {
      type: String,
      default: undefined,
    },
    resources: {
      type: [DiaryResourceSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
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

DiaryEntrySchema.pre("validate", function (next) {
  const entry = this as IDiaryEntry & {
    invalidate: (path: string, message: string) => void;
  };

  const hasContent =
    hasDiaryHtmlContent(entry.lessonSummaryHtml) ||
    hasDiaryHtmlContent(entry.homeworkHtml) ||
    hasDiaryHtmlContent(entry.teacherNoteHtml) ||
    (Array.isArray(entry.resources) && entry.resources.length > 0);

  if (entry.status === "published" && !hasContent) {
    entry.invalidate(
      "lessonSummaryHtml",
      "Published diary entries need content or at least one resource.",
    );
  }

  next();
});

DiaryEntrySchema.index(
  { scopeKey: 1 },
  {
    name: "diary_scope_key_unique_active_1",
    unique: true,
    partialFilterExpression: {
      isArchived: false,
    },
  },
);
DiaryEntrySchema.index(
  { entryDate: -1, class: 1, subject: 1, status: 1, updatedAt: -1 },
  { name: "diary_board_lookup_1" },
);
DiaryEntrySchema.index(
  { assignedAcademicSections: 1, entryDate: -1 },
  { name: "diary_sections_lookup_1" },
);
DiaryEntrySchema.index(
  { class: 1, subject: 1, status: 1, isArchived: 1, entryDate: -1, updatedAt: -1, title: 1 },
  { name: "diary_workspace_feed_lookup_1" },
);
DiaryEntrySchema.index(
  { class: 1, status: 1, isArchived: 1, entryDate: -1, updatedAt: -1, title: 1 },
  { name: "diary_student_feed_lookup_1" },
);

applyArchiveFields(DiaryEntrySchema);

const modelRegistry = getModelRegistry();
const existingDiaryEntryModel = modelRegistry.DiaryEntry as
  | Model<IDiaryEntry>
  | undefined;

if (
  existingDiaryEntryModel &&
  (!existingDiaryEntryModel.schema.path("scopeKey") ||
    !existingDiaryEntryModel.schema.path("entryDate") ||
    !existingDiaryEntryModel.schema.path("subject") ||
    !existingDiaryEntryModel.schema.path("resources.id") ||
    !existingDiaryEntryModel.schema.path("updatedBy") ||
    !hasArchiveFields(existingDiaryEntryModel))
) {
  delete modelRegistry.DiaryEntry;
}

const DiaryEntry: Model<IDiaryEntry> =
  (modelRegistry.DiaryEntry as Model<IDiaryEntry>) ||
  mongoose.model<IDiaryEntry>("DiaryEntry", DiaryEntrySchema);

export default DiaryEntry;
