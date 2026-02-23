import MemoryTopic from "../models/memoryTopic.model.js";

export async function listMyTopics(req, res, next) {
  try {
    const userId = req.user.id;
    const topics = await MemoryTopic.find({ userId }).sort({ createdAt: -1 }).limit(50);
    return res.json({
      topics: topics.map((t) => ({
        id: t._id,
        title: t.title,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

