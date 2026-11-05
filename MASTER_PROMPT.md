# MISSION
Build the complete WHAP app (Wagers Hiring Application Platform) end to end, Phases 0 to 8, inside D:\WHAP.
SOURCE OF TRUTH: docs/WHAP Implementation Plan.pdf. Read it fully first (pdftotext or view).
Follow its business rules (sec 6), data model (sec 7), functions (sec 8), phases (sec 9), tests (sec 10),
cut-order (sec 13) and final checklist (sec 14) exactly. If this file and the PDF conflict, the PDF wins.

# KEY FORMAT NOTE
This Supabase project uses the NEW API keys, not legacy JWT keys.
- VITE_SUPABASE_ANON_KEY holds a publishable key (sb_publishable_...). Frontend only.
- SUPABASE_SERVICE_ROLE_KEY holds a secret key (sb_secret_...). Node test script only, never in frontend or Git.
- Use a current @supabase/supabase-js (verify with `npm view @supabase/supabase-js version`). Do not decode keys as JWTs.
- All values are in D:\WHAP\.env.local. Never print the secret key or DB password in output, logs or commits.

# OPERATING MODE
- Fully autonomous. Do NOT ask questions. Decide, log in DECISIONS.md, continue.
- One change at a time. After each: run it, save REAL output, git commit with a small message.
- Never claim success without command output. Never invent versions, APIs or commands: verify with
  `npm view`, `--help`, or official docs via /browser.
- Never silently swap a tool. Never delete, skip or weaken a test to make it pass.
- Do NOT run local Supabase Docker. Use the remote project via `supabase link` and `supabase db push`.
- Stay inside D:\WHAP. No force-push. FIRST create .gitignore with .env* and node_modules. No secrets in Git.

# LOGINS (do these yourself in Phase 0)
Check `npx supabase projects list`, `gh auth status`, `vercel whoami`. For any that is not logged in,
run its login command (`npx supabase login`, `gh auth login`, `vercel login`) and WAIT for me to finish
the browser sign-in, then continue. If gh or vercel is not installed: `winget install GitHub.cli` and
`npm install -g vercel`, then retry. Check Node >= 20.19.

# CONTEXT MANAGEMENT
- PROGRESS.md is the single checkpoint: current phase, last passing step, next step, open issues.
  Update after every commit. After any restart or context reset: re-read this file, the PDF and PROGRESS.md,
  then resume from "next step".
- Run /context at the end of each phase. If usage is above about 60%, write a full summary to PROGRESS.md.
- Use subagents for noisy work: full test runs, the 100-request load test, dependency research,
  /codesearch, and browser verification (/browser). Keep only their summaries in the main context.
- Save proof of each phase in /evidence/phase-N.txt (real command output).

# EXECUTION PLAN
Phase 0: Setup, logins, git init, verify .env.local keys exist and work (simple authenticated API call).
Phase 1: `openspec init` (verify the CLI exists; if not, find the official package with `npm view`, install it,
         log in DECISIONS.md). Write AGENTS.md, OpenSpec specs, one change per feature. Gate: `openspec validate` passes.
Phase 2: SQL migrations (PostGIS, tables, GiST + FK + status indexes, CHECK constraints, RLS on EVERY table,
         wallet/escrow writable only via functions) + seed data (2 requesters, 4 workers, 1 admin, funded wallets,
         8 tasks: 6 inside 1.5 km, 2 outside). Push to remote.
         Gate: proof a worker cannot see tasks beyond 1.5 km, even by id.
Phase 3: Functions in order, each with a test in tests/whap.test.js: post_task + nearby_tasks, place_bid,
         accept_bid (row lock, concurrency-safe), complete_task, cancel_task, resolve_dispute + submit_review +
         expire_tasks. Config values live in a config table, not hard-coded.
         Gate: full flow and EVERY item in plan sec 10 passes, including 2 simultaneous accepts and the
         100-request nearby_tasks load test with timings.
Phase 4: Vite + React (JavaScript) + Tailwind + react-router + lucide-react + react-leaflet + vite-plugin-pwa.
         Register/login, role-protected routes, PWA manifest + service worker.
Phase 5: Requester and worker screens exactly as in the plan. Realtime plus 3-second polling fallback.
         Once Phase 3 is green, build requester UI and worker UI as two parallel subagents in separate git
         worktrees, then merge. Verify with the browser subagent using two sessions (requester + worker):
         post, bid, accept, OTP, payout.
Phase 6: Break attempts (read another user's data, read OTP as worker, edit wallet directly): all must fail.
         Add the label "Prototype - simulated payments" in Wallet/Profile.
Phase 7: Deploy the frontend to Vercel with env vars (publishable key only), push code to GitHub, add the
         GitHub Action keep-alive calling the Supabase API every few days.
Phase 8: README.md, PROJECT_EXPLAINED.md (every table, function, screen in simple English), DEMO_SCRIPT.md.
If time or context runs short, cut in the order of plan sec 13. Never cut: accept bid with escrow,
OTP completion, wallet ledger.

# ONLY STOP FOR
A login I must finish in the browser, or a missing or invalid value in .env.local. Write what you need in
BLOCKED.md, finish everything that does not depend on it, then stop.

# DEFINITION OF DONE
All tests pass with saved output; RLS verified; no secrets in Git; live URL works; keep-alive set;
README, PROJECT_EXPLAINED and DEMO_SCRIPT written; FINAL_REPORT.md ticks every item of plan sec 14 with links
to evidence files and an honest list of what is built vs only planned.
