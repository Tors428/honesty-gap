// runs over results/ and prints the experiment summary.
// the writeup quotes from this output. update both when the shape changes.
//
// usage (from project root):
//   npx tsx scripts/experiment.ts

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

type RunResult = {
  taskId: string;
  agentId: string;
  trajectory: { toolCalls: { tool: string; args: Record<string, unknown> }[] };
  report: { summary: string };
  score?: {
    overall: number;
    breakdown: { overclaimed: string[]; underclaimed: string[]; accurate: string[] };
  };
  reward?: { value: number; completion: number; honestyMultiplier: number };
  error?: string;
};

const RESULTS_DIR = join(process.cwd(), "results");

async function loadResults(): Promise<RunResult[]> {
  const files = await readdir(RESULTS_DIR);
  const json = files.filter((f) => f.endsWith(".json"));
  const out = await Promise.all(
    json.map(async (f) => {
      const c = await readFile(join(RESULTS_DIR, f), "utf-8");
      try {
        return JSON.parse(c) as RunResult;
      } catch {
        return null;
      }
    })
  );
  return out.filter((r): r is RunResult => r !== null);
}

function bucket(value: number): string {
  if (value === 0) return "0.0";
  if (value < 0.25) return "0.0–0.25";
  if (value < 0.5) return "0.25–0.5";
  if (value < 0.75) return "0.5–0.75";
  if (value < 1.0) return "0.75–1.0";
  return "1.0";
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

async function main() {
  const results = await loadResults();

  console.log(`\n=== honesty gap: experiment summary ===`);
  console.log(`total runs: ${results.length}`);

  // group by agent
  const byAgent = new Map<string, RunResult[]>();
  for (const r of results) {
    const list = byAgent.get(r.agentId) ?? [];
    list.push(r);
    byAgent.set(r.agentId, list);
  }

  for (const [agentId, runs] of byAgent) {
    const errored = runs.filter((r) => r.error);
    const completed = runs.filter((r) => !r.error && r.score);
    const scores = completed.map((r) => r.score!.overall);
    const rewards = runs
      .filter((r) => r.reward)
      .map((r) => r.reward!.value);
    const overclaim = completed.reduce(
      (s, r) => s + r.score!.breakdown.overclaimed.length,
      0
    );
    const underclaim = completed.reduce(
      (s, r) => s + r.score!.breakdown.underclaimed.length,
      0
    );

    console.log(`\n— ${agentId} —`);
    console.log(`  runs: ${runs.length} (${completed.length} done, ${errored.length} errored)`);
    if (completed.length > 0) {
      console.log(
        `  honesty: mean ${mean(scores).toFixed(3)}, median ${median(
          scores
        ).toFixed(3)}`
      );
    }
    if (rewards.length > 0) {
      console.log(
        `  reward:  mean ${mean(rewards).toFixed(3)}, median ${median(
          rewards
        ).toFixed(3)}`
      );
    }
    console.log(`  total overclaims: ${overclaim}, underclaims: ${underclaim}`);

    // reward histogram
    if (rewards.length > 0) {
      const buckets = new Map<string, number>();
      for (const v of rewards) {
        const b = bucket(v);
        buckets.set(b, (buckets.get(b) ?? 0) + 1);
      }
      const order = ["0.0", "0.0–0.25", "0.25–0.5", "0.5–0.75", "0.75–1.0", "1.0"];
      console.log(`  reward distribution:`);
      for (const b of order) {
        const n = buckets.get(b) ?? 0;
        if (n === 0) continue;
        const bar = "█".repeat(n);
        console.log(`    ${b.padEnd(11)} ${bar} (${n})`);
      }
    }
  }

  // cross-agent finding: same task, same failure mode?
  console.log(`\n— cross-agent —`);
  const realAgents = [...byAgent.keys()].filter((a) => !a.startsWith("control:"));
  if (realAgents.length >= 2) {
    const underclaimRates = realAgents.map((a) => {
      const completed = (byAgent.get(a) ?? []).filter((r) => !r.error && r.score);
      const withUnderclaim = completed.filter(
        (r) => r.score!.breakdown.underclaimed.length > 0
      );
      return {
        agent: a,
        rate: completed.length ? withUnderclaim.length / completed.length : 0,
      };
    });
    console.log(`  underclaim rate (runs where agent did work but didn't say so):`);
    for (const u of underclaimRates) {
      console.log(`    ${u.agent}: ${(u.rate * 100).toFixed(1)}%`);
    }
  }

  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});