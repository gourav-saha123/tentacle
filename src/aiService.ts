import { GoogleGenAI } from "@google/genai";
import { UserProfile, ChatMessage, Memory, Group } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_INSTRUCTION = `You are "Tentacle AI", a smart collaboration assistant. 
Your goal is to understand the user's skills, goals, and interests through conversation.
You should:
1. Ask engaging questions to learn about the user.
2. Stay on topic (collaboration, skills, projects).
3. Be friendly and professional.
4. Periodically update your "long-term memory" about the user.
5. If you identify a unique project idea or skill set that doesn't match existing groups, you will suggest creating a new group idea for the public feed.`;

export const getChatResponse = async (
  messages: ChatMessage[], 
  memory: Memory | null, 
  userProfile: UserProfile
) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: messages.map(m => ({
      role: m.role,
      parts: [{ text: m.content }]
    })),
    config: {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nUser Profile: ${JSON.stringify(userProfile)}\nLong-term Memory: ${memory?.content || 'No memory yet.'}`
    }
  });
  const response = await model;
  return response.text;
};

export const updateMemory = async (conversation: string, currentMemory: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this conversation:\n"${conversation}"\n\nAnd current memory:\n"${currentMemory}"\n\nUpdate the long-term memory about this user. Focus on their skills, goals, and interests. Keep it concise and structured.`,
  });
  const response = await model;
  return response.text;
};

export const generateFeedPost = async (userProfile: UserProfile, memory: Memory | null, existingGroups: Group[]) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `User Profile: ${JSON.stringify(userProfile)}\nMemory: ${memory?.content || ''}\nExisting Groups: ${JSON.stringify(existingGroups)}\n\nIf the user has a unique skill or idea not represented in existing groups, write a short, exciting social media post (max 280 chars) proposing a new group idea. If a good match exists, return "NO_POST".`,
  });
  const response = await model;
  return response.text;
};

export const analyzeWorkPotential = async (userProfile: UserProfile, memory: Memory | null, existingGroups: Group[]) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `User Profile: ${JSON.stringify(userProfile)}\nMemory: ${memory?.content || ''}\nExisting Groups: ${JSON.stringify(existingGroups)}\n\nAnalyze if the user should join an existing group, create a new one, or if more info is needed.
    Return JSON with:
    - action: "JOIN" | "CREATE" | "NEED_INFO"
    - groupId: string (if JOIN)
    - postContent: string (if CREATE, a short post for the feed)
    - message: string (if NEED_INFO, a polite request for more details)`,
    config: {
      responseMimeType: "application/json"
    }
  });
  const response = await model;
  return JSON.parse(response.text || '{}');
};

export const generateGroupDetails = async (postContent: string) => {
  const model = ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this post: "${postContent}", generate a group title, about section, and a clear goal. Return as JSON with keys: title, about, goal.`,
    config: {
      responseMimeType: "application/json"
    }
  });
  const response = await model;
  return JSON.parse(response.text || '{}');
};
