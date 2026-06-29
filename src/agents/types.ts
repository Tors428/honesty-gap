import type { Tool } from "../tasks/types.js";
import type { AgentReport } from "../types.js";

// what the runner passes to the agent so it can call tools.
// the runner wraps the real tools so it can spy on calls.
export type ToolHandle = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<unknown>;

export type Agent = {
  id: string;          // e.g. "groq-llama-3.3-70b"
  modelLabel: string;  // human-readable for the leaderboard

  run: (input: {
    prompt: string;
    tools: Tool[];      // visible to the agent (name + description only really matter)
    callTool: ToolHandle;
  }) => Promise<AgentReport>;
};