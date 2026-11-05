# Dispatch to teamwork_worker (Milestone 1: Environment & Database Foundations)

You are teamwork_worker assigned to Milestone 1: Environment & Database Foundations.
Your working directory is: `d:\WHAP\.agents\teamwork\worker_m1\`
Your parent is: `dd373ee0-ea33-4375-bc24-2ece74f17800` (Orchestrator)

## Exclusive File Ownership
You exclusively own and may create/modify:
- `d:\WHAP\.gitignore`
- `d:\WHAP\MASTER_PROMPT.md`
- `d:\WHAP\supabase/migrations/`
- `d:\WHAP\supabase/seed.sql`
- `d:\WHAP\scripts/` (for executing migrations and remote database queries)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective
Read:
- `ORIGINAL_REQUEST.md` at `d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md`
- `PROJECT.md` at `d:\WHAP\.agents\teamwork\PROJECT.md`
- `d:\WHAP\.agents\teamwork\explorer_env_e2e\analysis.md` and `handoff.md`
- `d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md` and `handoff.md`

Execute the following implementation steps:
1. **Workspace Hygiene & Git Init**:
   - Create `d:\WHAP\.gitignore` ignoring `.env*`, `node_modules/`, `dist/`.
   - Initialize git repo (`git init`), configure local user if needed, and make an initial commit of the clean baseline (`git add .`, `git commit -m "chore: initial repository baseline with .gitignore"`).
   - VERIFY that `.env.local` is NOT tracked in git (`git status`, `git ls-files`).
2. **MASTER_PROMPT Correction**:
   - Correct line 3 of `d:\WHAP\MASTER_PROMPT.md` from `docs/WHAP_Implementation_Plan.pdf` to `docs/WHAP Implementation Plan.pdf` without moving or duplicating the PDF.
3. **Supabase SQL Migrations**:
   - Write and execute migration in Supabase to:
     - Enable `postgis` extension.
     - Create 9 tables: `profiles`, `wallets`, `tasks`, `bids`, `escrow_transactions`, `ledger_entries`, `reviews`, `notifications`, `config`.
     - Add all CHECK constraints (e.g. `wallets.balance >= 0`, `tasks.budget BETWEEN 50 AND 300`, `bids.amount >= 20`).
     - Add spatial GiST index on `tasks.location`, foreign key indexes, and status indexes.
     - Insert default operational constants into `config` table.
     - Insert campus seed data (2 requesters, 4 workers, 1 admin, 8 tasks: 6 within 1.5km, 2 outside).
4. **Row Level Security (RLS)**:
   - Enable RLS on all 9 tables.
   - Deny direct client write (INSERT/UPDATE/DELETE) on `wallets`, `ledger_entries`, `escrow_transactions`.
   - Enforce spatial isolation: workers cannot query tasks beyond 1.5 km (`ST_DWithin(tasks.location, worker_location, 1500)`), even by direct id.
   - Enforce OTP secrecy: workers cannot read OTPs.
5. **Run Gate Verification**:
   - Execute verification script proving:
     a) Worker cannot query tasks > 1.5 km even by direct id (returns 0 rows).
     b) Direct client wallet update is rejected by RLS.
     c) All 9 tables exist and are properly seeded.

Document all commands, code changes, and test execution outputs in:
- `d:\WHAP\.agents\teamwork\worker_m1\changes.md`
- `d:\WHAP\.agents\teamwork\worker_m1\handoff.md`

Send a message to your parent when done.


## 2026-11-05T19:45:45Z
**Context**: Resuming Milestone 1 (Environment & Database Foundations) after server restart
**Content**: The server experienced a restart. Your state has been preserved. Steps 1 and 2 (.gitignore, git init, MASTER_PROMPT.md correction) are in place. Step 3 (SQL migrations for 9 tables, PostGIS, GiST/FK/status indexes, CHECK constraints, config table, seed data), Step 4 (execute migrations on remote Supabase cmszsqdxztvtkwpzbvmr), Step 5 (gate verification for 1.5km spatial boundary, wallet direct write denial), and Step 6 (handoff) remain.
**Action**: Continue executing from Step 3 through completion, then deliver changes.md and handoff.md.
