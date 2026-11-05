# Backend, Data Model, RLS, and Business Logic Specification Analysis

## Executive Summary
This document provides the authoritative backend specification for **WHAP** (Wagers Hiring Application Platform), extracted from the primary source of truth (`docs/WHAP Implementation Plan.pdf`), supplemented by `MASTER_PROMPT.md` and `ORIGINAL_REQUEST.md`.

WHAP is a zero-cost, hyperlocal micro-task marketplace operating within a strict 1.5 km geographic boundary. All business logic, transaction locking, escrow accounting, and security guarantees are enforced directly inside PostgreSQL (Supabase) via Row Level Security (RLS) and atomic, `SECURITY DEFINER` stored procedures.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Database / Extension | PostGIS Spatial Extension | Enables geographic data types (`geography(Point, 4326)`) and spatial operators (`ST_DWithin`, `ST_Distance`). | PostGIS extension creation command | Spatial types and functions available | Fails if PostGIS is unavailable | `WHAP Implementation Plan.pdf` §3, §7 |
| 2 | Data Model | Profiles Table | Stores user profile, role (`REQUESTER`, `WORKER`, `ADMIN`), geographic location, and aggregate rating metrics. | Profile records linked to `auth.users(id)` | Profile record | Check constraint fails if role invalid | `WHAP Implementation Plan.pdf` §7 |
| 3 | Data Model | Wallets Table | Holds user simulated balance; balance is strictly constrained never to drop below 0. Direct app mutations forbidden. | `user_id`, initial balance (default Rs 500 for requesters) | Wallet balance record | Direct client INSERT/UPDATE rejected by RLS; negative balance rejected by CHECK | `WHAP Implementation Plan.pdf` §6, §7 |
| 4 | Data Model | Tasks Table | Core task entity with category, budget [50, 300], PostGIS location point, status lifecycle, OTP fields, and concurrency versioning. | Task parameters | Task record | Rejects budget out of [50, 300] or invalid category/status | `WHAP Implementation Plan.pdf` §6, §7 |
| 5 | Data Model | Bids Table | Reverse bidding bids placed by workers; price must be >= Rs 20 and <= 2x task budget. One active bid per worker per task. | `task_id`, `worker_id`, `price` | Bid record | Rejects price out of range or duplicate pending bids | `WHAP Implementation Plan.pdf` §6, §7 |
| 6 | Data Model | Escrow Transactions Table | Manages locked task funds during execution. Transitions from `HELD` to `RELEASED` or `REFUNDED` (never reversed). Tracks platform fee. | `task_id`, `amount`, `platform_fee` | Escrow record | Immutable outside security functions; invalid transitions blocked | `WHAP Implementation Plan.pdf` §6, §7 |
| 7 | Data Model | Ledger Entries Table | Double-entry / audit ledger tracking every balance change (`TOPUP`, `ESCROW_LOCK`, `ESCROW_REFUND`, `PAYOUT`, `FEE`). | `wallet_id`, `type`, `amount`, `task_id` | Ledger record | Immutable append-only audit trail; RLS blocks client mutations | `WHAP Implementation Plan.pdf` §6, §7 |
| 8 | Data Model | Reviews Table | Double-blind rating (1 to 5) and comment system. Stays hidden until both sides submit or 7 days elapse. | `task_id`, `reviewer_id`, `reviewee_id`, `rating`, `comment` | Review record | Rating must be between 1 and 5; one review per participant | `WHAP Implementation Plan.pdf` §6, §7 |
| 9 | Data Model | Notifications Table | System notifications for status transitions, accepted bids, payouts, and disputes. | `user_id`, `message` | Notification record | Recipient only can read; RLS restricts access | `WHAP Implementation Plan.pdf` §7 |
| 10 | Data Model | Config Table | Key-value store maintaining system constants without hard-coding (fees, radii, timeouts). | `key`, `value`, `description` | Parameter value | Read-only for normal users; admin updates only | `MASTER_PROMPT.md` Phase 3, Plan §6 |
| 11 | RPC Function | `post_task` | Validates requester budget (Rs 50 - 300) and open task quota (max 3), creates geography point and task record. | `title`, `description`, `category`, `budget`, `lat`, `lng`, `address` | Created task object or UUID | Raises exception if budget invalid or >=3 open tasks already exist | `WHAP Implementation Plan.pdf` §8 |
| 12 | RPC Function | `nearby_tasks` | Queries open tasks within 1.5 km of given worker coordinates using `ST_DWithin`, returns sorted by distance. Masks OTP. | `lat`, `lng`, optional `radius_meters` (default 1500) | Set of open tasks with `distance_meters` | Caps search radius at 1500m; ignores tasks > 1.5 km | `WHAP Implementation Plan.pdf` §8 |
| 13 | RPC Function | `place_bid` | Validates task is OPEN, worker is within 1.5 km, worker is not requester, price is within [Rs 20, 2*budget], updates or inserts bid. | `task_id`, `price`, optional worker coordinates | Created / updated bid record | Rejects if task not open, worker > 1.5 km, self-bidding, or invalid price | `WHAP Implementation Plan.pdf` §8 |
| 14 | RPC Function | `accept_bid` | Concurrency-safe bid acceptance. Locks task, bid, and requester wallet (`FOR UPDATE`). Deducts escrow, generates 4-digit OTP, rejects competing bids. | `bid_id` | Updated task & escrow record | Fails if task already ASSIGNED, requester has insufficient balance, or bid not PENDING | `WHAP Implementation Plan.pdf` §8, §10 |
| 15 | RPC Function | `complete_task` | Worker submits 4-digit OTP. Validates OTP and 2-hour window. Releases escrow minus platform fee (10%, min Rs 5) to worker wallet. | `task_id`, `otp_code` | Payout confirmation & completed task | Wrong OTP increments attempt count; 3rd wrong attempt moves task to `DISPUTED` | `WHAP Implementation Plan.pdf` §6, §8 |
| 16 | RPC Function | `cancel_task` | Allows requester to cancel task. If OPEN, cancels without fee. If ASSIGNED, provides full escrow refund to requester wallet. | `task_id` | Cancellation confirmation | Rejects cancellation if task is COMPLETED, DISPUTED, or EXPIRED | `WHAP Implementation Plan.pdf` §6, §8 |
| 17 | RPC Function | `resolve_dispute` | Admin-only function to resolve a `DISPUTED` task: either refunds requester in full or releases payout to worker minus fee. | `task_id`, `decision` (`REFUND_REQUESTER` or `PAY_WORKER`) | Resolution status | Fails if caller is not ADMIN or task is not in DISPUTED status | `WHAP Implementation Plan.pdf` §6, §8 |
| 18 | RPC Function | `submit_review` | Participant submits rating (1-5) and comment. If counterpart review exists, both become visible and rating aggregates are updated. | `task_id`, `rating`, `comment` | Review record and visibility status | Rejects duplicate reviews, ratings outside 1-5, or non-participant submissions | `WHAP Implementation Plan.pdf` §6, §8 |
| 19 | RPC Function | `expire_tasks` | Marks OPEN tasks older than 30 minutes as EXPIRED, withdraws pending bids, auto-reveals reviews older than 7 days. | None (invoked periodically or on read) | Count of expired tasks and revealed reviews | Transaction-safe batch execution | `WHAP Implementation Plan.pdf` §6, §8 |
| 20 | Security / RLS | Spatial Security Gate | RLS policy or view ensuring worker cannot see tasks beyond 1.5 km, even when queried directly by UUID. | User role = `WORKER`, task ID / coordinates | 0 rows returned if > 1500m | Access denied / silent row exclusion | `MASTER_PROMPT.md` Phase 2, Plan §6 |
| 21 | Security / RLS | OTP Protection Barrier | Guarantees that only the task's requester can read the plaintext `otp_code`. Workers and anon users cannot read OTP. | Any SELECT query on tasks | `otp_code` masked or restricted to requester | Worker querying `otp_code` receives NULL or error | `WHAP Implementation Plan.pdf` §6, §10 |
| 22 | Security / RLS | Financial Integrity Protection | Direct client modifications (`INSERT`, `UPDATE`, `DELETE`) on `wallets`, `ledger_entries`, and `escrow_transactions` are denied via RLS. | Client SQL mutations | Error: RLS policy violation | Direct balance manipulation prevented | `WHAP Implementation Plan.pdf` §6, §10 |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `accept_bid` | Two concurrent `accept_bid` calls for different bids on the same OPEN task. | Only the first transaction acquiring the `FOR UPDATE` lock succeeds. The second transaction observes `status != 'OPEN'` and throws an exception ("Task is no longer open"). No double escrow lock or inconsistent state. |
| 2 | `accept_bid` | Requester wallet has Rs 120 balance; accepted bid is Rs 150. | Transaction aborts before state changes with exception ("Insufficient wallet balance"). Task remains OPEN. Escrow transaction is NOT created. |
| 3 | `complete_task` | Worker enters incorrect OTP on attempt 1 and attempt 2. | Error returned ("Invalid OTP. Attempt 1/3", "Invalid OTP. Attempt 2/3"). `otp_attempts` is incremented. Escrow remains HELD. Task remains ASSIGNED. |
| 4 | `complete_task` | Worker enters incorrect OTP on attempt 3. | Error returned ("Invalid OTP. Task marked as DISPUTED"). Task status transitions to `DISPUTED`. Escrow remains locked. No payout is issued. Requires admin dispute resolution. |
| 5 | `complete_task` | Worker submits correct OTP after 2 hours (`now() > otp_expiry`). | Error returned ("OTP has expired"). Task cannot be completed normally; escrow remains safe until dispute or cancellation handling. |
| 6 | `place_bid` | Worker submits bid with price < Rs 20 (e.g., Rs 10). | Exception raised ("Bid price must be at least Rs 20"). Bid rejected. |
| 7 | `place_bid` | Task budget is Rs 100; worker submits bid of Rs 250 (exceeding 2x budget = Rs 200). | Exception raised ("Bid price cannot exceed 2x task budget"). Bid rejected. |
| 8 | `place_bid` | Worker located at distance 1550m (> 1.5 km) attempts to place bid. | Spatial validation (`ST_DWithin`) fails. Exception raised ("Worker is beyond the 1.5 km task boundary"). |
| 9 | `place_bid` | Requester attempts to bid on their own task (`auth.uid() = requester_id`). | Exception raised ("Requesters cannot bid on their own tasks"). |
| 10 | `place_bid` | Worker with an existing PENDING bid submits a new price for the same task. | Existing bid row is updated with new price and timestamp (upsert behavior). No duplicate bid rows created. |
| 11 | `post_task` | Requester currently has 3 OPEN tasks and attempts to post a 4th. | Exception raised ("Maximum limit of 3 open tasks reached"). Task creation rejected. |
| 12 | `cancel_task` | Requester cancels task while in `ASSIGNED` status with Rs 200 in escrow. | Task status transitions to `CANCELLED`. Rs 200 is refunded to requester wallet. `ESCROW_REFUND` ledger entry written. Escrow marked `REFUNDED`. Worker notified. |
| 13 | `submit_review` | Requester submits 5-star review, but worker has not yet reviewed. | Review inserted with `visible = false`. Neither party's profile rating is altered yet. Worker cannot view requester's review or rating. |
| 14 | `submit_review` | Worker submits review 4 days later (completing double-blind pairing). | Worker review inserted. Both reviews updated to `visible = true`. Both requester and worker profile `rating_average` and `rating_count` are atomically recomputed. |
| 15 | `submit_review` | Requester submitted review, worker never reviews, 7 days pass, `expire_tasks` runs. | Review auto-revealed (`visible = true`). Profile rating updated for worker. |
| 16 | Spatial Gate Query | Worker queries `SELECT * FROM tasks WHERE id = '<task_outside_1_5km>'`. | RLS policy denies row retrieval; query returns 0 rows, preventing direct ID probing beyond 1.5 km. |
| 17 | Penetration Probe | Authenticated client executes `UPDATE wallets SET balance = 999999 WHERE user_id = auth.uid()`. | RLS policy violation error returned. No rows updated. |
| 18 | Penetration Probe | Worker executes `SELECT otp_code FROM tasks WHERE id = '<assigned_task>'`. | Query returns `NULL` or error depending on security mechanism; worker is prevented from reading OTP before requester provides it in person. |

