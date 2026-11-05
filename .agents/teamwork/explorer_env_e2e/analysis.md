# Deep Technical Analysis: Environment Setup, E2E Testing, Security Boundaries & Deployment

**Agent**: teamwork_explorer (`explorer_env_e2e`)  
**Timestamp**: 2026-11-05T17:15:00Z  
**Project**: WHAP (Wagers Hiring Application Platform)  
**Working Directory**: `d:\WHAP`  

---

## Executive Summary

An exhaustive, non-destructive investigation of the environment, testing infrastructure, security constraints, and deployment prerequisites was conducted. All credentials in `.env.local` are present, follow the new Supabase key format (`sb_publishable_...` and `sb_secret_...`), and direct connectivity to remote Supabase (`cmszsqdxztvtkwpzbvmr`) is 100% active and healthy. Git is not yet initialized and `.gitignore` is currently missing—creating `.gitignore` before repository initialization is a critical prerequisite to prevent secret leakage. The PDF path in `MASTER_PROMPT.md` line 3 contains a stale underscore reference that must be corrected. The testing runner, concurrency locks, security geofencing, OTP masking, wallet immutability, Vercel SPA routing, and GitHub Actions keep-alive workflow have been fully architected below.

---

## 1. Workspace Tree & Canonical Integrity

### 1.1 Current Directory State
Inspection of `D:\WHAP` revealed:
- `D:\WHAP\.agents/` (agent teamwork metadata)
- `D:\WHAP\.env.local` (live Supabase credentials, 273 bytes)
- `D:\WHAP\MASTER_PROMPT.md` (mission specifications, 5,448 bytes)
- `D:\WHAP\docs/` (documentation directory containing `WHAP Implementation Plan.pdf`, 268,016 bytes)

### 1.2 Missing `.gitignore` & Risk Assessment
- `.gitignore` **does NOT exist** in `D:\WHAP`.
- **CRITICAL RISK**: If `git init` and `git add .` are run in the current workspace, `.env.local` containing live project passwords and service role keys will be staged into Git and pushed to remote.
- **Remediation**: Before running `git init` or any `git add`, a comprehensive `.gitignore` must be written to `D:\WHAP\.gitignore`.

**Required `.gitignore` specification**:
```gitignore
# Environment files (CRITICAL: Do NOT remove)
.env
.env.*
!.env.example

# Node dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
*.log

# Production build artifacts
dist/
build/

# IDE / OS files
.vscode/
.idea/
.DS_Store
Thumbs.db
```

---

## 2. Environment Credentials & Remote Supabase Connectivity

### 2.1 Inspection of `.env.local` (Key Presence Only, Zero Leakage)
A safe inspection of `.env.local` variable names and formats confirmed:

