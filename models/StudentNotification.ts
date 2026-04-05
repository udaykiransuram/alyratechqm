import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./User.ts";

export type StudentNotificationType =
  | "course_assigned"
  | "course_due_soon"
  | "test_assigned"
  | "diary_update";

export type StudentNotificationEntityType = "course" | "test" | "diary";

export interface IStudentNotification extends Document {
  studentId: Types.ObjectId;
  type: StudentNotificationType;
  title: string;
  message: string;
  linkUrl?: string;
  entityId?: string;
  entityType?: StudentNotificationEntityType;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudentNotificationSchema = new Schema<IStudentNotification>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["course_assigned", "course_due_soon", "test_assigned", "diary_update"],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    linkUrl: {
      type: String,
      default: "",
      trim: true,
    },
    entityId: {
      type: String,
      default: "",
      trim: true,
    },
    entityType: {
      type: String,
      enum: ["course", "test", "diary"],
      default: undefined,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

StudentNotificationSchema.index({ studentId: 1, createdAt: -1 });
StudentNotificationSchema.index({ studentId: 1, readAt: 1 });
StudentNotificationSchema.index(
  { studentId: 1, type: 1, entityId: 1 },
  { unique: true, name: "student_notification_unique_1" },
);

const modelRegistry = getModelRegistry();

const StudentNotification: Model<IStudentNotification> =
  (modelRegistry.StudentNotification as Model<IStudentNotification>) ||
  mongoose.model<IStudentNotification>(
    "StudentNotification",
    StudentNotificationSchema,
  );

export default StudentNotification;