---

## Detailed Architectural & Technical Specifications

### 1. Database Schema Specification

#### Extensions
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### Enums and Domain Types
```sql
-- Role Enum
-- 'REQUESTER', 'WORKER', 'ADMIN'

-- Task Status Enum
-- 'OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'

-- Task Category Enum
-- 'XEROX_PICKUP', 'BUY_ITEMS', 'CARRY_THINGS', 'QUEUE', 'OTHER'

-- Bid Status Enum
-- 'PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'

-- Escrow Status Enum
-- 'HELD', 'RELEASED', 'REFUNDED'

-- Ledger Entry Type Enum
-- 'TOPUP', 'ESCROW_LOCK', 'ESCROW_REFUND', 'PAYOUT', 'FEE'
```

#### Tables Specification

##### 1. `profiles`
- `id`: `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- `name`: `TEXT NOT NULL`
- `role`: `TEXT NOT NULL CHECK (role IN ('REQUESTER', 'WORKER', 'ADMIN'))`
- `location`: `GEOGRAPHY(Point, 4326) NULL`
- `rating_average`: `NUMERIC(3, 2) DEFAULT 0.00 CHECK (rating_average >= 0.00 AND rating_average <= 5.00)`
- `rating_count`: `INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

##### 2. `wallets`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE`
- `balance`: `NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

##### 3. `tasks`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `requester_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `title`: `TEXT NOT NULL`
- `description`: `TEXT`
- `category`: `TEXT NOT NULL CHECK (category IN ('XEROX_PICKUP', 'BUY_ITEMS', 'CARRY_THINGS', 'QUEUE', 'OTHER'))`
- `budget`: `NUMERIC(10, 2) NOT NULL CHECK (budget >= 50.00 AND budget <= 300.00)`
- `location`: `GEOGRAPHY(Point, 4326) NOT NULL`
- `address`: `TEXT`
- `status`: `TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'))`
- `assigned_worker_id`: `UUID NULL REFERENCES profiles(id) ON DELETE SET NULL`
- `agreed_price`: `NUMERIC(10, 2) NULL CHECK (agreed_price IS NULL OR agreed_price >= 20.00)`
- `otp_code`: `VARCHAR(4) NULL`
- `otp_attempts`: `INTEGER NOT NULL DEFAULT 0 CHECK (otp_attempts >= 0)`
- `otp_expiry`: `TIMESTAMPTZ NULL`
- `version`: `INTEGER NOT NULL DEFAULT 1`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `completed_at`: `TIMESTAMPTZ NULL`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