| Variable Name | Present | Length | Format / Prefix Verification | Purpose |
|---|---|---|---|---|
| `SUPABASE_PROJECT_REF` | YES | 20 chars | `cmszsqdxztvtkwp...` | Remote Supabase project identifier |
| `SUPABASE_DB_PASSWORD` | YES | 11 chars | Alphanumeric | PostgreSQL database password |
| `VITE_SUPABASE_URL` | YES | 40 chars | `https://cmszsqdxztvtkwpzbvmr.supabase.co` | Remote API URL |
| `VITE_SUPABASE_ANON_KEY` | YES | 46 chars | `sb_publishable_...` | Client-safe publishable key (Frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | YES | 41 chars | `sb_secret_...` | Privileged secret key (Backend tests only) |

*Note: Per MASTER_PROMPT.md section "KEY FORMAT NOTE", keys are in the new Supabase format (`sb_publishable_...` and `sb_secret_...`) rather than legacy JWTs.*

### 2.2 Remote Supabase API & Network Connectivity Verification
Direct non-destructive HTTP and TCP calls verified connectivity:

1. **Auth Service Health**:
   - Endpoint: `GET https://cmszsqdxztvtkwpzbvmr.supabase.co/auth/v1/health` with `apikey: VITE_SUPABASE_ANON_KEY`
   - **Result**: `HTTP 200 OK`
2. **Auth Service Settings**:
   - Endpoint: `GET https://cmszsqdxztvtkwpzbvmr.supabase.co/auth/v1/settings` with `apikey: VITE_SUPABASE_ANON_KEY`
   - **Result**: `HTTP 200 OK`
3. **PostgREST Root Schema Endpoint**:
   - Endpoint: `GET https://cmszsqdxztvtkwpzbvmr.supabase.co/rest/v1/` with `apikey: SUPABASE_SERVICE_ROLE_KEY` and `Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY`
   - **Result**: `HTTP 200 OK`
   - Schema reflection query: `Definitions in schema: []` (Fresh DB, no user tables yet).
   - *Security Note*: Calling `/rest/v1/` with the anon publishable key returned `HTTP 401 Unauthorized` with `{"message":"Secret API key required","hint":"Only secret API keys can be used for this endpoint."}`. This confirms that Supabase's new API key architecture properly prevents anonymous schema scraping.
4. **PostgreSQL Network Ports**:
   - Direct PostgreSQL port: `db.cmszsqdxztvtkwpzbvmr.supabase.co:5432` -> **`TcpTestSucceeded: True`**
   - Supabase Connection Pooler: `aws-0-ap-south-1.pooler.supabase.com:6543` -> **`TcpTestSucceeded: True`**
   - Direct database migrations can be pushed using `supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.cmszsqdxztvtkwpzbvmr.supabase.co:5432/postgres"` or port 6543 pooler.

---

## 3. PDF Path Reference Correction in `MASTER_PROMPT.md`

### 3.1 Observation
- In `D:\WHAP\MASTER_PROMPT.md` (line 3):
  `SOURCE OF TRUTH: docs/WHAP_Implementation_Plan.pdf. Read it fully first (pdftotext or view).`
- On filesystem, `d:\WHAP\docs\` contains:
  `WHAP Implementation Plan.pdf` (contains spaces, no underscores).

### 3.2 Correction Specification
- **File**: `D:\WHAP\MASTER_PROMPT.md`
- **Line**: 3
- **Current text**:
  ```markdown
  SOURCE OF TRUTH: docs/WHAP_Implementation_Plan.pdf. Read it fully first (pdftotext or view).
  ```
- **Replacement text**:
  ```markdown
  SOURCE OF TRUTH: docs/WHAP Implementation Plan.pdf. Read it fully first (pdftotext or view).
  ```
- *No file moves or copies permitted per R1.*

---

## 4. Git & Tooling Status

### 4.1 System Tooling Audit
- **Node.js**: `v24.13.0` (Satisfies requirement `>= 20.19`)
- **npm**: `11.6.2`
- **git**: `2.52.0.windows.1`
- **GitHub CLI (`gh`)**: `gh.exe` installed at `C:\Program Files\GitHub CLI\gh.exe`.
  - Authentication status: `Logged in to github.com account Ashith64 (keyring)`
  - Token scopes: `gist`, `read:org`, `repo`.
  - Git credential helper: active via `gh auth git-credential`.
- **Supabase CLI**: `supabase@3.0.0` available via `npx supabase`.
  - `npx supabase projects list` requires `SUPABASE_ACCESS_TOKEN` for management APIs, but direct database operations succeed via DB URL.
- **Vercel CLI**: `vercel@65.11.0` available via `npx vercel`.
  - Currently logged out. Login required for deployment phase.

### 4.2 Git Repository Setup Sequence
When Phase 0 initializes git, the sequence must be:
1. Write `D:\WHAP\.gitignore` (ignoring `.env*`, `node_modules/`, `dist/`).
2. Run `git init -b main`.
3. Check `git status` to verify `.env.local` is UNTRACKED and ignored.
4. Stage canonical project files: `git add .gitignore MASTER_PROMPT.md docs/ .agents/`
5. Commit initial baseline: `git commit -m "chore: initial project baseline with .gitignore"`.
6. Remote repo creation: `gh repo create Ashith64/WHAP --public --source=. --remote=origin --push` (or private if preferred).

---

## 5. E2E & Backend Test Runner Architecture (`tests/whap.test.js`)

### 5.1 Test Framework Selection
- **Recommended Runner**: Native Node.js test runner (`node:test` and `node:assert`) invoked as `node --test tests/whap.test.js` or `node tests/whap.test.js`.
- **Rationale**:
  1. Node.js v24.13.0 includes built-in runner, assertions, mocking, and timing without any heavy external dependencies.
  2. Perfectly aligns with the 8 GB low-spec laptop constraint in Section 2 of the Implementation Plan.
  3. Seamless integration with `@supabase/supabase-js` (v2.119.0).
  4. Avoids Vite/Vitest ESM vs CJS bundling conflicts between frontend and backend scripts.

### 5.2 Required Dependencies
In `package.json`:
- `@supabase/supabase-js`: `^2.119.0`
- `dotenv`: `^16.4.7`

### 5.3 Test Suite Structure (`tests/whap.test.js`)
The test script must execute against the live remote Supabase instance using both the service role key (for fixture setup/teardown) and anon key / user auth sessions (to simulate real client calls):

1. **Setup & Teardown**:
   - Create test users: `requester1`, `worker1`, `worker2`, `worker_far` (> 1.5km).
   - Ensure wallets are funded (Rs 500 initial demo balance).
   - Clean up test tasks and ledger entries.
2. **Happy Path Workflow**:
   - `post_task`: Requester posts chore (budget Rs 150, location Bangalore coords). Verify status `OPEN`.
   - `nearby_tasks`: Worker1 (distance 300m) calls `nearby_tasks`; task returned with distance.
   - `place_bid`: Worker1 places bid of Rs 140. Status `PENDING`.
   - `accept_bid`: Requester accepts bid. Verify task status `ASSIGNED`, bid status `ACCEPTED`, requester wallet deducted Rs 140, escrow credited Rs 140 (HELD), OTP generated.
   - `complete_task`: Worker submits correct 4-digit OTP. Escrow released: Rs 14 platform fee deducted (10%), Rs 126 credited to worker wallet, task status `COMPLETED`.
   - `submit_review`: Double-blind review submission.
3. **Boundary & Validation Tests**:
   - **Insufficient balance**: Requester with Rs 10 attempts to accept Rs 100 bid -> Rejected.
   - **Geofence rejection**: Worker_far (5km away) attempts `place_bid` -> Rejected.
   - **Budget violations**: Bid < Rs 20 or > 2x budget -> Rejected.
   - **OTP 3-Strikes Dispute**: 3 consecutive invalid OTP submissions -> Task status automatically transitioned to `DISPUTED`.
   - **Cancellation & Escrow Refund**: Task cancelled after acceptance -> Escrow released as full refund to requester wallet; ledger entry `ESCROW_REFUND`.
   - **Double-Blind Reviews**: Review 1 submitted -> remains `visible = false` until Review 2 submitted.

### 5.4 Concurrency Test: 2 Simultaneous Accepts
- **Problem**: When a requester has multiple bids and two accept requests are submitted at the same moment, only ONE must succeed; the other must be rejected, and escrow must be locked exactly once.
- **Backend Requirement**: In the `accept_bid` SQL function, PostgreSQL row-level locking must be enforced:
  ```sql
  -- Inside accept_bid(p_task_id UUID, p_bid_id UUID)
  SELECT * FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF task.status != 'OPEN' THEN
      RAISE EXCEPTION 'Task is already assigned or not open';
  END IF;
  ```
- **Test Implementation**:
  ```javascript
  // Concurrency Verification
  const [res1, res2] = await Promise.allSettled([
    clientRequester.rpc('accept_bid', { p_task_id: taskId, p_bid_id: bid1.id }),
    clientRequester.rpc('accept_bid', { p_task_id: taskId, p_bid_id: bid2.id })
  ]);
  
  const successes = [res1, res2].filter(r => r.status === 'fulfilled' && !r.value.error);
  const failures = [res1, res2].filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error));
  
  assert.strictEqual(successes.length, 1, 'Exactly one accept must succeed');
  assert.strictEqual(failures.length, 1, 'Second simultaneous accept must fail');
  ```
- **Database Post-Condition Assertions**:
  - `tasks.status` is `'ASSIGNED'`.
  - Only one bid is `'ACCEPTED'`, all other bids for that task are `'REJECTED'`.
  - Requester's wallet deducted exactly once.
  - Escrow ledger has exactly one `ESCROW_LOCK` entry for that task.

### 5.5 100-Request Load Test on `nearby_tasks`
- **Execution**:
  ```javascript
  const CONCURRENT_REQUESTS = 100;
  const lat = 12.9716, lng = 77.5946;
  const timings = [];
  
  const startTime = performance.now();
  const promises = Array.from({ length: CONCURRENT_REQUESTS }, async (_, i) => {
    const t0 = performance.now();
    const { data, error } = await supabaseWorker.rpc('nearby_tasks', {
      p_worker_lat: lat,
      p_worker_lng: lng
    });
    const t1 = performance.now();
    timings.push(t1 - t0);
    return { data, error };
  });
  
  const responses = await Promise.all(promises);
  const totalDuration = performance.now() - startTime;
  
  timings.sort((a, b) => a - b);
  const min = timings[0].toFixed(1);
  const max = timings[timings.length - 1].toFixed(1);
  const mean = (timings.reduce((s, v) => s + v, 0) / timings.length).toFixed(1);
  const p95 = timings[Math.floor(timings.length * 0.95)].toFixed(1);
  const errors = responses.filter(r => r.error);
  
  console.log(`[LOAD TEST] 100 requests in ${totalDuration.toFixed(1)}ms | Min: ${min}ms, Mean: ${mean}ms, P95: ${p95}ms, Max: ${max}ms | Errors: ${errors.length}`);
  assert.strictEqual(errors.length, 0, 'All 100 requests must succeed without error');
  ```
- Output to be written to `evidence/phase-3.txt`.

---

## 6. Security Boundaries & Hardening Verification

### 6.1 Row Level Security (RLS) Matrix
RLS must be enabled on all 9 tables:

| Table | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy |
|---|---|---|---|---|
| `profiles` | Authenticated users (public profiles) | Self only (`id = auth.uid()`) | Self only (`id = auth.uid()`) | Disallowed |
| `wallets` | Self only (`user_id = auth.uid()`) | Disallowed (Created via trigger/function) | Disallowed (Functions only) | Disallowed |
| `tasks` | Requester, assigned worker, OR workers within 1.5km if OPEN | Requester only (`requester_id = auth.uid()`) | Requester only if OPEN; Functions only otherwise | Requester only if OPEN |
| `bids` | Requester of task OR worker who created bid | Worker only (`worker_id = auth.uid()`) | Worker only while PENDING; Functions on accept | Worker only while PENDING |
| `escrow_transactions`| Participants of task (requester or assigned worker) | Disallowed (Functions only) | Disallowed (Functions only) | Disallowed |
| `ledger_entries` | Wallet owner (`wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid())`) | Disallowed (Functions only) | Disallowed (Functions only) | Disallowed |
| `reviews` | If `visible = true` OR author (`reviewer_id = auth.uid()`) | Participants after task completion | Disallowed | Disallowed |
| `notifications` | Recipient only (`user_id = auth.uid()`) | Disallowed (Functions only) | Recipient only (`read = true`) | Disallowed |
| `config` | Authenticated users (read-only) | Admin only / Service role | Admin only / Service role | Disallowed |

### 6.2 Strict 1.5 km Geofence Verification (Gate Rule)
- **Requirement**: "Proof a worker cannot see tasks beyond 1.5 km, even by id."
- **RLS Policy on `tasks`**:
  ```sql
  CREATE POLICY tasks_worker_visibility ON tasks
  FOR SELECT TO authenticated
  USING (
    -- 1. Requester can see their own tasks anywhere
    requester_id = auth.uid()
    OR
    -- 2. Assigned worker can see their assigned task anywhere
    assigned_worker_id = auth.uid()
    OR
    -- 3. Open tasks visible ONLY if within 1500m of worker's registered profile location
    (
      status = 'OPEN' AND
      ST_DWithin(
        tasks.location,
        (SELECT location FROM profiles WHERE id = auth.uid()),
        1500
      )
    )
  );
  ```
- **Test Gate**: Worker performs direct query `supabase.from('tasks').select('*').eq('id', taskIdOutside1500m)`.
- **Expected Outcome**: Query returns `data: []` (0 rows), proving the 1.5km barrier cannot be bypassed even by guessing or probing task UUIDs.

### 6.3 OTP Secrecy
- **Requirement**: "Only the task's requester can read the OTP. A worker cannot read the OTP."
- **Architectural Solution**:
  1. Store `otp_code` on `tasks` but revoke column access from client roles, OR
  2. Implement an RLS-secured view or RPC `get_task_otp(p_task_id UUID)` that explicitly checks `auth.uid() = requester_id`.
  3. Worker calling `supabase.from('tasks').select('otp_code').eq('id', assignedTaskId)` must receive `null` or an error.
  4. Worker must only receive the task details, agreed price, and status `'ASSIGNED'`, without seeing the secret OTP.

### 6.4 Wallet Immutability from Client
- Direct client mutations:
  ```javascript
  const { data, error } = await supabaseWorker.from('wallets').update({ balance: 999999 }).eq('user_id', workerId);
  ```
- Since `wallets` has NO `UPDATE` policy for `authenticated`, PostgreSQL evaluates the update as matching 0 rows or denying permission.
- Balances are strictly updated inside PostgreSQL transactions executed by `SECURITY DEFINER` functions (`accept_bid`, `complete_task`, `cancel_task`).

---

## 7. Deployment & Operational Keep-Alive

### 7.1 Vercel Deployment Setup
- **Framework**: Vite SPA (React).
- **Build Output**: `dist`.
- **Build Command**: `npm run build`.
- **Client-Side Routing Rewrite (`vercel.json`)**:
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- **Environment Variables**:
  - `VITE_SUPABASE_URL`: `https://cmszsqdxztvtkwpzbvmr.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_...`
  - **CRITICAL**: Do NOT configure `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_PASSWORD` on Vercel.

