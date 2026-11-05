# Handoff Report: Backend, Data Model, RLS, and Business Logic Specification

## 1. Observation
- **Direct Source Files Inspected**:
  - `d:\WHAP\docs\WHAP Implementation Plan.pdf`: Entire document (pages 1 to 8) examined via `view_file`.
    - Section 1 (Page 1): "WHAP is a hyperlocal micro-task marketplace... Rs 50 and Rs 300... Only workers within 1.5 km can see it... 4-digit OTP... escrow is released to the worker minus a platform fee... reviews stay hidden until both have submitted (double-blind)."
    - Section 2 (Page 1): "Escrow is simulated with ledger tables. No real money, no payment gateway."
    - Section 3 (Page 1): "Supabase (PostgreSQL with the PostGIS extension, Auth, Realtime)... SQL functions inside the database, each running as one transaction... Row Level Security (RLS) on every table."
    - Section 6 (Page 2-3): "Search radius: 1.5 km. Task budget: Rs 50 to Rs 300. Bid price: at least Rs 20 and at most 2 times the task budget. One bid per worker per task (a new bid updates the old one while it is pending). Platform fee: 10% of the agreed price, minimum Rs 5, taken from the worker payout. Bidding window: 3 minutes. A task expires after 30 minutes with no accepted bid. OTP: 4 digits, valid for 2 hours. After 3 wrong attempts the task becomes DISPUTED. Limits: at most 3 open tasks per requester, at most 1 active job per worker. Wallet: requesters start with a Rs 500 demo balance. A wallet balance can never go below 0."
    - Section 6 State Rules (Page 3):
      - Task: `OPEN` to `ASSIGNED` to `COMPLETED`. `OPEN` to `CANCELLED` or `EXPIRED`. `ASSIGNED` to `CANCELLED` (full refund) or `DISPUTED`. `DISPUTED` to `COMPLETED` or `CANCELLED` (admin only).
      - Bid: `PENDING` to `ACCEPTED`, `REJECTED` or `WITHDRAWN`.
      - Escrow: `HELD` to `RELEASED` or `REFUNDED`, and never reversed.
    - Section 6 Security Rules (Page 3): "Only the task's requester can read the OTP. Tasks beyond 1.5 km are never returned to a worker, even when asked for by id. Wallet and escrow tables can only be changed through the database functions, never directly from the app."
    - Section 7 Data Model (Page 3): Detailed 8 entity models (`profiles`, `wallets`, `tasks`, `bids`, `escrow_transactions`, `ledger_entries`, `reviews`, `notifications`) + categories: `XEROX_PICKUP`, `BUY_ITEMS`, `CARRY_THINGS`, `QUEUE`, `OTHER`. GiST index requirement on task location; indexes on foreign keys and status columns.
    - Section 8 Database Functions (Page 4): 9 functions enumerated: `post_task`, `nearby_tasks`, `place_bid`, `accept_bid`, `complete_task`, `cancel_task`, `resolve_dispute`, `submit_review`, `expire_tasks`.
    - Section 10 Testing Checklist (Page 6-7): 11 verification points including 2 simultaneous accepts concurrency check, 100 simultaneous requests to `nearby_tasks`, and penetration check on OTP reading & direct wallet mutations.
  - `d:\WHAP\MASTER_PROMPT.md`:
    - Lines 8-12: API keys format note (`sb_publishable_...` for frontend, `sb_secret_...` for node test script).
    - Lines 42-45: Phase 2 requirements (PostGIS, tables, GiST+FK+status indexes, CHECK constraints, RLS on every table, wallet/escrow writable only via functions, seed data: 2 requesters, 4 workers, 1 admin, 8 tasks: 6 inside 1.5 km, 2 outside. Gate: proof a worker cannot see tasks beyond 1.5 km, even by id).
    - Lines 46-50: Phase 3 requirements (Functions in order with tests in `tests/whap.test.js`, config values live in `config` table, concurrency test, 100-request load test).
  - `d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md`:
    - Lines 19-21 (R2): Reaffirms SQL migrations, seed data, PostGIS, RLS on every table, wallet/escrow writable only via functions, all 9 RPCs, config table.
    - Lines 35-39: Reaffirms acceptance criteria.

## 2. Logic Chain
1. **Source of Truth Hierarchy**:
   - `MASTER_PROMPT.md` line 3 explicitly declares `docs/WHAP Implementation Plan.pdf` as the authoritative source of truth ("If this file and the PDF conflict, the PDF wins").
   - Every business rule, entity schema, and RPC function in `analysis.md` directly reflects the exact wording and constraints from Sections 6, 7, 8, and 10 of `docs/WHAP Implementation Plan.pdf`.
