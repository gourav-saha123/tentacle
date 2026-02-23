import mongoose from "mongoose";

const ChatSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assistantId: { type: mongoose.Schema.Types.ObjectId, ref: "Assistant", required: true },
    title: { type: String, default: "" },
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    messageCount: { type: Number, default: 0 },
    maxMessages: { type: Number, default: 24 },
    closedReason: { type: String, default: "" },
  },
  { timestamps: true },
);

const ChatSession = mongoose.model("ChatSession", ChatSessionSchema);

export default ChatSession;

