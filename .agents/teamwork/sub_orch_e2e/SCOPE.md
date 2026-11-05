# Scope: E2E Testing Track

## Test Philosophy
- Opaque-box, requirement-driven E2E test suite.
- Derived from `ORIGINAL_REQUEST.md`, `MASTER_PROMPT.md`, `docs/WHAP Implementation Plan.pdf`, and `TEST_INFRA.md`.
- No internal code dependencies; test product entry points (database RPCs, REST endpoints, UI interactions).

## Feature Inventory Coverage Map
All 31 features mapped across 4 tiers per `TEST_INFRA.md`.

## Deliverables
1. Automated backend test runner script in `tests/whap.test.js`:
   - Concurrency race test (2 simultaneous accepts -> exactly 1 succeeds, 1 fails).
   - 100-request `nearby_tasks` load test with latency measurement.
   - Spatial boundary tests (1500m geofence isolation).
   - OTP verification (3 wrong attempts lock into DISPUTED).
   - Full lifecycle test (post -> bid -> accept -> OTP -> complete -> review).
2. Opaque-box E2E test harness for browser/API dual-session testing.
3. Signal completion by generating `TEST_READY.md` at project root (`d:\WHAP\.agents\teamwork\TEST_READY.md` or `d:\WHAP\TEST_READY.md`).
