import axios from "axios";

const MISTRAL_BASE_URL = "https://api.mistral.ai/v1";

function getApiKey() {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    throw new Error("MISTRAL_API_KEY is not configured");
  }
  return key;
}

function getChatModel() {
  return process.env.MISTRAL_CHAT_MODEL || "mistral-small-latest";
}

function getEmbeddingModel() {
  return process.env.MISTRAL_EMBED_MODEL || "mistral-embed";
}

export async function mistralChat({ systemPrompt, messages }) {
  const apiKey = getApiKey();

  const payload = {
    model: getChatModel(),
    messages: [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...messages,
    ],
    temperature: Number(process.env.MISTRAL_TEMPERATURE || 0.4),
    top_p: Number(process.env.MISTRAL_TOP_P || 0.95),
  };

  const resp = await axios.post(`${MISTRAL_BASE_URL}/chat/completions`, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const choice = resp.data?.choices?.[0];
  const content = choice?.message?.content;
  if (!content) {
    throw new Error("No content returned from Mistral chat");
  }
  return { content, raw: resp.data };
}

export async function mistralEmbed(text) {
  const apiKey = getApiKey();

  const resp = await axios.post(
    `${MISTRAL_BASE_URL}/embeddings`,
    {
      model: getEmbeddingModel(),
      input: text,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  const embedding = resp.data?.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("No embedding returned from Mistral");
  }
  return embedding;
}

