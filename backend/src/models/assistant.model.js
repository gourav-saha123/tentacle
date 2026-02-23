import mongoose from "mongoose";

const AssistantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true, unique: true },
    name: { type: String, default: "Tentacle" },
    systemPrompt: { type: String, default: "" },
  },
  { timestamps: true },
);

const Assistant = mongoose.model("Assistant", AssistantSchema);

export default Assistant;

