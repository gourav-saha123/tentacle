import mongoose from "mongoose";

const PostSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },
    content: { type: String, required: true },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

PostSchema.index({ createdAt: -1 });

const Post = mongoose.model("Post", PostSchema);

export default Post;

