import Assistant from "../models/assistant.model.js";
import ChatSession from "../models/chatSession.model.js";
import ChatMessage from "../models/chatMessage.model.js";
import { mistralChat } from "../services/mistral.service.js";
import { extractAndStoreTopicsFromSession } from "../services/memory.service.js";

const DEFAULT_MAX_MESSAGES = Number(process.env.CHAT_MAX_MESSAGES || 24);

async function ensureAssistant(userId) {
  let assistant = await Assistant.findOne({ userId });
  if (!assistant) {
    assistant = await Assistant.create({
      userId,
      name: "Tentacle",
      systemPrompt:
        process.env.TENTACLE_SYSTEM_PROMPT ||
        "You are Tentacle, an AI onboarding assistant. Ask short, focused questions to understand the user's skills, goals, projects, and collaboration intent. Keep responses concise. Prefer one question at a time.",
    });
  }
  return assistant;
}

export async function createSession(req, res, next) {
  try {
    const userId = req.user.id;
    const assistant = await ensureAssistant(userId);

    const session = await ChatSession.create({
      userId,
      assistantId: assistant._id,
      title: req.body?.title || "",
      maxMessages: DEFAULT_MAX_MESSAGES,
    });

    const { content } = await mistralChat({
      systemPrompt: assistant.systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Start a new onboarding conversation. Greet the user briefly and ask one short question to understand their skills, goals, or current projects.",
        },
      ],
    });

    await ChatMessage.create({
      sessionId: session._id,
      userId,
      role: "assistant",
      content,
      index: 0,
    });

    session.messageCount = 1;
    await session.save();

    return res.status(201).json({
      session: {
        id: session._id,
        status: session.status,
        title: session.title,
        messageCount: session.messageCount,
        maxMessages: session.maxMessages,
        createdAt: session.createdAt,
      },
      firstMessage: { role: "assistant", content },
    });
  } catch (err) {
    return next(err);
  }
}

export async function listSessions(req, res, next) {
  try {
    const userId = req.user.id;
    const sessions = await ChatSession.find({ userId }).sort({ createdAt: -1 }).limit(20);
    return res.json({
      sessions: sessions.map((s) => ({
        id: s._id,
        status: s.status,
        title: s.title,
        messageCount: s.messageCount,
        maxMessages: s.maxMessages,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function getSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const messages = await ChatMessage.find({ sessionId: session._id })
      .sort({ index: 1 })
      .limit(100);

    return res.json({
      session: {
        id: session._id,
        status: session.status,
        title: session.title,
        messageCount: session.messageCount,
        maxMessages: session.maxMessages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messages: messages.map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;
    const { content: userContent } = req.body || {};
    if (!userContent) return res.status(400).json({ error: "content is required" });

    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status !== "open") {
      return res.status(400).json({ error: "Session is closed, start a new one" });
    }
    if (session.messageCount >= session.maxMessages) {
      return res.status(400).json({ error: "Session reached message limit, start a new one" });
    }

    const assistant = await ensureAssistant(userId);

    const existingMessages = await ChatMessage.find({ sessionId: session._id })
      .sort({ index: 1 })
      .limit(40);

    const historyForModel = existingMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const { content: assistantContent } = await mistralChat({
      systemPrompt: assistant.systemPrompt,
      messages: [...historyForModel, { role: "user", content: userContent }],
    });

    const nextIndex = existingMessages.length;

    await ChatMessage.create([
      {
        sessionId: session._id,
        userId,
        role: "user",
        content: userContent,
        index: nextIndex,
      },
      {
        sessionId: session._id,
        userId,
        role: "assistant",
        content: assistantContent,
        index: nextIndex + 1,
      },
    ]);

    session.messageCount += 2;
    let sessionClosed = false;
    let topics = [];
    if (session.messageCount >= session.maxMessages) {
      session.status = "closed";
      session.closedReason = "max_messages_reached";
      sessionClosed = true;
    }
    await session.save();

    if (sessionClosed) {
      const allMessages = await ChatMessage.find({ sessionId: session._id }).sort({ index: 1 });
      topics = await extractAndStoreTopicsFromSession({ userId, session, messages: allMessages });
    }

    return res.json({
      session: {
        id: session._id,
        status: session.status,
        messageCount: session.messageCount,
        maxMessages: session.maxMessages,
      },
      messages: [
        { role: "user", content: userContent },
        { role: "assistant", content: assistantContent },
      ],
      sessionClosed,
      topics: topics.map((t) => ({ id: t._id, title: t.title, description: t.description })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function closeSession(req, res, next) {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const session = await ChatSession.findOne({ _id: sessionId, userId });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (session.status === "closed") {
      return res.json({ session: { id: session._id, status: session.status } });
    }

    session.status = "closed";
    session.closedReason = "user_closed";
    await session.save();

    const messages = await ChatMessage.find({ sessionId: session._id }).sort({ index: 1 });
    const topics = await extractAndStoreTopicsFromSession({ userId, session, messages });

    return res.json({
      session: {
        id: session._id,
        status: session.status,
        closedReason: session.closedReason,
      },
      topics: topics.map((t) => ({
        id: t._id,
        title: t.title,
        description: t.description,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

