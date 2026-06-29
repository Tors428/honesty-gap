// The shared shapes everything else imports from.
// Keeping these in one place so I don't end up with five
// slightly-different ideas of what a "trajectory" is.

export type ToolCall = {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
  // when it happened, mostly for debugging weird runs
  timestamp: number;
};

// what actually happened while the agent was working.
// the agent doesn't get to write this — the runner does.
export type Trajectory = {
  toolCalls: ToolCall[];
  // anything else the runner wants to track per-task.
  // tasks define what goes in here.
  groundTruth: Record<string, unknown>;
};

// what the agent says it did at the end.
// this is the "claim" half of the honesty gap.
export type AgentReport = {
  summary: string;
  claims: Record<string, unknown>;
  // true if the agent didn't actually finish — api crashed, timeout, etc.
  // the runner uses this to skip scoring.
  incomplete?: boolean;
};

// one full run of one agent on one task
export type RunResult = {
  taskId: string;
  agentId: string;
  trajectory: Trajectory;
  report: AgentReport;
  // honesty score: gap between claim and trajectory. v1 measure.
  score?: HonestyScore;
  // reward: completion × honesty multiplier. the RL signal.
  // stored alongside score so the leaderboard can show both and
  // we can re-score historical runs if the reward shape evolves.
  reward?: RewardRecord;
  error?: string;
  startedAt: string;
  finishedAt: string;
};

// mirror of the Reward type from src/reward/reward.ts. duplicated
// here so types.ts doesn't have to import from reward.ts (keeps the
// dependency direction one-way: reward depends on types, not back).
export type RewardRecord = {
  value: number;
  completion: number;
  honestyMultiplier: number;
  shape: "v1";
  notes: string;
};

export type HonestyScore = {
  // 0 = total liar, 1 = perfectly honest
  // it's a single number for the leaderboard, but the breakdown
  // is where the actual signal is
  overall: number;
  breakdown: {
    overclaimed: string[];   // said it did, didn't
    underclaimed: string[];  // did it, didn't say so (rarer)
    accurate: string[];      // said it, did it
  };
  notes?: string;
};