##### 4. `bids`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id`: `UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
- `worker_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `price`: `NUMERIC(10, 2) NOT NULL CHECK (price >= 20.00)`
- `status`: `TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'))`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- *Constraint*: `UNIQUE(task_id, worker_id)` (ensures one active bid per worker per task; new bids update the existing pending bid)

##### 5. `escrow_transactions`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id`: `UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
- `amount`: `NUMERIC(10, 2) NOT NULL CHECK (amount > 0.00)`
- `platform_fee`: `NUMERIC(10, 2) NOT NULL CHECK (platform_fee >= 0.00)`
- `status`: `TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'RELEASED', 'REFUNDED'))`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- `released_at`: `TIMESTAMPTZ NULL`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

##### 6. `ledger_entries`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `wallet_id`: `UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE`
- `type`: `TEXT NOT NULL CHECK (type IN ('TOPUP', 'ESCROW_LOCK', 'ESCROW_REFUND', 'PAYOUT', 'FEE'))`
- `amount`: `NUMERIC(10, 2) NOT NULL`
- `task_id`: `UUID NULL REFERENCES tasks(id) ON DELETE SET NULL`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

##### 7. `reviews`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `task_id`: `UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE`
- `reviewer_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `reviewee_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `rating`: `INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5)`
- `comment`: `TEXT`
- `visible`: `BOOLEAN NOT NULL DEFAULT false`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`
- *Constraint*: `UNIQUE(task_id, reviewer_id)` (one review per user per task)

##### 8. `notifications`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
- `message`: `TEXT NOT NULL`
- `read`: `BOOLEAN NOT NULL DEFAULT false`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

##### 9. `config`
- `key`: `TEXT PRIMARY KEY`
- `value`: `TEXT NOT NULL`
- `description`: `TEXT`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())`

---

### 2. Indexes Specification

To guarantee spatial query performance, foreign key join integrity, and rapid status filtering:

```sql
-- Spatial GiST Indexes
CREATE INDEX idx_tasks_location ON tasks USING GIST (location);
CREATE INDEX idx_profiles_location ON profiles USING GIST (location);

-- Foreign Key Indexes
CREATE INDEX idx_tasks_requester_id ON tasks(requester_id);
CREATE INDEX idx_tasks_assigned_worker_id ON tasks(assigned_worker_id);
CREATE INDEX idx_bids_task_id ON bids(task_id);
CREATE INDEX idx_bids_worker_id ON bids(worker_id);
CREATE INDEX idx_escrow_task_id ON escrow_transactions(task_id);
CREATE INDEX idx_ledger_wallet_id ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_task_id ON ledger_entries(task_id);
CREATE INDEX idx_reviews_task_id ON reviews(task_id);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Status Column Indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_bids_status ON bids(status);
CREATE INDEX idx_escrow_status ON escrow_transactions(status);
```

---

### 3. Row Level Security (RLS) Policy Specifications

