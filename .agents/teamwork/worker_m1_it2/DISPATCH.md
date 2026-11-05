# Dispatch to teamwork_worker (Milestone 1 Remediation - Iteration 2)

You are teamwork_worker assigned to remediate the Milestone 1 Gate failures.
Your working directory is: `d:\WHAP\.agents\teamwork\worker_m1_it2\`
Your parent is: `dd373ee0-ea33-4375-bc24-2ece74f17800` (Orchestrator)

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Mandatory Files to Read
- `ORIGINAL_REQUEST.md` at `d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md`
- `PROJECT.md` at `d:\WHAP\.agents\teamwork\PROJECT.md`
- Gate failure findings at:
  - `d:\WHAP\.agents\teamwork\reviewer_m1_1\handoff.md`
  - `d:\WHAP\.agents\teamwork\challenger_m1_1\handoff.md`
  - `d:\WHAP\.agents\teamwork\orchestrator\GATE_STATUS.md`

## Required Remediation Actions
1. **Fix Critical Defect: `public.tasks_view` Spatial Geofence Leak**:
   - Recreate `public.tasks_view` WITH `(security_invoker = true)` so that it respects Row-Level Security on `public.tasks`.
   - Update `supabase/migrations/20261105000000_m1_initial_schema.sql` (or add a migration script) to include `WITH (security_invoker = true)`.
   - Execute the SQL statement on remote Supabase (`cmszsqdxztvtkwpzbvmr`).
2. **Fix Major Defect: Assigned Worker Lockout on `tasks`**:
   - Update `tasks_select_policy` on `public.tasks` to include `OR assigned_worker_id = auth.uid()` so that assigned workers can read their tasks once `status` is no longer `'OPEN'`.
   - Execute the updated policy on remote Supabase.
3. **Execute Verification Scripts**:
   - Run `node tests/test_view_leak.js`: verify Worker 1 receives 0 rows for outside tasks on BOTH `tasks` and `tasks_view`.
   - Run `node tests/test_assigned_visibility.js`: verify assigned worker can query their assigned task on `tasks`.
   - Run `node tests/adversarial_challenge.js`: verify all 22 adversarial probes PASS.
   - Run `node scripts/verify_m1_gate.js`: verify all checks pass.
   - Run `node --test tests/whap.test.js`: verify security break tests pass.
4. **Git Commit**:
   - Commit the fixes cleanly with a clear commit message.

Write your report to:
- `d:\WHAP\.agents\teamwork\worker_m1_it2\changes.md`
- `d:\WHAP\.agents\teamwork\worker_m1_it2\handoff.md`

Send a message to your parent when done.
