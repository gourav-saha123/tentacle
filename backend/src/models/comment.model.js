import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

CommentSchema.index({ postId: 1, createdAt: 1 });

const Comment = mongoose.model("Comment", CommentSchema);

export default Comment;

