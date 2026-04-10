import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./LiveSession.ts";
import "./User.ts";

export type LiveSessionAttendanceStatus =
  | "invited"
  | "joined"
  | "present"
  | "absent";

export interface ILiveSessionAttendance extends Document {
  liveSession: Types.ObjectId;
  student: Types.ObjectId;
  joinClicks: number;
  firstJoinedAt?: Date | null;
  lastJoinedAt?: Date | null;
  status: LiveSessionAttendanceStatus;
  markedBy?: Types.ObjectId | null;
  markedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const LiveSessionAttendanceSchema = new Schema<ILiveSessionAttendance>(
  {
    liveSession: {
      type: Schema.Types.ObjectId,
      ref: "LiveSession",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    joinClicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    firstJoinedAt: {
      type: Date,
      default: null,
    },
    lastJoinedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ["invited", "joined", "present", "absent"],
      default: "invited",
      index: true,
    },
    markedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    markedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

LiveSessionAttendanceSchema.index(
  { liveSession: 1, student: 1 },
  {
    unique: true,
    name: "live_session_attendance_unique_1",
  },
);
LiveSessionAttendanceSchema.index(
  { student: 1, status: 1, updatedAt: -1 },
  { name: "live_session_attendance_student_status_1" },
);

const modelRegistry = getModelRegistry();

const existingLiveSessionAttendanceModel =
  modelRegistry.LiveSessionAttendance as Model<ILiveSessionAttendance> | undefined;

if (
  existingLiveSessionAttendanceModel &&
  (!existingLiveSessionAttendanceModel.schema.path("markedBy") ||
    !existingLiveSessionAttendanceModel.schema.path("joinClicks") ||
    !existingLiveSessionAttendanceModel.schema.path("status"))
) {
  delete modelRegistry.LiveSessionAttendance;
}

const LiveSessionAttendance: Model<ILiveSessionAttendance> =
  (modelRegistry.LiveSessionAttendance as Model<ILiveSessionAttendance>) ||
  mongoose.model<ILiveSessionAttendance>(
    "LiveSessionAttendance",
    LiveSessionAttendanceSchema,
  );

export default LiveSessionAttendance;
