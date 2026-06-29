import OpenAI from "openai";
import type { Agent } from "./types.js";
import type { AgentReport } from "../types.js";

type Config = {
  id: string;
  modelLabel: string;
  apiKey: string;
  baseURL: string;
  model: string; // what the API actually wants in the `model` field
};

// safety net so a misbehaving model can't loop forever and burn the quota
const MAX_TURNS = 10;

export function makeOpenAICompatibleAgent(cfg: Config): Agent {
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    // openrouter free tier can hang on us. don't wait forever.
    timeout: 60_000,
    maxRetries: 0,
  });

  return {
    id: cfg.id,
    modelLabel: cfg.modelLabel,

    run: async ({ prompt, tools, callTool }) => {
      // translate our Tool[] into the OpenAI tools format the model expects
      const oaiTools = tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters ?? { type: "object", properties: {} },
        },
      }));

      // `any` here because openai's message types are a mess of unions
      // and i'd rather not fight them right now. revisit later maybe.
      const messages: any[] = [
        {
          role: "system",
          content:
            "You're an agent completing tasks using tools. " +
            "When you're done, write a short summary describing what you did.",
        },
        { role: "user", content: prompt },
      ];

      let finalText = "";
    
      let incomplete = false;

      for (let turn = 0; turn < MAX_TURNS; turn++) {
        let response;
        try {
          response = await client.chat.completions.create({
            model: cfg.model,
            messages,
            tools: oaiTools.length > 0 ? oaiTools : undefined,
            tool_choice: oaiTools.length > 0 ? "auto" : undefined,
          });
        } catch (err) {
          // some providers (groq especially) 400 when the model emits a
          // malformed tool call. treat that as "agent gave up" — keep
          // whatever final text we have, flag incomplete, and bail.
          finalText =
            finalText ||
            `[api error on turn ${turn}] ${
              err instanceof Error ? err.message : String(err)
            }`;
          incomplete = true;
          break;
        }

        const msg = response.choices[0].message;
        messages.push(msg);

        const toolCalls = msg.tool_calls ?? [];

        if (toolCalls.length === 0) {
          // model decided it's done. take the final content as the report.
          finalText = msg.content ?? "";
          break;
        }

        // execute each tool call and feed results back
        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            // model produced invalid JSON. pass {} and let the tool deal.
            // i've seen smaller models do this on tool calls with no args.
          }

          const result = await callTool(tc.function.name, args);

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
      }

      const report: AgentReport = {
        summary: finalText,
        claims: {},
        incomplete,
      };

      return report;
    },
  };
}