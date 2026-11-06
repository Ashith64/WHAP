# WHAP Architectural Deep Dive & System Internals

This document provides a comprehensive engineering analysis of the six core architectural mechanisms governing the **Wagers Hiring Application Platform (WHAP)**.

---

## 1. PostGIS 1.5 km Geofencing & Spatial Boundary Architecture

### The Spatial Problem
On a physical campus, physical distance dictates chore feasibility. A student worker cannot run across a 5 km city perimeter to deliver a 15-minute Xerox errand between classes. Furthermore, privacy demands that chore listings and user locations outside the immediate vicinity must not be exposed to distant actors.

### Mathematical & Geographic Implementation
WHAP implements spatial geometry using PostgreSQL's PostGIS extension configured for the **WGS 84 (EPSG:4326)** ellipsoidal spheroid.
- All locations are stored as native `geography(Point, 4326)` columns rather than Cartesian coordinates (`(x,y)`), ensuring calculations account for Earth's curvature.
- Spatial indexing uses Generalized Search Trees (GiST):
  ```sql
  CREATE INDEX idx_tasks_location_gist ON public.tasks USING GIST(location);
  CREATE INDEX idx_profiles_location_gist ON public.profiles USING GIST(location);
  ```

### Dual-Layer Geofence Enforcement
1. **Stored Procedure Layer (`nearby_tasks`)**:
   When a worker queries nearby tasks, `nearby_tasks` enforces an upper bound:
   ```sql
   ST_DWithin(t.location, v_worker_point, LEAST(p_radius_meters, 1500))
   ```
   Distances are computed using `ST_Distance(t.location, v_worker_point)` and returned sorted in ascending order.
2. **Row Level Security (RLS) Layer (`tasks_select_policy`)**:
   Even if an attacker bypasses the RPC and queries `public.tasks` directly with a guessed UUID, the PostgreSQL RLS policy filters the row at the engine level:
   ```sql
   (status = 'OPEN' AND EXISTS (
     SELECT 1 FROM public.profiles
     WHERE profiles.id = auth.uid()
       AND profiles.location IS NOT NULL
       AND ST_DWithin(tasks.location, profiles.location, 1500)
   ))
   ```
   If the task is > 1500m away, PostgreSQL returns **0 rows**.

---

## 2. Concurrency Race Condition Immunity (3-Level Row-Level Locking)

### The Race Condition Scenario
Consider Requester A posting a task. Two workers, Worker B and Worker C, submit bids of ₹80 and ₹75. Requester A accidentally double-clicks or two browser windows invoke `accept_bid(bid_B)` and `accept_bid(bid_C)` in parallel. Without transaction serialization, both bids could be accepted, deducting escrow twice or assigning two workers to a single chore.

### The 3-Level Pessimistic Lock Hierarchy
WHAP eliminates this entirely inside the `SECURITY DEFINER` stored procedure `accept_bid(p_task_id, p_bid_id)`:

```
Transaction Start
   │
   ├─► Level 1 Lock: SELECT * FROM tasks WHERE id = p_task_id FOR UPDATE;
   │   (Acquires exclusive row lock. Asserts status == 'OPEN'.
   │    Any concurrent transaction blocks here until this transaction commits.)
   │
   ├─► Level 2 Lock: SELECT * FROM bids WHERE id = p_bid_id FOR UPDATE;
   │   (Locks the winning bid. Asserts status == 'PENDING'.)
   │
   └─► Level 3 Lock: SELECT * FROM wallets WHERE user_id = v_requester_id FOR UPDATE;
       (Locks requester wallet. Asserts balance >= agreed_price.)
```

### Atomic State Transition & Rejection
1. Requester wallet balance is decremented: `balance = balance - v_price`.
2. Task transitions: `status = 'ASSIGNED'`, `assigned_worker_id = v_worker_id`, `agreed_price = v_price`.
3. All competing bids on `p_task_id` are atomically set to `status = 'REJECTED'`.
4. Cryptographic 4-digit OTP generated via `LPAD(FLOOR(random() * 10000)::TEXT, 4, '0')`.
5. When the concurrent transaction unblocks, it reads `status = 'ASSIGNED'` and immediately raises exception:
   `'Task is no longer open for bid acceptance'`.

---

## 3. Zero-Leakage Double-Entry Financial Ledger Engine

### Conservation of Value Invariant
WHAP models financial transactions under strict double-entry principles. The net balance delta across all actors for any task must equal zero:

$$\Delta \text{Requester} + \Delta \text{Worker} + \Delta \text{Platform Fee} = 0.00$$