2. **Schema & Integrity Design**:
   - To enforce "A wallet balance can never go below 0" at the DB level, a `CHECK (balance >= 0.00)` constraint on `wallets` is required alongside numeric/decimal types.
   - To guarantee "One bid per worker per task (a new bid updates the old one while it is pending)", a unique constraint `UNIQUE (task_id, worker_id)` on `bids` paired with `ON CONFLICT DO UPDATE` in `place_bid` is necessary.
   - To ensure fast spatial queries within 1.5 km, PostGIS GiST index on `tasks(location)` is mandatory.
3. **Security Definer & RLS Encapsulation**:
   - The security rule "Wallet and escrow tables can only be changed through the database functions, never directly from the app" necessitates that `INSERT`, `UPDATE`, and `DELETE` RLS policies for `wallets`, `ledger_entries`, and `escrow_transactions` are completely omitted or set to false for `authenticated` and `anon` roles.
   - All state modifications (locking escrow, releasing payout, refunding) must be executed inside `SECURITY DEFINER` stored procedures.
4. **Spatial Isolation Gate**:
   - The gate condition "proof a worker cannot see tasks beyond 1.5 km, even by id" requires that RLS SELECT policy on `tasks` incorporates spatial evaluation (`ST_DWithin(tasks.location, profiles.location, 1500)`) for users with role `WORKER` when task status is `OPEN`. Direct SELECT by ID will return zero rows if the distance exceeds 1500 meters.
5. **OTP Protection**:
   - The security rule "Only the task's requester can read the OTP" requires that workers cannot inspect `otp_code`. This is achieved by either masking `otp_code` in queries via a view / dedicated RPC `get_task_otp(p_task_id)` or column privilege revocation.
6. **Concurrency Safety in `accept_bid`**:
   - Plan Section 8 and 10 demand that two simultaneous accepts for the same task must result in only one succeeding.
   - Enforcing `SELECT * FROM tasks WHERE id = ... FOR UPDATE` immediately at the start of `accept_bid` guarantees serializability: the first transaction acquires the exclusive row lock, transitions task status to `ASSIGNED`, commits escrow lock and OTP; the second transaction wakes up, evaluates `task.status != 'OPEN'`, and throws an exception without altering wallet or escrow state.

## 3. Caveats
- **User Location Precision**: The specification notes that worker location comes from the device coordinates. In testing and RLS queries, worker position is referenced from `profiles.location` or parameters passed into `nearby_tasks` / `place_bid`.
- **OTP Column Exposure via PostgREST**: Direct `supabase.from('tasks').select('*')` by default returns all columns unless column privileges are revoked or a view is queried. To pass penetration break attempt ("A worker cannot read the OTP"), the implementation builder must ensure column-level grant restriction or a secured view/RPC is used.
- **Realtime Triggering**: While database functions execute atomically, client UI synchronization depends on Supabase Realtime publications on `tasks` and `bids`. Tables must be added to `supabase_realtime` publication.

## 4. Conclusion
All backend, data model, PostGIS, RLS, RPC, and test specifications have been fully extracted and formally detailed in `d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md`.
The specifications define:
- 9 exact database tables (`profiles`, `wallets`, `tasks`, `bids`, `escrow_transactions`, `ledger_entries`, `reviews`, `notifications`, `config`).
- Strict GiST, FK, and status indexes.
- Complete RLS policy rules enforcing spatial isolation, OTP confidentiality, and direct financial modification denial.
- 9 fully specified stored procedures with atomic row-locking concurrency control.
- 15 operational configuration variables in `config`.
- 10 automated test suites for `tests/whap.test.js`, including the two-accept concurrency test and the 100-request load test.

## 5. Verification Method
1. **Document Inspection**:
   - Inspect `d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md` to verify all required sections, tables, functions, and edge cases are documented.
2. **Authoritative Alignment**:
   - Compare `analysis.md` Section 1 (Data Model), Section 3 (RLS), Section 4 (RPC Functions), and Section 6 (Tests) against `d:\WHAP\docs\WHAP Implementation Plan.pdf` Sections 6, 7, 8, 10 to ensure zero deviations.
3. **Downstream Test Execution (when Builder implements Phase 2 & 3)**:
   - Run `node tests/whap.test.js` to execute the 10 verification suites against the Supabase database.
   - Verify that test output confirms:
     - 2 concurrent accepts -> 1 succeeds, 1 fails.
     - Worker querying task > 1.5 km by ID -> returns 0 rows.
     - Direct client wallet update -> throws RLS permission error.
     - 100 simultaneous requests to `nearby_tasks` succeed.
