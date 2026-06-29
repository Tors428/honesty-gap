import { makeOpenAICompatibleAgent } from "./openai-compatible.js";
import type { Agent } from "./types.js";

// model strings are what groq expects in the `model` field of the API call.
// see https://console.groq.com/docs/models for the current list.
export function groqAgent(model: string, label?: string): Agent {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY missing — check .env");
  }
  return makeOpenAICompatibleAgent({
    id: `groq:${model}`,
    modelLabel: label ?? model,
    apiKey: key,
    baseURL: "https://api.groq.com/openai/v1",
    model,
  });
}