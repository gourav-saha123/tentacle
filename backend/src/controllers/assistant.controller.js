import Assistant from "../models/assistant.model.js";

export async function getMyAssistant(req, res, next) {
  try {
    const assistant = await Assistant.findOne({ userId: req.user.id });
    if (!assistant) return res.status(404).json({ error: "Assistant not found" });
    return res.json({
      assistant: {
        id: assistant._id,
        name: assistant.name,
        systemPrompt: assistant.systemPrompt,
        createdAt: assistant.createdAt,
      },
    });
  } catch (err) {
    return next(err);
  }
}

