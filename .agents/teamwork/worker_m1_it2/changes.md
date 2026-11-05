# Milestone 1 Remediation Changes (Iteration 2)

**Worker**: teamwork_worker (`worker_m1_it2`)  
**Parent**: orchestrator (`dd373ee0-ea33-4375-bc24-2ece74f17800`)  
**Timestamp**: 2026-11-05T23:30:00Z  

## Summary of Remediations
This iteration successfully remediates all findings from the Milestone 1 Gate Review (reviewer `reviewer_m1_1` and challenger `challenger_m1_1`):
1. **Critical Defect (Spatial Geofence Bypass on `public.tasks_view`)**:
   - Recreated `public.tasks_view` WITH `(security_invoker = true)` on remote Supabase PostgreSQL (`cmszsqdxztvtkwpzbvmr`).
   - Updated `supabase/migrations/20261105000000_m1_initial_schema.sql` lines 280-281 to specify `WITH (security_invoker = true)`.
   - Verified that PostgreSQL now evaluates the caller's privileges and base table RLS policies on `public.tasks`. Worker 1 now receives 0 rows for outside tasks on BOTH `tasks` and `tasks_view`.

2. **Major Defect (Assigned Worker Lockout on `public.tasks`)**:
   - Updated `tasks_select_policy` on `public.tasks` to include `OR assigned_worker_id = auth.uid()` on remote Supabase PostgreSQL.
   - Updated `supabase/migrations/20261105000000_m1_initial_schema.sql` lines 384-386.
   - Verified that assigned workers can now query their active jobs on both `tasks` and `tasks_view`, resolving the lockout bug when status is `ASSIGNED`.

3. **Adversarial Suite Adaptation & Verification**:
   - Updated `tests/adversarial_challenge.js` Probe 3.2 to verify that unassigned workers querying raw `tasks` table for an assigned task are rejected with 0 rows by RLS (`tasks_select_policy`).
   - Executed the full suite of verification scripts against remote Supabase:
     - `node tests/test_view_leak.js`: PASS (0 rows returned for outside tasks on both `tasks` and `tasks_view`; total inside tasks: 6; outside task check: false)
     - `node tests/test_assigned_visibility.js`: PASS (assigned worker receives 1 row on `tasks` and 1 row on `tasks_view`)
     - `node tests/adversarial_challenge.js`: PASS (all 22 of 22 adversarial probes PASS; verdict: APPROVE)
     - `node scripts/verify_m1_gate.js`: PASS (all gate checks pass)
     - `node --test tests/whap.test.js`: PASS (all 5 Security Break tests pass)

---

## Detailed File Modifications

### 1. `supabase/migrations/20261105000000_m1_initial_schema.sql`
- **Lines 280-281**:
  ```sql
  -- Secure View: tasks_view (masks otp_code to NULL for workers / non-requesters)
  CREATE OR REPLACE VIEW public.tasks_view
  WITH (security_invoker = true) AS
  SELECT
  ...
  ```
- **Lines 384-386**:
  ```sql
  CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT TO authenticated
    USING (
      -- 1. Requester can see their own tasks anywhere
      requester_id = auth.uid()
      OR
      -- 2. Assigned worker can see their assigned tasks anywhere
      assigned_worker_id = auth.uid()
      OR
      -- 3. Admin can see all tasks
      EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'
      )
      OR
      -- 4. Workers can see OPEN tasks ONLY if within 1500 meters of their profile location
      (
        status = 'OPEN' AND
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE profiles.id = auth.uid()
            AND profiles.location IS NOT NULL
            AND ST_DWithin(tasks.location, profiles.location, 1500)
        )
      )
    );
  ```

### 2. `scripts/apply_m1_remediation.js`
- Created dedicated migration script executing the view recreation and policy update against remote Supabase PostgreSQL, then signaling PostgREST schema reload via `NOTIFY pgrst, 'reload schema'`.

### 3. `tests/adversarial_challenge.js`
- Updated Probe 3.2 to test unassigned worker query on raw `tasks` table for an assigned task, verifying that `tasks_select_policy` restricts active assigned tasks to their assigned worker, returning 0 rows to other workers.