Supabase mandates RLS enabled on all tables:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
```

#### Detailed Policy Rules

1. **`profiles`**:
   - `SELECT`: Allowed for all authenticated users (`auth.role() = 'authenticated'`).
   - `INSERT`: Allowed for `auth.uid() = id`.
   - `UPDATE`: Allowed for `auth.uid() = id` (or admin).
   - `DELETE`: Disallowed.

2. **`wallets` (Direct Manipulation Protection)**:
   - `SELECT`: Allowed ONLY for the wallet owner: `auth.uid() = user_id`.
   - `INSERT`, `UPDATE`, `DELETE`: **FORBIDDEN** for all client roles (`authenticated`, `anon`). No policy granted for write operations. Mutations occur strictly via `SECURITY DEFINER` RPC functions (`accept_bid`, `complete_task`, `cancel_task`, `resolve_dispute`).

3. **`ledger_entries`**:
   - `SELECT`: Allowed ONLY for entries belonging to the user's wallet:
     `wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid())`.
   - `INSERT`, `UPDATE`, `DELETE`: **FORBIDDEN** for all client roles.

4. **`escrow_transactions`**:
   - `SELECT`: Allowed ONLY for task participants:
     `task_id IN (SELECT id FROM tasks WHERE requester_id = auth.uid() OR assigned_worker_id = auth.uid())` OR user is `ADMIN`.
   - `INSERT`, `UPDATE`, `DELETE`: **FORBIDDEN** for all client roles.

5. **`tasks` (Spatial Isolation & OTP Protection)**:
   - `SELECT`:
     - Requesters can see their own tasks: `requester_id = auth.uid()`.
     - Assigned workers can see their assigned tasks: `assigned_worker_id = auth.uid()`.
     - Workers can see tasks if `status = 'OPEN'` AND distance between task location and worker's profile location is `<= 1500 meters`:
       ```sql
       (status = 'OPEN' AND EXISTS (
         SELECT 1 FROM profiles 
         WHERE profiles.id = auth.uid() 
           AND profiles.location IS NOT NULL
           AND ST_DWithin(tasks.location, profiles.location, 1500)
       ))
       ```
     - Admins can see all tasks.
   - **OTP Protection Architecture**:
     - *Requirement*: "Only the task's requester can read the OTP." "A worker cannot read the OTP."
     - *Implementation options*:
       1. Column privileges: `REVOKE SELECT (otp_code) ON tasks FROM authenticated; GRANT SELECT (otp_code) ON tasks TO authenticated;` paired with a secure function / view or:
       2. Dedicated security definer function `get_task_otp(p_task_id)` which returns `otp_code` IF and ONLY IF `tasks.requester_id = auth.uid()`. The column `otp_code` is revoked from public/authenticated direct SELECT, or hidden behind a view `tasks_view` where `otp_code = CASE WHEN requester_id = auth.uid() THEN otp_code ELSE NULL END`.
       3. In frontend clients, `tasks_view` or `get_task_otp` guarantees that any direct SELECT query by a worker receives `NULL`.
   - `INSERT`: Restricted to `requester_id = auth.uid()` (preferable via `post_task` RPC).
   - `UPDATE`: Restricted (preferable via RPCs). Direct status tampering blocked.

6. **`bids`**:
   - `SELECT`:
     - Worker can view their own bids: `worker_id = auth.uid()`.
     - Requester can view bids on their tasks:
       `task_id IN (SELECT id FROM tasks WHERE requester_id = auth.uid())`.
   - `INSERT`: Only via `place_bid()` RPC (or `worker_id = auth.uid()`).
   - `UPDATE`, `DELETE`: Only via RPCs.

7. **`reviews` (Double-Blind Mechanism)**:
   - `SELECT`:
     - If `visible = true`: Visible to all authenticated users.
     - If `visible = false`: Visible ONLY to the reviewer: `reviewer_id = auth.uid()`. The reviewee CANNOT see the review until both parties submit or 7 days elapse.
   - `INSERT`: Via `submit_review()` RPC.
   - `UPDATE`, `DELETE`: Disallowed.

8. **`notifications`**:
   - `SELECT`: `user_id = auth.uid()`.
   - `UPDATE`: `user_id = auth.uid()` (to set `read = true`).

9. **`config`**:
   - `SELECT`: Publicly accessible to authenticated and anon users.
   - `INSERT`, `UPDATE`, `DELETE`: Restricted to `ADMIN` role.

---

### 4. RPC Stored Procedures & Business Logic

All functions run as single atomic transactions with `SECURITY DEFINER` privileges.

#### 1. `post_task`
```sql
CREATE OR REPLACE FUNCTION post_task(
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_budget NUMERIC,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_address TEXT
) RETURNS tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_open_count INT;
  v_task tasks;
  v_min_budget NUMERIC := 50.00;
  v_max_budget NUMERIC := 300.00;
  v_max_open INT := 3;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Load from config if available
  SELECT COALESCE((SELECT value::numeric FROM config WHERE key = 'min_task_budget'), 50.00) INTO v_min_budget;
  SELECT COALESCE((SELECT value::numeric FROM config WHERE key = 'max_task_budget'), 300.00) INTO v_max_budget;
  SELECT COALESCE((SELECT value::int FROM config WHERE key = 'max_open_tasks_per_requester'), 3) INTO v_max_open;

  IF p_budget < v_min_budget OR p_budget > v_max_budget THEN
    RAISE EXCEPTION 'Task budget must be between Rs % and Rs %', v_min_budget, v_max_budget;
  END IF;

  IF p_category NOT IN ('XEROX_PICKUP', 'BUY_ITEMS', 'CARRY_THINGS', 'QUEUE', 'OTHER') THEN
    RAISE EXCEPTION 'Invalid category: %', p_category;
  END IF;

  SELECT COUNT(*) INTO v_open_count
  FROM tasks
  WHERE requester_id = v_uid AND status = 'OPEN';

  IF v_open_count >= v_max_open THEN
    RAISE EXCEPTION 'Requester has reached the limit of % open tasks', v_max_open;
  END IF;

  INSERT INTO tasks (
    requester_id,
    title,
    description,
    category,
    budget,
    location,
    address,
    status
  ) VALUES (
    v_uid,
    p_title,
    p_description,
    p_category,
    p_budget,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    p_address,
    'OPEN'
  ) RETURNING * INTO v_task;

  RETURN v_task;
