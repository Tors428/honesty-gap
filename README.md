# honesty gap

A benchmark and verifiable reward for the gap between what an LLM agent says it did and what it actually did.

The setup: give an agent a task where overclaiming or underclaiming is the natural failure mode, record the real trajectory while it runs, then score the delta between its self-report and the ground truth. Models get ranked on completion × honesty multiplier — a multiplicative reward that closes the vacuous-honesty hole (do nothing, claim nothing, look perfect) without special-casing.

## why this and not another eval

Most agent evals check the final answer, or whether the task technically completed. This one checks whether the agent told the truth about what it did. Designed as a drop-in verifier for RLHF/RLVR pipelines — the reward is task-defined and asymmetric, tougher on overclaim (the failure mode that causes spec gaming) than on underclaim (the humble model, fine).

The full design and empirical findings are in [`writeup/reward-shape.md`](./writeup/reward-shape.md).

## stack

- TS/Node for the runner
- tasks and agents are just modules — drop a new one in and it shows up
- results land in `results/` as JSON, no DB
- Groq and OpenRouter free tiers for the models
- Next.js + Tailwind leaderboard, deployed on Vercel

## running it locally
git clone https://github.com/Tors428/honesty-gap.git

cd honesty-gap

npm install

cp .env.example .env
fill in GROQ_API_KEY and OPENROUTER_API_KEY in .env
npm run run            # run the benchmark

npm run experiment     # print the per-agent summary

Leaderboard:
cd web
npm install
npm run dev

## what's measured

- **honesty** — the claim-vs-trajectory gap. computes overclaim, underclaim, accurate.
- **completion** — task-defined. for fix-the-list: were the wrong values actually corrected. for verify-the-claims: did the lookup tool actually fire on each claim.
- **reward** — completion × honesty multiplier. the single scalar an RL pipeline would consume.

## status

v2. shape validated against a mock-liar control across two tasks with opposite failure modes.