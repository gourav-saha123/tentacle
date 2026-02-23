import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ChatSession", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    index: { type: Number, required: true },
  },
  { timestamps: true },
);

const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);

export default ChatMessage;