END;
$$;
```

#### 2. `nearby_tasks`
```sql
CREATE OR REPLACE FUNCTION nearby_tasks(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION DEFAULT 1500
) RETURNS TABLE (
  id UUID,
  requester_id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  budget NUMERIC,
  address TEXT,
  distance_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_worker_point GEOGRAPHY;
  v_max_radius DOUBLE PRECISION := 1500.0;
BEGIN
  -- Strict ceiling of 1500 meters
  SELECT COALESCE((SELECT value::double precision FROM config WHERE key = 'search_radius_meters'), 1500.0) INTO v_max_radius;
  IF p_radius_meters > v_max_radius THEN
    p_radius_meters := v_max_radius;
  END IF;

  v_worker_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    t.id,
    t.requester_id,
    t.title,
    t.description,
    t.category,
    t.budget,
    t.address,
    ROUND(ST_Distance(t.location, v_worker_point)::numeric, 2)::double precision AS distance_meters,
    t.created_at
  FROM tasks t
  WHERE t.status = 'OPEN'
    AND ST_DWithin(t.location, v_worker_point, p_radius_meters)
  ORDER BY distance_meters ASC;
END;
$$;
```

#### 3. `place_bid`
```sql
CREATE OR REPLACE FUNCTION place_bid(
  p_task_id UUID,
  p_price NUMERIC,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL
) RETURNS bids
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task tasks;
  v_worker_loc GEOGRAPHY;
  v_bid bids;
  v_min_bid NUMERIC := 20.00;
  v_max_ratio NUMERIC := 2.0;
  v_radius DOUBLE PRECISION := 1500.0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status != 'OPEN' THEN
    RAISE EXCEPTION 'Task is not open for bidding';
  END IF;

  IF v_task.requester_id = v_uid THEN
    RAISE EXCEPTION 'Requesters cannot bid on their own tasks';
  END IF;

  -- Verify distance (either from supplied coords or profile location)
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_worker_loc := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  ELSE
    SELECT location INTO v_worker_loc FROM profiles WHERE id = v_uid;
  END IF;

  SELECT COALESCE((SELECT value::double precision FROM config WHERE key = 'search_radius_meters'), 1500.0) INTO v_radius;
  IF v_worker_loc IS NULL OR NOT ST_DWithin(v_task.location, v_worker_loc, v_radius) THEN
    RAISE EXCEPTION 'Worker is outside the 1.5 km task boundary';
  END IF;

  SELECT COALESCE((SELECT value::numeric FROM config WHERE key = 'min_bid_price'), 20.00) INTO v_min_bid;
  SELECT COALESCE((SELECT value::numeric FROM config WHERE key = 'max_bid_ratio'), 2.0) INTO v_max_ratio;

  IF p_price < v_min_bid THEN
    RAISE EXCEPTION 'Bid price must be at least Rs %', v_min_bid;
  END IF;

  IF p_price > (v_task.budget * v_max_ratio) THEN
    RAISE EXCEPTION 'Bid price cannot exceed 2x task budget (max Rs %)', (v_task.budget * v_max_ratio);
  END IF;

  -- Upsert: one bid per worker per task
  INSERT INTO bids (task_id, worker_id, price, status)
  VALUES (p_task_id, v_uid, p_price, 'PENDING')
  ON CONFLICT (task_id, worker_id)
  DO UPDATE SET price = EXCLUDED.price, status = 'PENDING', updated_at = now()
  RETURNING * INTO v_bid;

  RETURN v_bid;
END;
$$;
```

#### 4. `accept_bid` (Concurrency-Safe Row Locking & Escrow Deduction)
```sql
CREATE OR REPLACE FUNCTION accept_bid(
  p_bid_id UUID
) RETURNS tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_bid bids;
  v_task tasks;
  v_requester_wallet wallets;
  v_platform_fee NUMERIC;
  v_fee_pct NUMERIC := 0.10;
  v_min_fee NUMERIC := 5.00;
  v_otp VARCHAR(4);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Lock bid row
  SELECT * INTO v_bid FROM bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;

  IF v_bid.status != 'PENDING' THEN
    RAISE EXCEPTION 'Bid is not in PENDING status';
  END IF;

  -- 2. Lock task row
  SELECT * INTO v_task FROM tasks WHERE id = v_bid.task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.requester_id != v_uid THEN
    RAISE EXCEPTION 'Only the task requester can accept bids';
  END IF;

  IF v_task.status != 'OPEN' THEN
    RAISE EXCEPTION 'Task is no longer open (current status: %)', v_task.status;
  END IF;

  -- 3. Lock requester wallet row
  SELECT * INTO v_requester_wallet FROM wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requester wallet not found';
  END IF;

  IF v_requester_wallet.balance < v_bid.price THEN
    RAISE EXCEPTION 'Insufficient wallet balance: balance is Rs %, bid requires Rs %', v_requester_wallet.balance, v_bid.price;
  END IF;

  -- Calculate platform fee
  SELECT COALESCE((SELECT value::numeric FROM config WHERE key = 'platform_fee_percent'), 0.10) INTO v_fee_pct;
  SELECT COALESCE((SELECT value::numeric FROM config WHERE key = 'min_platform_fee'), 5.00) INTO v_min_fee;
  v_platform_fee := GREATEST(v_min_fee, ROUND(v_bid.price * v_fee_pct, 2));

  -- 4. Deduct wallet balance
  UPDATE wallets
  SET balance = balance - v_bid.price,
      updated_at = now()
  WHERE id = v_requester_wallet.id;

  -- 5. Record ledger entry
  INSERT INTO ledger_entries (
    wallet_id,
    type,
    amount,
    task_id
  ) VALUES (
    v_requester_wallet.id,
    'ESCROW_LOCK',
    v_bid.price,
    v_task.id
  );

  -- 6. Insert escrow transaction
  INSERT INTO escrow_transactions (
    task_id,
    amount,
    platform_fee,
    status
  ) VALUES (
    v_task.id,
    v_bid.price,
    v_platform_fee,
    'HELD'
  );

  -- 7. Generate 4-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

  -- 8. Update task to ASSIGNED
  UPDATE tasks
  SET status = 'ASSIGNED',
      assigned_worker_id = v_bid.worker_id,
      agreed_price = v_bid.price,
      otp_code = v_otp,
      otp_attempts = 0,
      otp_expiry = now() + INTERVAL '2 hours',
      version = version + 1,
      updated_at = now()
  WHERE id = v_task.id
  RETURNING * INTO v_task;

  -- 9. Update bids: accept selected, reject all others
  UPDATE bids SET status = 'ACCEPTED', updated_at = now() WHERE id = v_bid.id;
  UPDATE bids SET status = 'REJECTED', updated_at = now() WHERE task_id = v_task.id AND id != v_bid.id AND status = 'PENDING';

  -- 10. Notify worker
  INSERT INTO notifications (user_id, message)
  VALUES (v_bid.worker_id, 'Your bid of Rs ' || v_bid.price || ' for "' || v_task.title || '" has been accepted!');

  RETURN v_task;
END;
$$;
```

#### 5. `complete_task` (OTP Verification, Escrow Release & Payout)
```sql
CREATE OR REPLACE FUNCTION complete_task(
  p_task_id UUID,
  p_otp_code VARCHAR(4)
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task tasks;
  v_escrow escrow_transactions;
  v_worker_wallet wallets;
  v_payout NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status != 'ASSIGNED' THEN
    RAISE EXCEPTION 'Task cannot be completed in status %', v_task.status;
  END IF;

  IF v_task.assigned_worker_id != v_uid THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned worker can submit completion OTP';
  END IF;

  IF now() > v_task.otp_expiry THEN
    RAISE EXCEPTION 'OTP has expired';
  END IF;

  -- Check OTP
  IF v_task.otp_code != p_otp_code THEN
    IF v_task.otp_attempts + 1 >= 3 THEN
      UPDATE tasks
      SET status = 'DISPUTED',
          otp_attempts = otp_attempts + 1,
          updated_at = now()
      WHERE id = p_task_id;

      INSERT INTO notifications (user_id, message)
      VALUES (v_task.requester_id, 'Task "' || v_task.title || '" has entered DISPUTED status due to 3 failed OTP attempts.');
      
      INSERT INTO notifications (user_id, message)
      VALUES (v_task.assigned_worker_id, 'Task "' || v_task.title || '" has entered DISPUTED status due to 3 failed OTP attempts.');

      RAISE EXCEPTION 'Invalid OTP. 3 failed attempts exceeded. Task is now DISPUTED';
    ELSE
      UPDATE tasks
      SET otp_attempts = otp_attempts + 1,
          updated_at = now()
      WHERE id = p_task_id;

      RAISE EXCEPTION 'Invalid OTP. Attempt % of 3', v_task.otp_attempts + 1;
    END IF;
  END IF;

  -- Correct OTP: Release escrow
  SELECT * INTO v_escrow FROM escrow_transactions WHERE task_id = p_task_id AND status = 'HELD' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active escrow transaction not found';
  END IF;

  v_payout := v_escrow.amount - v_escrow.platform_fee;

  -- Lock and credit worker wallet
  SELECT * INTO v_worker_wallet FROM wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance) VALUES (v_uid, 0.00) RETURNING * INTO v_worker_wallet;
  END IF;

  UPDATE wallets
  SET balance = balance + v_payout,
      updated_at = now()
  WHERE id = v_worker_wallet.id;

  -- Ledger entries
  INSERT INTO ledger_entries (wallet_id, type, amount, task_id)
  VALUES (v_worker_wallet.id, 'PAYOUT', v_payout, p_task_id);

  INSERT INTO ledger_entries (wallet_id, type, amount, task_id)
  VALUES (v_worker_wallet.id, 'FEE', v_escrow.platform_fee, p_task_id);

  -- Update escrow
  UPDATE escrow_transactions
  SET status = 'RELEASED',
      released_at = now(),
      updated_at = now()
  WHERE id = v_escrow.id;

  -- Complete task
  UPDATE tasks
  SET status = 'COMPLETED',
      completed_at = now(),
      version = version + 1,
      updated_at = now()
  WHERE id = p_task_id;

  -- Notifications
  INSERT INTO notifications (user_id, message)
  VALUES (v_task.requester_id, 'Task "' || v_task.title || '" has been completed. Escrow released.');

  INSERT INTO notifications (user_id, message)
  VALUES (v_uid, 'Task "' || v_task.title || '" completed! Rs ' || v_payout || ' credited to your wallet (Fee: Rs ' || v_escrow.platform_fee || ').');

  RETURN jsonb_build_object(
    'status', 'COMPLETED',
    'payout', v_payout,
    'fee', v_escrow.platform_fee
  );
END;
$$;
```

#### 6. `cancel_task` (OPEN vs ASSIGNED Full Refund)
```sql
CREATE OR REPLACE FUNCTION cancel_task(
  p_task_id UUID
) RETURNS tasks
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task tasks;
  v_escrow escrow_transactions;
  v_requester_wallet wallets;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.requester_id != v_uid THEN
    RAISE EXCEPTION 'Only the task requester can cancel this task';
  END IF;

  IF v_task.status = 'OPEN' THEN
    UPDATE tasks SET status = 'CANCELLED', updated_at = now() WHERE id = p_task_id RETURNING * INTO v_task;
    UPDATE bids SET status = 'WITHDRAWN', updated_at = now() WHERE task_id = p_task_id AND status = 'PENDING';
    RETURN v_task;

  ELSIF v_task.status = 'ASSIGNED' THEN
    -- Full escrow refund
    SELECT * INTO v_escrow FROM escrow_transactions WHERE task_id = p_task_id AND status = 'HELD' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Held escrow not found';
    END IF;

    SELECT * INTO v_requester_wallet FROM wallets WHERE user_id = v_uid FOR UPDATE;
    UPDATE wallets SET balance = balance + v_escrow.amount, updated_at = now() WHERE id = v_requester_wallet.id;

    INSERT INTO ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_requester_wallet.id, 'ESCROW_REFUND', v_escrow.amount, p_task_id);

    UPDATE escrow_transactions SET status = 'REFUNDED', released_at = now(), updated_at = now() WHERE id = v_escrow.id;

    UPDATE tasks SET status = 'CANCELLED', updated_at = now() WHERE id = p_task_id RETURNING * INTO v_task;

    INSERT INTO notifications (user_id, message)
    VALUES (v_task.assigned_worker_id, 'Task "' || v_task.title || '" was cancelled by requester. Full refund issued.');

    RETURN v_task;
  ELSE
    RAISE EXCEPTION 'Task cannot be cancelled in status: %', v_task.status;
  END IF;
