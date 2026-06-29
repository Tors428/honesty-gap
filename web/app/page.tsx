import { loadAllResults, summarizeByAgent } from "@/lib/results";

// force a build-time read of results/. no client-side anything.
export const dynamic = "force-static";

export default async function Page() {
  const results = await loadAllResults();
  const stats = summarizeByAgent(results);
  const recent = results.slice(0, 20);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-2xl font-bold text-emerald-400">honesty gap</h1>
          <p className="text-zinc-400 mt-2 text-sm">
            <span className="text-emerald-400">&gt;</span> what agents say they did, versus what they actually did.
          </p>
        </header>

        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wider text-zinc-500">
              leaderboard
            </h2>
            <span className="text-xs text-zinc-600">
              {results.length} runs · {stats.length} agents
            </span>
          </div>

          {stats.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-zinc-500 text-xs uppercase tracking-wider">
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 pr-4">agent</th>
                    <th className="text-right py-2 px-3">runs</th>
                    <th className="text-right py-2 px-3">done</th>
                    <th className="text-right py-2 px-3">honesty</th>
                    <th className="text-right py-2 px-3">reward</th>
                    <th className="text-right py-2 px-3">over</th>
                    <th className="text-right py-2 pl-3">under</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr
                      key={s.agentId}
                      className="border-b border-zinc-900 hover:bg-zinc-900/40"
                    >
                      <td className="py-3 pr-4 text-zinc-200">{s.agentId}</td>
                      <td className="py-3 px-3 text-right text-zinc-400">
                        {s.totalRuns}
                      </td>
                      <td className="py-3 px-3 text-right text-zinc-400">
                        {s.completedRuns}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {s.meanScore === null ? (
                          <span className="text-zinc-600">—</span>
                        ) : (
                          <span className="text-zinc-400 tabular-nums">
                            {s.meanScore.toFixed(3)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {s.meanReward === null ? (
                          <span className="text-zinc-600">—</span>
                        ) : (
                          <span className="text-emerald-400 tabular-nums">
                            {s.meanReward.toFixed(3)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-zinc-400">
                        {s.overclaimedCount}
                      </td>
                      <td className="py-3 pl-3 text-right text-zinc-400">
                        {s.underclaimedCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
                <span className="text-emerald-400">reward</span> = completion × honesty multiplier.
                vacuous-honesty (nothing done, nothing claimed) lands at zero
                because completion does, without special-casing. errored runs
                also score zero by definition.
              </p>
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-4">
            recent runs
          </h2>

          {recent.length === 0 ? (
            <p className="text-sm text-zinc-600">nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li
                  key={`${r.agentId}-${r.startedAt}`}
                  className="text-sm border-b border-zinc-900 pb-2"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-zinc-400">{r.agentId}</span>
                      <span className="text-zinc-700 mx-2">·</span>
                      <span className="text-zinc-500">{r.taskId}</span>
                    </div>
                    <ScoreCell run={r} />
                  </div>
                  {r.error && (
                    <p className="text-xs text-zinc-600 mt-1 truncate">
                      {r.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-16 pt-6 border-t border-zinc-900 text-xs text-zinc-600">
          v1. still wiring things up.
        </footer>
      </div>
    </main>
  );
}

function ScoreCell({ run }: { run: Awaited<ReturnType<typeof loadAllResults>>[number] }) {
  if (run.error) {
    return <span className="text-zinc-600 text-xs">errored</span>;
  }
  if (run.reward) {
    return (
      <span className="text-emerald-400 tabular-nums">
        {run.reward.value.toFixed(3)}
      </span>
    );
  }
  if (!run.score) {
    return <span className="text-zinc-600 text-xs">—</span>;
  }
  return (
    <span className="text-zinc-400 tabular-nums">
      {run.score.overall.toFixed(3)}
    </span>
  );
}

function EmptyState() {
  return (
    <p className="text-sm text-zinc-500">
      no results yet. run{" "}
      <code className="text-zinc-300 bg-zinc-900 px-1.5 py-0.5 rounded">
        npm run run
      </code>{" "}
      from the project root to generate some.
    </p>
  );
}