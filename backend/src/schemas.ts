import { Schema } from "mongoose";
const options = { timestamps: true, versionKey: false } as const;
const step = new Schema(
  {
    title: { type: String, required: true },
    instruction: { type: String, required: true },
    minutes: { type: Number, required: true },
    phoneAway: Boolean,
  },
  { _id: false },
);
const config = new Schema(
  {
    minutes: Number,
    mood: String,
    location: String,
    mobility: String,
    company: String,
    place: {
      id: String,
      name: String,
      address: String,
      latitude: Number,
      longitude: Number,
      rating: Number,
      source: String,
    },
  },
  { _id: false },
);
export const UserSchema = new Schema(
  {
    _id: String,
    name: String,
    voice: Boolean,
    reducedMotion: Boolean,
    tokenHash: { type: String, required: true, unique: true },
  },
  options,
);
export const QuestSchema = new Schema(
  {
    _id: String,
    userId: { type: String, required: true, index: true },
    title: String,
    description: String,
    steps: [step],
    bingo: [String],
    config,
    safety: [String],
    source: String,
    createdAt: String,
  },
  { versionKey: false },
);
export const ProgressSchema = new Schema(
  {
    _id: String,
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["ready", "active", "completed"],
      default: "ready",
    },
    completedSteps: [Number],
    bingo: [Number],
    startedAt: String,
    finishedAt: String,
    screenSeconds: Number,
    elapsedSeconds: Number,
    revision: { type: Number, default: 0 },
  },
  { versionKey: false },
);
export const ObservationSchema = new Schema(
  {
    _id: String,
    questId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    note: String,
    source: String,
    insight: {
      label: String,
      insight: String,
      curiosity: String,
      confidence: String,
    },
    createdAt: String,
  },
  { versionKey: false },
);
ObservationSchema.index({ questId: 1, createdAt: -1 });