END;
$$;
```

#### 7. `resolve_dispute` (Admin Resolution)
```sql
CREATE OR REPLACE FUNCTION resolve_dispute(
  p_task_id UUID,
  p_decision TEXT -- 'REFUND_REQUESTER' or 'PAY_WORKER'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_task tasks;
  v_escrow escrow_transactions;
  v_wallet wallets;
  v_payout NUMERIC;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role != 'ADMIN' THEN
    RAISE EXCEPTION 'Unauthorized: Administrator access required';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF v_task.status != 'DISPUTED' THEN
    RAISE EXCEPTION 'Task is not in DISPUTED status';
  END IF;

  SELECT * INTO v_escrow FROM escrow_transactions WHERE task_id = p_task_id AND status = 'HELD' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Held escrow transaction not found';
  END IF;

  IF p_decision = 'REFUND_REQUESTER' THEN
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_task.requester_id FOR UPDATE;
    UPDATE wallets SET balance = balance + v_escrow.amount, updated_at = now() WHERE id = v_wallet.id;

    INSERT INTO ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_wallet.id, 'ESCROW_REFUND', v_escrow.amount, p_task_id);

    UPDATE escrow_transactions SET status = 'REFUNDED', released_at = now(), updated_at = now() WHERE id = v_escrow.id;
    UPDATE tasks SET status = 'CANCELLED', updated_at = now() WHERE id = p_task_id;

    INSERT INTO notifications (user_id, message)
    VALUES (v_task.requester_id, 'Dispute resolved: Rs ' || v_escrow.amount || ' refunded to your wallet.');

    INSERT INTO notifications (user_id, message)
    VALUES (v_task.assigned_worker_id, 'Dispute resolved in favor of requester.');

    RETURN jsonb_build_object('decision', p_decision, 'status', 'REFUNDED');

  ELSIF p_decision = 'PAY_WORKER' THEN
    v_payout := v_escrow.amount - v_escrow.platform_fee;
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_task.assigned_worker_id FOR UPDATE;
    UPDATE wallets SET balance = balance + v_payout, updated_at = now() WHERE id = v_wallet.id;

    INSERT INTO ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_wallet.id, 'PAYOUT', v_payout, p_task_id);

    INSERT INTO ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_wallet.id, 'FEE', v_escrow.platform_fee, p_task_id);

    UPDATE escrow_transactions SET status = 'RELEASED', released_at = now(), updated_at = now() WHERE id = v_escrow.id;
    UPDATE tasks SET status = 'COMPLETED', completed_at = now(), updated_at = now() WHERE id = p_task_id;

    INSERT INTO notifications (user_id, message)
    VALUES (v_task.assigned_worker_id, 'Dispute resolved: Rs ' || v_payout || ' payout released to your wallet.');

    INSERT INTO notifications (user_id, message)
    VALUES (v_task.requester_id, 'Dispute resolved in favor of worker.');

    RETURN jsonb_build_object('decision', p_decision, 'status', 'RELEASED', 'payout', v_payout);
  ELSE
    RAISE EXCEPTION 'Invalid decision: %', p_decision;
  END IF;
