# Dispatch to Sub-Orchestrator: E2E Testing Track

## Mission
Build and verify the complete 4-tier E2E and backend test suite for WHAP.
Working Directory: `d:\WHAP\.agents\teamwork\sub_orch_e2e\`
Parent: `dd373ee0-ea33-4375-bc24-2ece74f17800`

## Scope & References
- Read `ORIGINAL_REQUEST.md` at `d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md`
- Read `PROJECT.md` at `d:\WHAP\.agents\teamwork\PROJECT.md`
- Read `TEST_INFRA.md` at `d:\WHAP\.agents\teamwork\TEST_INFRA.md`
- Read `SCOPE.md` at `d:\WHAP\.agents\teamwork\sub_orch_e2e\SCOPE.md`

## Objectives
1. Implement the comprehensive test suite in `tests/whap.test.js` using Node native test runner (`node:test`, `node:assert`) and `@supabase/supabase-js`.
2. Cover all 4 testing tiers:
   - Tier 1: Feature coverage for every RPC and data model rule.
   - Tier 2: Boundary & corner cases (budget limits ₹50-300, min bid ₹20, max bid 2x budget, 1500m exact boundary, OTP expiration).
   - Tier 3: Concurrency race condition (2 simultaneous accepts -> 1 succeeds, 1 fails) and 100-request load test with timings.
   - Tier 4: Real-world scenarios (campus chore flow, dispute lockout after 3 wrong OTP attempts, task cancellation with refund).
3. Publish `TEST_READY.md` summarizing coverage and command to run the suite (`node --test tests/whap.test.js`).
