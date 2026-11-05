# Handoff Report: Frontend & User Workflows Specification Mining

**Date:** 2026-11-05  
**Agent:** `teamwork_spec_miner` (Frontend, PWA, Leaflet Map, User Workflows)  
**Parent:** `dd373ee0-ea33-4375-bc24-2ece74f17800` (Orchestrator)  
**Status:** Task Complete (Hard Handoff)  

---

## 1. Observation

Authoritative specification sources were directly inspected:

1. **`ORIGINAL_REQUEST.md` (lines 17–44)**:
   > "R3. Frontend Web Application & PWA: Build the requester and worker interfaces using Vite, React (JavaScript), Tailwind CSS, react-router, lucide-react, react-leaflet, and vite-plugin-pwa. Implement registration/login, role-protected routes, PWA manifest, service worker, realtime updates with 3-second polling fallback, and verification across requester and worker sessions (post, bid, accept, OTP, payout). Include the label "Prototype - simulated payments" in Wallet/Profile."

2. **`MASTER_PROMPT.md` (lines 51–58)**:
   > "Phase 4: Vite + React (JavaScript) + Tailwind + react-router + lucide-react + react-leaflet + vite-plugin-pwa. Register/login, role-protected routes, PWA manifest + service worker."
   > "Phase 5: Requester and worker screens exactly as in the plan. Realtime plus 3-second polling fallback. Once Phase 3 is green, build requester UI and worker UI as two parallel subagents in separate git worktrees, then merge. Verify with the browser subagent using two sessions (requester + worker): post, bid, accept, OTP, payout."
   > "Phase 6: ... Add the label 'Prototype - simulated payments' in Wallet/Profile."

3. **`docs/WHAP Implementation Plan.pdf` (Pages 1–8)**:
   - **§1 (p. 1)**: "WHAP is a hyperlocal micro-task marketplace. A requester posts a small chore priced between Rs 50 and Rs 300. Only workers within 1.5 km can see it and send price bids (reverse bidding)... 4-digit OTP... escrow is released to the worker minus a platform fee... reviews stay hidden until both have submitted (double-blind)."
   - **§3 (p. 1)**: "Frontend: React, Vite, Tailwind CSS, react-router, lucide-react, react-leaflet (OpenStreetMap), vite-plugin-pwa. JavaScript, not TypeScript."
   - **§6 (p. 2–3)**: 
     - Search radius: 1.5 km.
     - Task budget: Rs 50 to Rs 300.
     - Bid price: at least Rs 20 and at most 2 times the task budget. One bid per worker per task (a new bid updates the old one while pending).
     - Platform fee: 10% of agreed price, minimum Rs 5, taken from worker payout.
     - Bidding window: 3 minutes. Task expires after 30 minutes with no accepted bid.
     - OTP: 4 digits, valid for 2 hours. After 3 wrong attempts the task becomes DISPUTED.
     - Limits: at most 3 open tasks per requester, at most 1 active job per worker.
     - Wallet: requesters start with Rs 500 demo balance. Wallet balance can never go below 0.
   - **§7 (p. 3)**:
     - Categories: `XEROX_PICKUP`, `BUY_ITEMS`, `CARRY_THINGS`, `QUEUE`, `OTHER`.
     - Roles: `REQUESTER`, `WORKER`, `ADMIN`.
     - Ledger entry types: `TOPUP`, `ESCROW_LOCK`, `ESCROW_REFUND`, `PAYOUT`, `FEE`.
   - **§8 (p. 4)**:
     - All backend operations called via `supabase-js rpc`.
     - `nearby_tasks` sorts by distance using `ST_DWithin`.
     - `accept_bid` locks task row (concurrency-safe), moves money to escrow HELD, creates OTP.
   - **§5 Screens (p. 5–6)**:
     - Requester screens: Home with map and 1.5 km circle; Post task in 3 steps (details, location, budget); Task screen with live bids and Accept button, escrow strip, progress tracker; OTP card, wallet, review screen.
     - Worker screens: Nearby jobs sorted by distance; bid sheet with price stepper; My Bids (pending, accepted, lost); Active job with four OTP digit boxes and Complete button; Earnings and review screen.
     - Realtime updates: Supabase Realtime with 3-second polling fallback.
   - **§12 Limits and Risks (p. 7)**:
     - "Escrow is simulated. Real payments need a licensed provider, so the app must say 'Prototype - simulated payments' in Wallet or Profile."
     - Out of scope: real money, identity checks, chat, voice, photo upload, push notifications, native Play Store app.

