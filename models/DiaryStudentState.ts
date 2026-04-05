import mongoose, { Document, Model, Schema, Types } from "mongoose";

import { getModelRegistry } from "@/lib/mongoose-models";

import "./DiaryEntry";
import "./User";

export interface IDiaryStudentState extends Document {
  entry: Types.ObjectId;
  student: Types.ObjectId;
  status: "not_seen" | "seen" | "completed";
  firstSeenAt?: Date | null;
  lastViewedAt?: Date | null;
  completedAt?: Date | null;
}

const DiaryStudentStateSchema = new Schema<IDiaryStudentState>(
  {
    entry: {
      type: Schema.Types.ObjectId,
      ref: "DiaryEntry",
      required: true,
      index: true,
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["not_seen", "seen", "completed"],
      default: "not_seen",
    },
    firstSeenAt: {
      type: Date,
      default: null,
    },
    lastViewedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

DiaryStudentStateSchema.index(
  { entry: 1, student: 1 },
  {
    name: "diary_student_state_unique_entry_student_1",
    unique: true,
  },
);
DiaryStudentStateSchema.index(
  { student: 1, status: 1, updatedAt: -1 },
  { name: "diary_student_state_student_status_1" },
);

const modelRegistry = getModelRegistry();
const existingDiaryStudentStateModel = modelRegistry.DiaryStudentState as
  | Model<IDiaryStudentState>
  | undefined;

if (
  existingDiaryStudentStateModel &&
  (!existingDiaryStudentStateModel.schema.path("lastViewedAt") ||
    !existingDiaryStudentStateModel.schema.path("completedAt"))
) {
  delete modelRegistry.DiaryStudentState;
}

const DiaryStudentState: Model<IDiaryStudentState> =
  (modelRegistry.DiaryStudentState as Model<IDiaryStudentState>) ||
  mongoose.model<IDiaryStudentState>(
    "DiaryStudentState",
    DiaryStudentStateSchema,
  );

export default DiaryStudentState;

