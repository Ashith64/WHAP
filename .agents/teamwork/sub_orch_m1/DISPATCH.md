# Dispatch to Sub-Orchestrator: Milestone 1

## Mission
Execute Milestone 1: Environment & Database Foundations end-to-end.
Working Directory: `d:\WHAP\.agents\teamwork\sub_orch_m1\`
Parent: `dd373ee0-ea33-4375-bc24-2ece74f17800`

## Scope & References
- Read `ORIGINAL_REQUEST.md` at `d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read `PROJECT.md` at `d:\WHAP\.agents\teamwork\PROJECT.md`
- Read `SCOPE.md` at `d:\WHAP\.agents\teamwork\sub_orch_m1\SCOPE.md`
- Read Explorer findings:
  - `d:\WHAP\.agents\teamwork\explorer_env_e2e\analysis.md` and `handoff.md`
  - `d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md` and `handoff.md`

## Milestone 1 Objectives
1. Create `d:\WHAP\.gitignore` ignoring `.env*`, `node_modules/`, `dist/`.
2. Initialize git (`git init`) and create clean initial commit without staging `.env.local` or any secrets.
3. Fix stale PDF path in `MASTER_PROMPT.md` line 3 to `docs/WHAP Implementation Plan.pdf`.
4. Push SQL migrations to remote Supabase (`cmszsqdxztvtkwpzbvmr`):
   - Enable `postgis` extension.
   - Create 9 tables: `profiles`, `wallets`, `tasks`, `bids`, `escrow_transactions`, `ledger_entries`, `reviews`, `notifications`, `config`.
   - Add CHECK constraints (e.g. `wallets.balance >= 0`, `tasks.budget BETWEEN 50 AND 300`).
   - Add spatial GiST index on `tasks.location` (geography point), foreign key indexes, and status indexes.
   - Insert default operational constants into `config` table.
   - Insert campus seed data (2 requesters, 4 workers, 1 admin, 8 tasks: 6 within 1.5km, 2 outside).
5. Configure Row Level Security (RLS) on all 9 tables:
   - Deny direct client write (INSERT/UPDATE/DELETE) on `wallets`, `ledger_entries`, `escrow_transactions`.
   - Enforce spatial isolation: workers cannot query tasks beyond 1.5 km (`ST_DWithin(tasks.location, worker_location, 1500)`), even by direct id.
   - Ensure OTP confidentiality: workers cannot read OTPs.
6. Verify gate: execute verification test demonstrating that a worker query for a task > 1.5 km returns 0 rows (even by ID), direct client wallet update is rejected by RLS, and all 9 tables are populated.

## Execution Rules
- Run Worker -> Reviewer -> Challenger -> Auditor iteration loop.
- Deliver passing gate results and handoff report to parent orchestrator.
