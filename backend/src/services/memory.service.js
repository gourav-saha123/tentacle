import MemoryTopic from "../models/memoryTopic.model.js";
import UserVector from "../models/userVector.model.js";
import { mistralChat, mistralEmbed } from "./mistral.service.js";

function updatedMeanVector({ prevMean, prevCount, nextVector }) {
  if (!prevMean || prevCount <= 0) return nextVector;
  const n = prevCount;
  const out = new Array(nextVector.length);
  for (let i = 0; i < nextVector.length; i += 1) {
    out[i] = (prevMean[i] * n + nextVector[i]) / (n + 1);
  }
  return out;
}

async function upsertUserVector({ userId, embedding }) {
  const existing = await UserVector.findOne({ userId });
  if (!existing) {
    await UserVector.create({ userId, embedding, topicsCount: 1 });
    return;
  }
  existing.embedding = updatedMeanVector({
    prevMean: existing.embedding,
    prevCount: existing.topicsCount || 0,
    nextVector: embedding,
  });
  existing.topicsCount = (existing.topicsCount || 0) + 1;
  await existing.save();
}

export async function extractAndStoreTopicsFromSession({ userId, session, messages }) {
  if (!messages || messages.length === 0) return [];

  const joined = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");

  const systemPrompt =
    "You are an assistant that extracts 1-3 concise learning or collaboration topics from a conversation. " +
    "Return ONLY valid JSON: an array of objects with fields 'title' and 'description'. " +
    "Each title should be short and specific. Each description should be 2-4 sentences summarising what the user knows or wants.";

  const { content } = await mistralChat({
    systemPrompt,
    messages: [{ role: "user", content: joined }],
  });

  let topicsJson;
  try {
    const startIdx = content.indexOf("[");
    const endIdx = content.lastIndexOf("]");
    const jsonText = startIdx !== -1 && endIdx !== -1 ? content.slice(startIdx, endIdx + 1) : content;
    topicsJson = JSON.parse(jsonText);
  } catch {
    return [];
  }

  const topics = Array.isArray(topicsJson) ? topicsJson : [];
  const created = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const t of topics) {
    if (!t || !t.title || !t.description) continue;
    // eslint-disable-next-line no-await-in-loop
    const embedding = await mistralEmbed(`${t.title}\n\n${t.description}`);
    // eslint-disable-next-line no-await-in-loop
    const doc = await MemoryTopic.create({
      userId,
      title: t.title,
      description: t.description,
      embedding,
      sessionId: session._id,
    });
    // eslint-disable-next-line no-await-in-loop
    await upsertUserVector({ userId, embedding });
    created.push(doc);
  }

  return created;
}

