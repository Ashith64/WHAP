# Dispatch to teamwork_test_writer (Parallel E2E Testing Track)

You are teamwork_test_writer assigned to build the comprehensive opaque-box E2E and backend test suite for WHAP.
Your working directory is: `d:\WHAP\.agents\teamwork\test_writer_e2e\`
Your parent is: `dd373ee0-ea33-4375-bc24-2ece74f17800` (Orchestrator)

## Exclusive File Ownership
You exclusively own:
- `d:\WHAP\tests/` (including `tests/whap.test.js` and test helpers)
- `d:\WHAP\package.json` (adding test runner scripts/dependencies if needed)

## Objective
Read:
- `ORIGINAL_REQUEST.md` at `d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md`
- `PROJECT.md` at `d:\WHAP\.agents\teamwork\PROJECT.md`
- `TEST_INFRA.md` at `d:\WHAP\.agents\teamwork\TEST_INFRA.md`
- `d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md` (for RPC signatures and test specifications)

Implement the automated test suite in `tests/whap.test.js`:
1. Use native Node.js test runner (`node:test`, `node:assert`) and `@supabase/supabase-js`.
2. Implement tests for all 4 tiers per `TEST_INFRA.md`:
   - **Tier 1 (Feature Coverage)**: post_task, nearby_tasks, place_bid, accept_bid, complete_task, cancel_task, resolve_dispute, submit_review, expire_tasks.
   - **Tier 2 (Boundary & Corner Cases)**: budget limits (Rs 50-300), minimum bid (Rs 20), maximum bid (2x budget), exact 1500m geofence boundary, 3 wrong OTP attempts triggering DISPUTED.
   - **Tier 3 (Concurrency & Load)**:
     - Concurrency test: 2 simultaneous calls to `accept_bid` for the same task; asserts exactly 1 succeeds, 1 fails with concurrency error, escrow held once.
     - Load test: 100 simultaneous requests to `nearby_tasks` measuring latency percentiles (p50, p95, p99) and 0% errors.
   - **Tier 4 (Real-World Scenarios)**: Campus chore lifecycle, task cancellation with refund, dispute resolution.
3. Security break tests:
   - Worker queries task > 1.5 km by ID -> returns 0 rows.
   - Worker attempts to read OTP -> fails / returns null.
   - Direct client wallet update -> throws RLS permission error.
4. Output `TEST_READY.md` at `d:\WHAP\.agents\teamwork\TEST_READY.md` summarizing the test suite, test counts per tier, and runner command (`node --test tests/whap.test.js`).

Document your work in:
- `d:\WHAP\.agents\teamwork\test_writer_e2e\handoff.md`

Send a message to your parent when done.

## 2026-11-05T17:53:25Z
You are teamwork_test_writer assigned to the parallel E2E Testing Track for the WHAP project.
Your working directory is: d:\WHAP\.agents\teamwork\test_writer_e2e\
Your parent is: dd373ee0-ea33-4375-bc24-2ece74f17800 (Orchestrator)

Read:
- ORIGINAL_REQUEST.md at d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md
- PROJECT.md at d:\WHAP\.agents\teamwork\PROJECT.md
- TEST_INFRA.md at d:\WHAP\.agents\teamwork\TEST_INFRA.md
- DISPATCH.md at d:\WHAP\.agents\teamwork\test_writer_e2e\DISPATCH.md
- d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md (for RPC signatures and test specifications)

Implement the automated test suite in tests/whap.test.js:
1. Use native Node.js test runner (node:test, node:assert) and @supabase/supabase-js.
2. Implement tests for all 4 tiers per TEST_INFRA.md:
   - Tier 1 (Feature Coverage): post_task, nearby_tasks, place_bid, accept_bid, complete_task, cancel_task, resolve_dispute, submit_review, expire_tasks.
   - Tier 2 (Boundary & Corner Cases): budget limits (Rs 50-300), minimum bid (Rs 20), maximum bid (2x budget), exact 1500m geofence boundary, 3 wrong OTP attempts triggering DISPUTED.
   - Tier 3 (Concurrency & Load):
     - Concurrency test: 2 simultaneous calls to accept_bid for the same task; asserts exactly 1 succeeds, 1 fails with concurrency error, escrow held once.
     - Load test: 100 simultaneous requests to nearby_tasks measuring latency percentiles (p50, p95, p99) and 0% errors.
   - Tier 4 (Real-World Scenarios): Campus chore lifecycle, task cancellation with refund, dispute resolution.
3. Security break tests:
   - Worker queries task > 1.5 km by ID -> returns 0 rows.
   - Worker attempts to read OTP -> fails / returns null.
   - Direct client wallet update -> throws RLS permission error.
4. Output TEST_READY.md at d:\WHAP\.agents\teamwork\TEST_READY.md summarizing the test suite, test counts per tier, and runner command (node --test tests/whap.test.js).

Document your work in:
- d:\WHAP\.agents\teamwork\test_writer_e2e\handoff.md

Send a message to your parent when done.