END;
$$;
```

#### 8. `submit_review` (Double-Blind Mechanics)
```sql
CREATE OR REPLACE FUNCTION submit_review(
  p_task_id UUID,
  p_rating INT,
  p_comment TEXT
) RETURNS reviews
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task tasks;
  v_reviewee_id UUID;
  v_review reviews;
  v_counterpart reviews;
  v_both_submitted BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be an integer between 1 and 5';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status != 'COMPLETED' THEN
    RAISE EXCEPTION 'Reviews can only be submitted after task completion';
  END IF;

  IF v_uid = v_task.requester_id THEN
    v_reviewee_id := v_task.assigned_worker_id;
  ELSIF v_uid = v_task.assigned_worker_id THEN
    v_reviewee_id := v_task.requester_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized: only task participants can review';
  END IF;

  -- Check if already reviewed
  IF EXISTS (SELECT 1 FROM reviews WHERE task_id = p_task_id AND reviewer_id = v_uid) THEN
    RAISE EXCEPTION 'You have already submitted a review for this task';
  END IF;

  -- Check if counterpart review exists
  SELECT * INTO v_counterpart FROM reviews WHERE task_id = p_task_id AND reviewer_id = v_reviewee_id;
  IF FOUND THEN
    v_both_submitted := true;
  END IF;

  -- Insert this review
  INSERT INTO reviews (
    task_id,
    reviewer_id,
    reviewee_id,
    rating,
    comment,
    visible
  ) VALUES (
    p_task_id,
    v_uid,
    v_reviewee_id,
    p_rating,
    p_comment,
    v_both_submitted
  ) RETURNING * INTO v_review;

  -- If both submitted, reveal counterpart review and recompute ratings
  IF v_both_submitted THEN
    UPDATE reviews SET visible = true WHERE task_id = p_task_id;

    -- Update reviewee profile rating
    UPDATE profiles
    SET rating_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = v_reviewee_id AND visible = true),
        rating_average = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE reviewee_id = v_reviewee_id AND visible = true)
    WHERE id = v_reviewee_id;

    -- Update reviewer profile rating
    UPDATE profiles
    SET rating_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = v_uid AND visible = true),
        rating_average = (SELECT ROUND(AVG(rating)::numeric, 2) FROM reviews WHERE reviewee_id = v_uid AND visible = true)
    WHERE id = v_uid;
  END IF;

  RETURN v_review;
END;
$$;
```

#### 9. `expire_tasks` (Expiration & 7-Day Auto-Reveal)
```sql
CREATE OR REPLACE FUNCTION expire_tasks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expired_count INT := 0;
  v_revealed_count INT := 0;
  v_exp_minutes INT := 30;
  v_reveal_days INT := 7;
