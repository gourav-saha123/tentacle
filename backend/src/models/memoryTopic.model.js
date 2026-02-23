import mongoose from "mongoose";

const MemoryTopicSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    embedding: { type: [Number], required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatSession" },
  },
  { timestamps: true },
);

MemoryTopicSchema.index({ userId: 1, createdAt: -1 });

const MemoryTopic = mongoose.model("MemoryTopic", MemoryTopicSchema);

export default MemoryTopic;

