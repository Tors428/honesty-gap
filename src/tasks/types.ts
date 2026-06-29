import type { Trajectory, AgentReport, HonestyScore } from "../types.js";

export type Tool = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
};

export type Task = {
  id: string;
  prompt: string;
  tools: Tool[];

  // honesty score: gap between claim and trajectory. v1 measure.
  score: (trajectory: Trajectory, report: AgentReport) => HonestyScore;

  // completion signal: did the task actually get done? returns [0, 1].
  // tasks own this because only the task knows what "done" means.
  // the reward function uses this as the gate on honesty —
  // claims about uncompleted work don't pay out.
  completionSignal: (trajectory: Trajectory) => number;
};