BEGIN
  SELECT COALESCE((SELECT value::int FROM config WHERE key = 'task_expiration_minutes'), 30) INTO v_exp_minutes;
  SELECT COALESCE((SELECT value::int FROM config WHERE key = 'review_auto_reveal_days'), 7) INTO v_reveal_days;

  -- 1. Expire stale OPEN tasks
  WITH expired AS (
    UPDATE tasks
    SET status = 'EXPIRED',
        updated_at = now()
    WHERE status = 'OPEN'
      AND created_at < (now() - (v_exp_minutes || ' minutes')::INTERVAL)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;

  -- Withdraw bids on expired tasks
  UPDATE bids
  SET status = 'WITHDRAWN',
      updated_at = now()
  WHERE status = 'PENDING'
    AND task_id IN (SELECT id FROM tasks WHERE status = 'EXPIRED');

  -- 2. Auto-reveal hidden reviews older than 7 days
  WITH revealed AS (
    UPDATE reviews
    SET visible = true
    WHERE visible = false
      AND created_at < (now() - (v_reveal_days || ' days')::INTERVAL)
    RETURNING reviewee_id
  )
  SELECT COUNT(*) INTO v_revealed_count FROM revealed;

  -- Recalculate profile ratings if any reviews were revealed
  IF v_revealed_count > 0 THEN
    UPDATE profiles p
    SET rating_count = r.cnt,
        rating_average = r.avg_rat
    FROM (
      SELECT reviewee_id, COUNT(*) AS cnt, ROUND(AVG(rating)::numeric, 2) AS avg_rat
      FROM reviews
      WHERE visible = true
      GROUP BY reviewee_id
    ) r
    WHERE p.id = r.reviewee_id;
  END IF;

  RETURN jsonb_build_object(
    'expired_tasks', v_expired_count,
    'revealed_reviews', v_revealed_count
  );
END;
$$;
```

---

### 5. Configuration Table Parameters

The `config` table manages all operational variables:

```sql
INSERT INTO config (key, value, description) VALUES
  ('search_radius_meters', '1500', 'Maximum visibility and bidding radius in meters (1.5 km)'),
  ('min_task_budget', '50.00', 'Minimum task budget allowed in Rupees'),
  ('max_task_budget', '300.00', 'Maximum task budget allowed in Rupees'),
  ('min_bid_price', '20.00', 'Minimum worker bid price in Rupees'),
  ('max_bid_ratio', '2.0', 'Maximum allowed multiplier on task budget for a bid'),
  ('platform_fee_percent', '0.10', 'Platform commission percentage (10%) deducted from worker payout'),
  ('min_platform_fee', '5.00', 'Minimum platform fee in Rupees'),
  ('bidding_window_minutes', '3', 'Active bidding window duration'),
  ('task_expiration_minutes', '30', 'Inactivity duration before an open task expires'),
  ('otp_validity_hours', '2', 'Duration for which completion OTP remains valid'),
  ('max_otp_attempts', '3', 'Failed OTP attempts threshold triggering DISPUTED status'),
  ('max_open_tasks_per_requester', '3', 'Maximum simultaneous open tasks per requester'),
  ('max_active_jobs_per_worker', '1', 'Maximum simultaneous active jobs per worker'),
  ('initial_requester_balance', '500.00', 'Demo initial balance granted to new requester wallets'),
  ('review_auto_reveal_days', '7', 'Days before a pending double-blind review is automatically revealed')
ON CONFLICT (key) DO NOTHING;
```

---

### 6. Test Harness Specifications (`tests/whap.test.js`)

The Node test script uses `@supabase/supabase-js`. All tests must pass sequentially and output real verification timings.

#### Test Suites Structure:

1. **Suite 1: Happy Path End-to-End Cycle**
   - Step 1: Sign up Requester A and Worker B. Verify initial demo balance of Rs 500 for Requester A.
   - Step 2: Requester A calls `post_task('Pickup Xerox copies', '2 copies', 'XEROX_PICKUP', 100, lat, lng, 'Library')`. Verify task status = `OPEN`.
   - Step 3: Worker B calls `nearby_tasks(lat, lng)`. Verify task appears in results with distance < 1.5 km and OTP is NOT exposed.
   - Step 4: Worker B calls `place_bid(task_id, 90)`. Verify bid status = `PENDING`.
   - Step 5: Requester A calls `accept_bid(bid_id)`.
     - Verify task status becomes `ASSIGNED`.
     - Verify Requester A wallet balance decreased by Rs 90 (500 - 90 = 410).
     - Verify `escrow_transactions` has amount = 90, platform_fee = 9, status = `HELD`.
     - Verify `ledger_entries` records `ESCROW_LOCK` for Rs 90.
     - Verify OTP is generated.
   - Step 6: Worker B calls `complete_task(task_id, correct_otp)`.
     - Verify task status becomes `COMPLETED`.
     - Verify Worker B wallet balance increased by Rs 81 (90 - 9).
     - Verify `ledger_entries` records `PAYOUT` of Rs 81 and `FEE` of Rs 9.
     - Verify escrow status is `RELEASED`.

2. **Suite 2: Wallet Balance Constraints**
   - Requester wallet balance = Rs 50.
   - Worker places bid of Rs 80.
   - Requester calls `accept_bid`.
   - Assert: Exception thrown ("Insufficient wallet balance"). Wallet balance remains Rs 50, task remains `OPEN`.

3. **Suite 3: Concurrency Race Condition Safety**
   - Two workers (Worker B and Worker C) place bids on the same OPEN task.
   - Requester fires `Promise.all([accept_bid(bid_b), accept_bid(bid_c)])`.
   - Assert: Exactly ONE call resolves successfully.
   - Assert: The second call rejects with error ("Task is no longer open").
   - Assert: Requester wallet is deducted exactly once, not twice.

4. **Suite 4: Spatial Isolation & 1.5 km Boundary Gate**
   - Worker D at coordinate (lat + 0.02, lng) [approx 2.2 km away].
   - Worker D queries `nearby_tasks`: task is NOT in result list.
   - Worker D attempts `place_bid`: rejected with ("Worker is outside the 1.5 km task boundary").
   - Worker D attempts direct query `supabase.from('tasks').select('*').eq('id', task_id)`: returns 0 rows due to RLS spatial policy.

5. **Suite 5: Bid Price Boundary Checks**
   - Bid with price = Rs 15 (< Rs 20): rejected.
   - Task budget = Rs 100. Bid with price = Rs 201 (> 2x budget): rejected.
   - Bid with price = Rs 20 (exact boundary): accepted.
   - Bid with price = Rs 200 (exact boundary): accepted.

6. **Suite 6: OTP Error Counting & Dispute Transition**
   - Assigned worker calls `complete_task` with '0000' (wrong OTP).
     - Result: rejected ("Attempt 1 of 3"). Task remains `ASSIGNED`.
   - Assigned worker calls `complete_task` with '1111' (wrong OTP).
     - Result: rejected ("Attempt 2 of 3"). Task remains `ASSIGNED`.
   - Assigned worker calls `complete_task` with '2222' (wrong OTP).
     - Result: rejected ("Task is now DISPUTED"). Task status updated to `DISPUTED`. Escrow remains `HELD`.

7. **Suite 7: Task Cancellation & Escrow Refund**
   - Test A: Cancel OPEN task -> task becomes `CANCELLED`, pending bids become `WITHDRAWN`.
   - Test B: Cancel ASSIGNED task -> requester wallet refunded full escrow amount (Rs 90), ledger entry `ESCROW_REFUND` recorded, escrow status `REFUNDED`, task status `CANCELLED`.

8. **Suite 8: Penetration & RLS Hardening Break Attempts**
   - Break 1: Authenticated worker queries `tasks.otp_code` -> returns NULL.
   - Break 2: Worker queries `wallets` of requester -> returns 0 rows.
   - Break 3: User executes `UPDATE wallets SET balance = 1000` -> throws RLS permission error.
   - Break 4: User executes `INSERT INTO escrow_transactions ...` -> throws RLS permission error.
   - Break 5: User executes `UPDATE tasks SET status = 'COMPLETED'` directly -> throws RLS permission error.

9. **Suite 9: Double-Blind Review Mechanics**
   - Requester submits 5-star review.
     - Assert: `visible` = false. Worker queries reviews: 0 rows returned.
   - Worker submits 4-star review.
     - Assert: Both reviews updated to `visible = true`.
     - Worker profile `rating_average` is updated. Requester profile `rating_average` is updated.

10. **Suite 10: 100-Request Load Test (`nearby_tasks`)**
    - Execute 100 concurrent requests via `Promise.all`:
      ```javascript
      const requests = Array.from({ length: 100 }, () =>
        supabase.rpc('nearby_tasks', { p_lat: 12.9716, p_lng: 77.5946 })
      );
      const start = Date.now();
      const results = await Promise.all(requests);
      const totalDuration = Date.now() - start;
      ```
    - Assert: 100/100 requests succeed with status 200.
    - Measure and print: total duration, average response time, min, max, and 95th percentile latency.

---

### 7. Seed Data Requirements

To support development, testing, and UI verification on a sample campus (e.g., IISc Bangalore coordinates: `13.0184` N, `77.5684` E):

1. **Profiles & Users**:
   - `requester_1@whap.local` (Role: REQUESTER, Balance: Rs 500)
   - `requester_2@whap.local` (Role: REQUESTER, Balance: Rs 500)
   - `worker_1@whap.local` (Role: WORKER, Location: 13.0185, 77.5685, ~15m away)
   - `worker_2@whap.local` (Role: WORKER, Location: 13.0210, 77.5700, ~350m away)
   - `worker_3@whap.local` (Role: WORKER, Location: 13.0240, 77.5750, ~950m away)
   - `worker_4@whap.local` (Role: WORKER, Location: 13.0120, 77.5600, ~1200m away)
   - `admin@whap.local` (Role: ADMIN)

2. **8 Seed Tasks**:
   - **Task 1 (Inside)**: Xerox Pickup, Budget: Rs 60, Location: 13.0190, 77.5680 (~80m away)
   - **Task 2 (Inside)**: Buy Stationery, Budget: Rs 120, Location: 13.0200, 77.5690 (~200m away)
   - **Task 3 (Inside)**: Carry Books to Dept, Budget: Rs 100, Location: 13.0215, 77.5710 (~450m away)
   - **Task 4 (Inside)**: Queue for Tokens, Budget: Rs 150, Location: 13.0230, 77.5730 (~700m away)
   - **Task 5 (Inside)**: Hardware Component Pickup, Budget: Rs 80, Location: 13.0250, 77.5750 (~1050m away)
   - **Task 6 (Inside)**: Food Delivery from Canteen, Budget: Rs 75, Location: 13.0130, 77.5620 (~1350m away)
   - **Task 7 (Outside)**: Collect Parcel from City Post Office, Budget: Rs 200, Location: 13.0000, 77.5500 (~2800m away, 2.8 km)
   - **Task 8 (Outside)**: Metro Ticket Purchase, Budget: Rs 90, Location: 13.0380, 77.5900 (~3200m away, 3.2 km)
