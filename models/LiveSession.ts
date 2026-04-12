import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./AcademicSection.ts";
import "./Class.ts";
import "./Subject.ts";
import "./User.ts";

export type LiveSessionStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled";

export interface ILiveSession extends Document {
  title: string;
  description?: string;
  subject: Types.ObjectId;
  class: Types.ObjectId;
  assignedAcademicSections?: Types.ObjectId[];
  hostTeacher: Types.ObjectId;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  studentJoinUrl: string;
  hostJoinUrl?: string;
  meetingCode?: string;
  meetingPasscode?: string;
  joinInstructions?: string;
  status: LiveSessionStatus;
  startedAt?: Date | null;
  endedAt?: Date | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  activeItemId?: Types.ObjectId | null;
  notificationRevision: number;
  createdAt: Date;
  updatedAt: Date;
}

const LiveSessionSchema = new Schema<ILiveSession>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: undefined,
      trim: true,
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },
    class: {
      type: Schema.Types.ObjectId,
      ref: "Class",
      required: true,
      index: true,
    },
    assignedAcademicSections: {
      type: [Schema.Types.ObjectId],
      ref: "AcademicSection",
      default: [],
    },
    hostTeacher: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
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
    scheduledStartAt: {
      type: Date,
      required: true,
      index: true,
    },
    scheduledEndAt: {
      type: Date,
      required: true,
      index: true,
    },
    studentJoinUrl: {
      type: String,
      required: true,
      trim: true,
    },
    hostJoinUrl: {
      type: String,
      default: undefined,
      trim: true,
    },
    meetingCode: {
      type: String,
      default: undefined,
      trim: true,
    },
    meetingPasscode: {
      type: String,
      default: undefined,
      trim: true,
    },
    joinInstructions: {
      type: String,
      default: undefined,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["draft", "scheduled", "live", "completed", "cancelled"],
      default: "draft",
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelReason: {
      type: String,
      default: null,
      trim: true,
    },
    activeItemId: {
      type: Schema.Types.ObjectId,
      ref: "LiveSessionItem",
      default: null,
      index: true,
    },
    notificationRevision: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

LiveSessionSchema.pre("validate", function (next) {
  const session = this as ILiveSession & {
    invalidate: (path: string, message: string) => void;
  };

  if (
    session.scheduledStartAt instanceof Date &&
    session.scheduledEndAt instanceof Date &&
    !Number.isNaN(session.scheduledStartAt.getTime()) &&
    !Number.isNaN(session.scheduledEndAt.getTime()) &&
    session.scheduledEndAt.getTime() <= session.scheduledStartAt.getTime()
  ) {
    session.invalidate(
      "scheduledEndAt",
      "Live session end time must be after the start time.",
    );
  }

  if (session.status !== "cancelled") {
    session.cancelledAt = null;
    session.cancelReason = null;
  }

  if (session.status !== "live") {
    session.startedAt = session.startedAt || null;
  }

  if (session.status !== "completed") {
    session.endedAt = session.endedAt || null;
  }

  next();
});

LiveSessionSchema.index(
  { class: 1, subject: 1, status: 1, scheduledStartAt: 1 },
  { name: "live_session_scope_status_time_1" },
);
LiveSessionSchema.index(
  { hostTeacher: 1, status: 1, scheduledStartAt: 1 },
  { name: "live_session_host_status_time_1" },
);

const modelRegistry = getModelRegistry();

const existingLiveSessionModel = modelRegistry.LiveSession as
  | Model<ILiveSession>
  | undefined;

if (
  existingLiveSessionModel &&
  (!existingLiveSessionModel.schema.path("notificationRevision") ||
    !existingLiveSessionModel.schema.path("hostTeacher") ||
    !existingLiveSessionModel.schema.path("studentJoinUrl") ||
    !existingLiveSessionModel.schema.path("scheduledEndAt") ||
    !existingLiveSessionModel.schema.path("activeItemId"))
) {
  delete modelRegistry.LiveSession;
}

const LiveSession: Model<ILiveSession> =
  (modelRegistry.LiveSession as Model<ILiveSession>) ||
  mongoose.model<ILiveSession>("LiveSession", LiveSessionSchema);

export default LiveSession;
