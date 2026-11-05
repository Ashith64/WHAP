# E2E Test Infra: WHAP (Wagers Hiring Application Platform)

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md`, `MASTER_PROMPT.md`, and `docs/WHAP Implementation Plan.pdf`.
- Methodology: Category-Partition, Boundary Value Analysis (BVA), Pairwise Combinatorial Testing, and Dual-Session Workload Testing.
- Zero mocking of critical functionality; zero fabrication of test results.

## Feature Inventory Coverage Map
| # | Feature | Source (Requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|----------------------|:------:|:------:|:------:|
| F01 | Environment & Git Baseline | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |
| F02 | MASTER_PROMPT Correction | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |
| F03 | Supabase Connectivity Check | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |
| F04 | Database Schema & PostGIS | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F05 | Config Table & Parameters | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F06 | Seed Data Verification | MASTER_PROMPT Phase 2 | 5 | 5 | ✓ |
| F07 | RLS Security Policies | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F08 | 1.5km Spatial Isolation Gate | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F09 | post_task RPC | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F10 | nearby_tasks RPC | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F11 | place_bid RPC | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F12 | accept_bid RPC (Row Locked) | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F13 | complete_task RPC (OTP) | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F14 | cancel_task RPC | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F15 | resolve_dispute RPC | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F16 | submit_review RPC | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F17 | expire_tasks RPC | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F18 | Concurrency & Load Tests | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| F19 | Frontend Build & Layout | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F20 | Role-Protected Routing | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F21 | Leaflet Map & 1.5km Geofence | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F22 | Requester Workflow UI | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F23 | Worker Workflow UI | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F24 | Simulated Wallet & Notice | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F25 | Realtime & Polling Fallback | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F26 | PWA Manifest & SW Caching | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F27 | Dual-Session Workflow | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F28 | Penetration Hardening | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ |
| F29 | Vercel Live Deployment | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ |
| F30 | GitHub Repo & Keep-Alive | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ |
| F31 | Project Documentation | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ |

## Test Architecture
- **Backend Test Runner**: `tests/whap.test.js` executed via Node.js native test runner (`node --test tests/whap.test.js`).
- **Load Test**: 100 simultaneous calls to `nearby_tasks` measuring latency percentiles (p50, p95, p99) and error rate (must be 0%).
- **Concurrency Test**: 2 simultaneous promises executing `accept_bid` for the same task; verifies exactly 1 succeeds, 1 fails with concurrency error, escrow held once.
- **Spatial Gate Test**: Worker queries task at distance 1501 meters directly by ID; must return 0 rows.
- **Frontend E2E Test Runner**: Dual-session browser flow via Playwright / Node script executing requester and worker steps concurrently.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Campus Xerox Pickup: Requester posts ₹70 chore; 2 workers bid (₹60, ₹65); requester accepts ₹60; worker enters correct OTP; escrow releases ₹54 to worker and ₹6 fee; both leave 5-star review | F09-F13, F16, F21-F25 | High |
| 2 | Bidding Race & Row Lock: Two workers bid; requester attempts simultaneous double-click accept; only first succeeds; second receives clean error | F11, F12, F18, F22 | High |
| 3 | OTP Lockout Dispute: Worker enters 3 incorrect OTPs; task transitions to DISPUTED; admin intervenes via `resolve_dispute` | F12, F13, F15, F20 | High |
| 4 | Geofence Rejection: Worker at 2.1 km attempts to browse or bid on task; query returns empty, direct bid fails with out-of-range error | F08, F10, F11, F21 | Medium |
| 5 | Task Cancellation & Full Refund: Requester posts ₹200 chore, cancels before assignment; wallet refunded ₹200; ledger records refund | F09, F14, F24 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature (where boundaries exist)
- Tier 3: Pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
