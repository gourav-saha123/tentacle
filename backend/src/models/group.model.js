import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    topicEmbedding: { type: [Number] },
  },
  { timestamps: true },
);

GroupSchema.index({ createdAt: -1 });

const Group = mongoose.model("Group", GroupSchema);

export default Group;