4. **Environment Check**:
   - Node: `v24.13.0` (exceeds minimum `>= 20.19`).
   - `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## 2. Logic Chain

1. **Stack Decision**: From Observation 1, 2, and 3 (§3), the tech stack is strictly **Vite + React (JavaScript `.jsx`, NOT TypeScript) + Tailwind CSS + react-router + lucide-react + react-leaflet + vite-plugin-pwa**.
2. **Role & Route Separation**: From Observation 3 (§5, §7), three distinct roles exist (`REQUESTER`, `WORKER`, `ADMIN`). To enable parallel development of requester and worker interfaces (Observation 2 Phase 5), routes must be strictly partitioned with role-guards:
   - `/requester/*` for Requester screens.
   - `/worker/*` for Worker screens.
   - `/admin/*` for dispute resolution.
   - `/login`, `/register` with demo login selectors to facilitate 2-window testing.
3. **Hyperlocal Enforcement**: From Observation 3 (§1, §6, §8), the 1.5 km limit is a core architectural invariant. The Leaflet map must visually render a 1.5 km radius circle around the user's location, and worker queries must pass worker coordinates to `nearby_tasks` which enforces `ST_DWithin`.
4. **State Machine & Concurrency**: From Observation 3 (§6, §8) and Observation 2 (Phase 3, 5), task state transitions are strictly governed:
   - `OPEN` -> `ASSIGNED` -> `COMPLETED` (or `CANCELLED` / `EXPIRED` / `DISPUTED`).
   - Accepting a bid must lock the row to prevent double-acceptance. Frontend must handle concurrency errors cleanly when another accept succeeds first.
5. **Security Isolation for OTP**: From Observation 3 (§3 Security rules: "Only the task's requester can read the OTP", "A worker cannot read the OTP"), the 4-digit OTP is rendered solely in the requester's task screen. The worker screen provides 4 auto-focus input boxes to submit the OTP.
6. **Double-Blind Reviews**: From Observation 3 (§1, §6, §8), reviews submitted by both parties remain unrevealed until both have submitted (or 7 days elapse). The frontend review component must display an explanation of this pending state.
7. **Simulated Payments Notice**: From Observation 1, 2, and 3 (§12), real payments are out of scope. The exact string `"Prototype - simulated payments"` must be rendered prominently in the Wallet and Profile screens.
8. **Realtime & 3s Polling**: From Observation 1, 2, and 3 (§5), Supabase Realtime channel subscriptions must be augmented with an active 3-second polling fallback so that state synchronization across dual browser sessions (requester & worker) never stalls.
9. **PWA Offline & Mobile-First**: From Observation 1, 2, 3 (§2, §3) and 4, `vite-plugin-pwa` must provide web manifest, standalone display mode, caching for static assets and Leaflet OSM tiles, and install prompt support.

---

## 3. Caveats

1. **OpenStreetMap Tile Usage**: Leaflet relies on OpenStreetMap public tile servers. Under offline conditions, tiles are served from Service Worker cache if previously visited; uncached tiles will display a grid if fully offline.
2. **GPS Geolocation in Desktop / Emulators**: Browser geolocation in desktop browsers may return generic ISP coordinates or be denied. A default campus center coordinate fallback (`12.9716, 77.5946`) and manual pin dragging are essential.
3. **Out-of-Scope Exclusions**: Per Implementation Plan §12, real payments, identity checks, real-time in-app chat, voice calls, photo uploads, native push notifications, and native app store builds are explicitly OUT OF SCOPE. No frontend resources should be allocated to these features.

---

## 4. Conclusion

The specification mining for the WHAP Frontend, PWA, Leaflet Map, and User Workflows is complete and fully documented in:
- `d:\WHAP\.agents\teamwork\spec_miner_frontend\analysis.md`

All 20 discovered features and 21 edge case scenarios have been inventoried with exact input/output contracts, error behaviors, and architectural recommendations. The project is ready for spec validation and frontend scaffold implementation.

---

## 5. Verification Method

To independently verify these findings:
1. **Inspect Analysis Report**:
   - File: `d:\WHAP\.agents\teamwork\spec_miner_frontend\analysis.md`
   - Verify that Sections 1–13 cover all points listed in the dispatch assignment.
2. **Verify Against Authoritative Specification**:
   - File: `docs/WHAP Implementation Plan.pdf` (view pages 1 through 8).
   - Confirm business rules: 1.5 km search radius, ₹50-300 budget, ₹20-2x bid limit, 10% fee (min ₹5), 3 open tasks limit, 1 active job limit, 4-digit OTP with 3 wrong attempts dispute trigger, 3-second polling fallback, and `"Prototype - simulated payments"` label.
3. **Verify Environment Readiness**:
   - Command: `node -v` -> ensure output is >= 20.19.
   - Command: `npm view react-leaflet version`, `npm view vite-plugin-pwa version` -> packages resolve correctly.
