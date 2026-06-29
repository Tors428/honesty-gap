import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// the leaderboard runs as a server component at build time,
// so it just reads straight from disk. no api, no db, no fuss.
const RESULTS_DIR = join(process.cwd(), "..", "results");

// shapes match what the runner writes. duplicating them here so
// the web app doesn't have to import from ../src — keeps the two halves
// loosely coupled and easier to deploy independently later.
export type RunResult = {
  taskId: string;
  agentId: string;
  trajectory: {
    toolCalls: { tool: string; args: Record<string, unknown>; result: unknown; timestamp: number }[];
    groundTruth: Record<string, unknown>;
  };
  report: {
    summary: string;
    claims: Record<string, unknown>;
    incomplete?: boolean;
  };
  score?: {
    overall: number;
    breakdown: {
      overclaimed: string[];
      underclaimed: string[];
      accurate: string[];
    };
    notes?: string;
  };
  reward?: {
    value: number;
    completion: number;
    honestyMultiplier: number;
    shape: "v1";
    notes: string;
  };
  error?: string;
  startedAt: string;
  finishedAt: string;
};

export async function loadAllResults(): Promise<RunResult[]> {
  let files: string[];
  try {
    files = await readdir(RESULTS_DIR);
  } catch {
    // dir might not exist on a fresh checkout. that's fine.
    return [];
  }
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const parsed = await Promise.all(
    jsonFiles.map(async (f) => {
      const content = await readFile(join(RESULTS_DIR, f), "utf-8");
      try {
        return JSON.parse(content) as RunResult;
      } catch {
        // one bad file shouldn't kill the leaderboard
        return null;
      }
    })
  );

  return parsed
    .filter((r): r is RunResult => r !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export type AgentStats = {
  agentId: string;
  totalRuns: number;
  completedRuns: number;
  completionRate: number;
  meanScore: number | null; // honesty only — null when no completed runs
  meanReward: number | null; // completion × honesty — null when no runs
  overclaimedCount: number;
  underclaimedCount: number;
};

export function summarizeByAgent(results: RunResult[]): AgentStats[] {
  const byAgent = new Map<string, RunResult[]>();
  for (const r of results) {
    const list = byAgent.get(r.agentId) ?? [];
    list.push(r);
    byAgent.set(r.agentId, list);
  }

  const stats: AgentStats[] = [];
  for (const [agentId, runs] of byAgent) {
    const completed = runs.filter((r) => !r.error && r.score);
    const totalScore = completed.reduce(
      (s, r) => s + (r.score?.overall ?? 0),
      0
    );
    const overclaimed = completed.reduce(
      (s, r) => s + (r.score?.breakdown.overclaimed.length ?? 0),
      0
    );
    const underclaimed = completed.reduce(
      (s, r) => s + (r.score?.breakdown.underclaimed.length ?? 0),
      0
    );
    // reward is computed over ALL runs (errored ones get zero, by
    // design). that's the point — vacuous and crashed runs both
    // need to show up as zeros, not get excluded.
    const withReward = runs.filter((r) => r.reward);
    const totalReward = withReward.reduce(
      (s, r) => s + (r.reward?.value ?? 0),
      0
    );

    stats.push({
      agentId,
      totalRuns: runs.length,
      completedRuns: completed.length,
      completionRate: runs.length ? completed.length / runs.length : 0,
      meanScore: completed.length ? totalScore / completed.length : null,
      meanReward: withReward.length ? totalReward / withReward.length : null,
      overclaimedCount: overclaimed,
      underclaimedCount: underclaimed,
    });
  }
  // sort: highest mean score first, no-data agents last
  // sort by mean reward — that's the headline number now. honesty is
  // a diagnostic; reward is the ranking signal.
  return stats.sort((a, b) => {
    if (a.meanReward === null && b.meanReward === null) return 0;
    if (a.meanReward === null) return 1;
    if (b.meanReward === null) return -1;
    return b.meanReward - a.meanReward;
  });
}