# Project: WHAP (Wagers Hiring Application Platform)

## Architecture
WHAP is a hyperlocal micro-task marketplace operating within a strict 1.5 km geofenced radius.
- **Backend**: Supabase (PostgreSQL 15+ with PostGIS extension, GoTrue Auth, Realtime, Database RPC Functions, RLS on every table).
- **Security Definer RPCs**: All state changes and financial mutations (wallet balance changes, escrow lock/release/refund, OTP validation) execute inside atomic database transactions with row-level locks (`FOR UPDATE`).
- **Frontend**: Vite + React (JavaScript `.jsx`), Tailwind CSS, react-router-dom, lucide-react, react-leaflet (OpenStreetMap), vite-plugin-pwa.
- **Testing Track**: Independent opaque-box test suite (`tests/whap.test.js` & E2E runner) validating business invariants, concurrency race conditions, and geofence isolation.
- **Deployment**: Vercel SPA deployment (publishable keys only), GitHub repository with GitHub Actions 3-day keep-alive cron.

## Code Layout
```
D:\WHAP\
├── .agents/teamwork/             # Agent orchestration metadata only (no code/tests)
├── .github/workflows/
│   └── keep-alive.yml            # Supabase API keep-alive cron (every 3 days)
├── docs/
│   └── WHAP Implementation Plan.pdf
├── public/                       # PWA icons, manifest.webmanifest
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── common/               # Header, BottomNav, ProtectedRoute, Toast
│   │   ├── map/                  # Leaflet MapContainer, Marker, 1.5km Circle
│   │   ├── requester/            # TaskPostModal, LiveBidsList, OtpCard
│   │   ├── worker/               # TaskCard, BidSheet, OtpInputBoxes
│   │   └── wallet/               # BalanceCard, SimulatedLedger, SimulatedPaymentNotice
│   ├── context/                  # AuthContext, RealtimeContext
│   ├── hooks/                    # useNearbyTasks, useRealtimeTask, useWallet
│   ├── pages/                    # Home, RequesterDashboard, WorkerDashboard, TaskDetail, Wallet, AdminDisputes
│   ├── services/                 # supabaseClient.js, api.js (RPC callers)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   ├── migrations/               # SQL schema, RLS, functions, triggers
│   └── seed.sql                  # Campus seed data (2 requesters, 4 workers, 1 admin, 8 tasks)
├── tests/
│   ├── whap.test.js              # Comprehensive backend RPC & concurrency test suite
│   └── e2e/                      # Opaque-box E2E test cases
├── .env.local                    # Secrets preserved, gitignored
├── .gitignore                    # Ignores .env*, node_modules, dist
├── index.html
├── MASTER_PROMPT.md              # Stale PDF path corrected
├── package.json
├── README.md
├── PROJECT_EXPLAINED.md
├── DEMO_SCRIPT.md
├── FINAL_REPORT.md
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Environment & Git Baseline | Initialize git, create .gitignore ignoring .env* and node_modules, preserve .env.local secrets | M1 | ORIGINAL_REQUEST R1 |
| F02 | MASTER_PROMPT Correction | Correct stale PDF reference to "docs/WHAP Implementation Plan.pdf" in MASTER_PROMPT.md | M1 | ORIGINAL_REQUEST R1 |
| F03 | Supabase Connectivity Check | Verify remote Supabase connection via health/auth endpoints without leaking secrets | M1 | ORIGINAL_REQUEST R1 |
| F04 | Database Schema & PostGIS | Execute SQL migration for 9 tables, PostGIS geography points, CHECK constraints, GiST/FK indexes | M1 | ORIGINAL_REQUEST R2 |
| F05 | Config Table & Parameters | Database config table storing operational parameters (radius, fee %, budget limits) | M1 | ORIGINAL_REQUEST R2 |
| F06 | Seed Data Insertion | Seed 2 requesters, 4 workers, 1 admin, 8 tasks (6 <= 1.5km, 2 > 1.5km) | M1 | MASTER_PROMPT Phase 2 |
| F07 | Row Level Security (RLS) | Enable RLS on all 9 tables; deny client write on wallets/escrow; spatial filter on worker tasks | M1 | ORIGINAL_REQUEST R2 |
| F08 | 1.5km Geofence Isolation Gate | Gate verification proving a worker cannot query tasks beyond 1.5 km, even by id | M1 | ORIGINAL_REQUEST R2 |
| F09 | post_task RPC | Stored procedure to post task, validate requester limits (<=3 open), deduct/hold initial balance if needed | M2 | ORIGINAL_REQUEST R2 |
| F10 | nearby_tasks RPC | Spatial query returning open tasks within 1.5 km sorted by distance using ST_DWithin | M2 | ORIGINAL_REQUEST R2 |
| F11 | place_bid RPC | Worker reverse bidding (min Rs 20, max 2x budget), upserting single pending bid per worker/task | M2 | ORIGINAL_REQUEST R2 |
| F12 | accept_bid RPC (Row Locked) | Concurrency-safe bid acceptance with `FOR UPDATE` row lock, escrow lock, 4-digit OTP creation | M2 | ORIGINAL_REQUEST R2 |
| F13 | complete_task RPC | Worker submits 4-digit OTP; verifies attempt count (3 wrong -> DISPUTED); releases escrow minus 10% fee | M2 | ORIGINAL_REQUEST R2 |
| F14 | cancel_task RPC | Requester/system task cancellation with full escrow refund to requester wallet | M2 | ORIGINAL_REQUEST R2 |
| F15 | resolve_dispute RPC | Admin dispute resolution distributing escrow to worker, requester, or split | M2 | ORIGINAL_REQUEST R2 |
| F16 | submit_review RPC | Double-blind rating & review submission, hidden until both parties submit or 7 days elapse | M2 | ORIGINAL_REQUEST R2 |
| F17 | expire_tasks RPC | Automatic expiration of tasks open for >30 mins without accepted bid | M2 | ORIGINAL_REQUEST R2 |
| F18 | Backend Test Suite | `tests/whap.test.js` validating all RPCs, 2 concurrent accepts race test, 100-request load test | M2 | ORIGINAL_REQUEST R2 |
| F19 | Vite + React + Tailwind Scaffold | Clean frontend build scaffold with routing, Lucide icons, and Tailwind styling | M3 | ORIGINAL_REQUEST R3 |
| F20 | Role-Protected Routing | Authentication and role-switching routes (`/requester`, `/worker`, `/admin`, `/login`) | M3 | ORIGINAL_REQUEST R3 |
| F21 | Leaflet Map & 1.5km Circle | Interactive Leaflet map with user location marker and 1.5 km radius circle overlay | M3 | ORIGINAL_REQUEST R3 |
| F22 | Requester Workflow UI | 3-step task post wizard, live bids drawer, accept bid button, OTP display card, reviews | M3 | ORIGINAL_REQUEST R3 |
| F23 | Worker Workflow UI | Distance-sorted nearby tasks, bid sheet with stepper, active job view with 4 OTP digit boxes | M3 | ORIGINAL_REQUEST R3 |
| F24 | Simulated Wallet & Notice | Wallet view showing balances, simulated topup/payout, and label "Prototype - simulated payments" | M3 | ORIGINAL_REQUEST R3 |
| F25 | Realtime & 3s Polling Fallback | Supabase Realtime channel subscriptions paired with 3-second polling fallback | M3 | ORIGINAL_REQUEST R3 |
| F26 | PWA Manifest & Service Worker | vite-plugin-pwa manifest, offline caching for assets and OSM map tiles | M3 | ORIGINAL_REQUEST R3 |
| F27 | Dual-Session End-to-End Workflow | Verified live flow across dual sessions (post -> bid -> accept -> OTP -> payout) | M4 | ORIGINAL_REQUEST R3 |
| F28 | Penetration & Security Hardening | Verification that cross-user access fails, worker OTP inspection fails, wallet mutation fails | M5 | ORIGINAL_REQUEST R4 |
| F29 | Vercel Live Deployment | Frontend deployed to Vercel with publishable keys only, verified accessible online | M5 | ORIGINAL_REQUEST R4 |
| F30 | GitHub Repo & Keep-Alive CI | Code pushed to GitHub, `.github/workflows/keep-alive.yml` active calling Supabase every 3 days | M5 | ORIGINAL_REQUEST R4 |
| F31 | Project Documentation Suite | README.md, PROJECT_EXPLAINED.md, DEMO_SCRIPT.md, and FINAL_REPORT.md with command outputs | M5 | ORIGINAL_REQUEST R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Environment & Database Foundations | F01, F02, F03, F04, F05, F06, F07, F08 | None | IN_PROGRESS |
| M2 | Backend Business Logic & RPC Functions | F09, F10, F11, F12, F13, F14, F15, F16, F17, F18 | M1 | PLANNED |
| M3 | Frontend Web Application & PWA | F19, F20, F21, F22, F23, F24, F25, F26 | M1, M2 | PLANNED |
| M4 | Dual-Session End-to-End Workflow & E2E Suite | F27 (and all E2E Tiers 1-4) | M2, M3 | PLANNED |
| M5 | Security Hardening, Deployment & Documentation | F28, F29, F30, F31 | M4 | PLANNED |

## Interface Contracts
### Client / Frontend ↔ Supabase Backend
- `supabase.rpc('post_task', { p_title, p_description, p_category, p_budget, p_latitude, p_longitude })` -> `{ task_id, status }`
- `supabase.rpc('nearby_tasks', { p_latitude, p_longitude, p_radius_meters })` -> `Array<{ id, title, category, budget, distance_meters, created_at }>` (strictly <= 1500m)
- `supabase.rpc('place_bid', { p_task_id, p_amount, p_message })` -> `{ bid_id, status }`
- `supabase.rpc('accept_bid', { p_task_id, p_bid_id })` -> `{ success, escrow_id, otp_code }` (concurrency-safe; row lock on task)
- `supabase.rpc('complete_task', { p_task_id, p_otp_code })` -> `{ success, payout_amount, fee_amount }` (releases escrow)
- `supabase.rpc('cancel_task', { p_task_id, p_reason })` -> `{ success, refund_amount }`
- `supabase.rpc('resolve_dispute', { p_task_id, p_resolution, p_worker_share })` -> `{ success }`
- `supabase.rpc('submit_review', { p_task_id, p_rating, p_comment })` -> `{ review_id, is_revealed }`
- `supabase.rpc('expire_tasks', {})` -> `{ expired_count }`
