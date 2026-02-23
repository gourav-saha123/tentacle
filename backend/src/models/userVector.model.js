import mongoose from "mongoose";

const UserVectorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    embedding: { type: [Number], required: true },
    topicsCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const UserVector = mongoose.model("UserVector", UserVectorSchema);

export default UserVector;