### 7.2 GitHub Actions Keep-Alive Workflow
- Free Supabase projects pause after 7 days of inactivity.
- Workflow File: `.github/workflows/keep-alive.yml`
- **Schedule**: Cron every 3 days (`0 0 */3 * *`) + `workflow_dispatch`.
- **Implementation**:
  ```yaml
  name: Supabase Keep-Alive

  on:
    schedule:
      - cron: '0 0 */3 * *'
    workflow_dispatch:

  jobs:
    ping:
      runs-on: ubuntu-latest
      steps:
        - name: Ping Supabase Auth Health
          run: |
            HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              -H "apikey: ${{ secrets.VITE_SUPABASE_ANON_KEY }}" \
              "${{ secrets.VITE_SUPABASE_URL }}/auth/v1/health")
            echo "Health status: $HTTP_STATUS"
            if [ "$HTTP_STATUS" -ne 200 ]; then
              exit 1
            fi
  ```
- **GitHub Secrets Required**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

### 7.3 Required Documentation Deliverables
1. `README.md`: System overview, prerequisites, setup instructions, test commands, deployment links.
2. `PROJECT_EXPLAINED.md`: Plain English breakdown of each table schema, database function logic, and UI view.
3. `DEMO_SCRIPT.md`: Precise 3-minute script guiding an evaluator through login, posting, bidding, acceptance, OTP completion, and payout verification.
4. `FINAL_REPORT.md`: Section 14 audit checklist completion matrix linking to command execution evidence files (`evidence/phase-*.txt`).
