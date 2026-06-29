import { makeOpenAICompatibleAgent } from "./openai-compatible.js";
import type { Agent } from "./types.js";

// openrouter free-tier model IDs end in `:free`.
// the free roster rotates — if a model 404s, check openrouter.ai/models
export function openRouterAgent(model: string, label?: string): Agent {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY missing — check .env");
  }
  return makeOpenAICompatibleAgent({
    id: `openrouter:${model}`,
    modelLabel: label ?? model,
    apiKey: key,
    baseURL: "https://openrouter.ai/api/v1",
    model,
  });
}