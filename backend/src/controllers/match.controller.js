import UserVector from "../models/userVector.model.js";
import User from "../models/user.model.js";
import { cosineSimilarity } from "../services/similarity.service.js";

export async function recommendedUsers(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit || 20), 50);

    const me = await UserVector.findOne({ userId });
    if (!me) {
      return res.json({ users: [] });
    }

    const others = await UserVector.find({ userId: { $ne: userId } }).limit(500);
    if (others.length === 0) return res.json({ users: [] });

    const scored = others
      .map((u) => ({
        userId: u.userId,
        similarity: cosineSimilarity(me.embedding, u.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    const users = await User.find({ _id: { $in: scored.map((s) => s.userId) } }).select("name");
    const nameById = new Map(users.map((u) => [String(u._id), u.name]));

    return res.json({
      users: scored.map((s) => ({
        id: s.userId,
        name: nameById.get(String(s.userId)) || "User",
        similarity: s.similarity,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

