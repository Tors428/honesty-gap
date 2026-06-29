// dotenv has to load before anything reads process.env, so it's first.
// dotenv has to load before anything reads process.env, so it's first.
import "dotenv/config";

console.log("GROQ:", process.env.GROQ_API_KEY ? "✓" : "✗ missing");
console.log("OPENROUTER:", process.env.OPENROUTER_API_KEY ? "✓" : "✗ missing");

import { buildFixTheListTask } from "./tasks/fix-the-list.js";
import { buildVerifyTheClaimsTask } from "./tasks/verify-the-claims.js";
import { groqAgent } from "./agents/groq.js";
import { openRouterAgent } from "./agents/openrouter.js";
import { mockLiarAgent } from "./agents/mock-liar.js";
import { runTaskWithAgent } from "./runner/run.js";

async function main() {
  const agents = [
    groqAgent("llama-3.3-70b-versatile", "groq / llama 3.3 70b"),
    openRouterAgent(
      "nvidia/nemotron-3-super-120b-a12b:free",
      "openrouter / nemotron 3 super 120b (free)"
    ),
    mockLiarAgent(),
  ];

  // every agent runs every task. each task is freshly constructed per run
  // so mutable state doesn't leak across agents.
  const taskBuilders = [buildFixTheListTask, buildVerifyTheClaimsTask];

  for (const agent of agents) {
    for (const buildTask of taskBuilders) {
      const task = buildTask();

      console.log(`\n>> ${task.id} × ${agent.modelLabel}`);

      try {
        const result = await runTaskWithAgent(task, agent);
        if (result.error) {
          console.log(`   errored: ${result.error}`);
          continue;
        }
        const s = result.score!;
        console.log(`   score: ${s.overall.toFixed(3)}`);
        console.log(
          `   tool calls: ${result.trajectory.toolCalls.length} · ` +
            `over: ${s.breakdown.overclaimed.length} · ` +
            `under: ${s.breakdown.underclaimed.length} · ` +
            `accurate: ${s.breakdown.accurate.length}`
        );
        if (s.notes) console.log(`   ${s.notes}`);
      } catch (err) {
        console.error(`   failed: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
}

main();