import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Task } from "../tasks/types.js";
import type { Agent } from "../agents/types.js";
import type { RunResult, Trajectory } from "../types.js";
import { rewardFor } from "../reward/reward.js";

const RESULTS_DIR = "results";

export async function runTaskWithAgent(
  task: Task,
  agent: Agent
): Promise<RunResult> {
  const startedAt = new Date().toISOString();

  // the spy. every tool call the agent makes lands here.
  // the agent never sees this object directly.
  const trajectory: Trajectory = {
    toolCalls: [],
    groundTruth: {},
  };

  // this is what the agent will use to invoke tools.
  // it looks up the real tool, runs it, and records the call.
  const callTool = async (
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> => {
    const tool = task.tools.find((t) => t.name === toolName);

    if (!tool) {
      // agent hallucinated a tool. record it so we can see what happened.
      const errResult = { error: `unknown tool: ${toolName}` };
      trajectory.toolCalls.push({
        tool: toolName,
        args,
        result: errResult,
        timestamp: Date.now(),
      });
      return errResult;
    }

    const result = await tool.execute(args);

    trajectory.toolCalls.push({
      tool: toolName,
      args,
      result,
      timestamp: Date.now(),
    });

    return result;
  };

  // run the agent. if it throws, we still want to save what we got.
  let report;
  let runError: string | undefined;
  try {
    report = await agent.run({
      prompt: task.prompt,
      tools: task.tools,
      callTool,
    });
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err);
    report = {
      summary: `[agent error] ${runError}`,
      claims: {},
    };
  }
const finishedAt = new Date().toISOString();

  // only score if the agent actually ran. errored runs get no score —
  // a crash isn't a 1.0, it's a non-result.
  const score =
    runError || report.incomplete
      ? undefined
      : task.score(trajectory, report);

  // assemble the partial result first so rewardFor can read from it.
  // we compute reward after score so the function has everything.
  const partial: RunResult = {
    taskId: task.id,
    agentId: agent.id,
    trajectory,
    report,
    score,
    error: runError ?? (report.incomplete ? report.summary : undefined),
    startedAt,
    finishedAt,
  };

  // reward is computed even when score is undefined — the reward
  // function knows to return zero for errored / incomplete runs.
  // this matters for the leaderboard: errored agents should show
  // a real "0 reward" entry, not a missing one.
  const reward = rewardFor(partial, task);

  const runResult: RunResult = { ...partial, reward };
  await saveResult(runResult);
  return runResult;
}

async function saveResult(result: RunResult): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true });
  // filename pattern: <task>__<agent>__<timestamp>.json
  // colons in the agent id break filesystems, so sanitize.
  const safeAgent = result.agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTs = result.startedAt.replace(/[:.]/g, "-");
  const filename = `${result.taskId}__${safeAgent}__${safeTs}.json`;
  await writeFile(
    join(RESULTS_DIR, filename),
    JSON.stringify(result, null, 2),
    "utf-8"
  );
}