### Financial Lifecycle (Example: ₹100 Task, ₹90 Accepted Bid)
1. **Bid Acceptance (Escrow Lock)**:
   - Requester Wallet: Deducted ₹90 ($\Delta = -₹90$).
   - `escrow_transactions`: New record created with `amount = 90.00`, `platform_fee = 9.00`, `status = 'HELD'`.
   - `ledger_entries`: Appended with `type = 'ESCROW_LOCK'`, `amount = -90.00`.
2. **Task Completion (Payout & Fee Split)**:
   - Platform calculates fee: $\max(0.10 \times 90, 5) = ₹9.00$.
   - Net worker payout: $₹90.00 - ₹9.00 = ₹81.00$.
   - Worker Wallet: Credited ₹81.00 ($\Delta = +₹81$).
   - Platform Revenue: Credited ₹9.00 ($\Delta = +₹9$).
   - `escrow_transactions`: Status updated to `'RELEASED'`.
   - `ledger_entries`: Appended with `type = 'PAYOUT'` (+₹81) and `type = 'FEE'` (+₹9).
   - Net Balance Check: $-90 + 81 + 9 = 0.00$ (**Zero Leakage**).
3. **Task Cancellation (Escrow Refund)**:
   - If cancelled before completion: Requester wallet credited ₹90 ($\Delta = +₹90$).
   - `escrow_transactions`: Status updated to `'REFUNDED'`.
   - `ledger_entries`: Appended with `type = 'ESCROW_REFUND'` (+₹90).

### Security Protections
- PostgreSQL `CHECK (balance >= 0)` constraint guarantees wallets can never become negative.
- Direct client `INSERT`, `UPDATE`, `DELETE` are disallowed via RLS on `wallets`, `escrow_transactions`, and `ledger_entries`. All balance modifications execute exclusively within trusted RPCs.

---

## 4. Double-Blind Review & Reputation Integrity

### The Problem of Retaliatory Reviews
In open marketplaces, reviewers withhold honest critical feedback fearing reciprocal negative reviews.

### The Double-Blind Protocol
1. **Submission Phase 1**: Requester submits a rating (e.g. 5 stars) and comment via `submit_review`.
   - Stored in `reviews` with `visible = false`.
   - RLS policy `reviews_select_policy` ensures Worker cannot read this record (`visible = true OR reviewer_id = auth.uid()`).
2. **Submission Phase 2**: Worker submits their review (e.g. 5 stars).
   - `submit_review` detects both parties have submitted.
   - Atomically updates both reviews to `visible = true`.
   - Recalculates `rating_average` and `rating_count` for both profiles using SQL window aggregates.
3. **Timeout Fallback**: If one party fails to submit within 7 days, `expire_tasks` auto-reveals the submitted review (`visible = true`), preventing review extortion.

---

## 5. PWA Service Worker, Precaching & Offline Resilience

### Workbox Caching Strategies (`vite.config.js`)
- **Static Assets Precaching**: 20 build artifacts (HTML, JS, CSS, WebManifest, SVG icons) are precached upon installation (756.89 KiB).
- **OpenStreetMap Tile Cache (`CacheFirst`)**:
  - URL pattern: `^https:\/\/[a-c]\.tile\.openstreetmap\.org\/.*`
  - Maximum entries: 1000 tiles.
  - Expiration: 30 days.
  - Ensures campus map renders even during connectivity dropouts.
- **Supabase API Cache (`NetworkFirst`)**:
  - URL pattern: `^https:\/\/.*\.supabase\.co\/rest\/v1\/.*`
  - Network timeout: 4 seconds.
  - Fallback: Cached response ensures task listings remain viewable offline.

---

## 6. Security Penetration Defense Boundaries (F28 Verification)

| Vulnerability Vector | Threat Model | Technical Defense | Test Evidence |
|---|---|---|---|
| **Distant Task Snooping** | Worker attempts to query task outside 1.5 km by guessing UUID | PostGIS `ST_DWithin` in RLS `tasks_select_policy` | Security Break 1: Returns 0 rows (808ms) |
| **OTP Snooping** | Worker attempts to read completion OTP via API or SQL View | `tasks_view` masks OTP to `NULL`; `get_task_otp` validates `requester_id = auth.uid()` | Security Break 2: View returns NULL, RPC rejects unauthorized (628ms) |
| **Client Wallet Injection** | Malicious user sends `UPDATE wallets SET balance = 999999` | RLS defines 0 client write policies; mutations permitted only via RPC | Security Break 3: Error `42501` / 0 rows updated (525ms) |
| **Direct Escrow Theft** | User attempts `INSERT INTO escrow_transactions` to release money | RLS denies client write; escrow mutations restricted to `complete_task` | Security Break 4: RLS violation thrown (293ms) |
| **Status Jumping** | Worker attempts `UPDATE tasks SET status = 'COMPLETED'` directly | RLS policy restricts task update exclusively to requester and `status = 'OPEN'` | Security Break 5: Update rejected / 0 rows (170ms) |
