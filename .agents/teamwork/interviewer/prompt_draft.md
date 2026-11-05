Use the GENERAL DISTRIBUTED CODING execution path with multiple specialized agents working concurrently on independent tasks (Explorers, Workers, Project Orchestrator, Critic, Challenger, Auditor and Success Auditor as appropriate). Complete the existing WHAP (Wagers Hiring Application Platform) project inside D:\WHAP end-to-end as a functional prototype with live deployment and simulated payments, following MASTER_PROMPT.md and docs/WHAP Implementation Plan.pdf.

Working directory: D:\WHAP
Integrity mode: development

Reference material:
- D:\WHAP\MASTER_PROMPT.md
- D:\WHAP\docs\WHAP Implementation Plan.pdf

## Requirements

### R1. Repository Setup & Environment Integrity
Maintain D:\WHAP as the canonical project directory without creating replacement repositories or duplicate project folders. Automatically create .gitignore if missing (ignoring .env* and node_modules). Automatically correct the stale PDF path in MASTER_PROMPT.md to match the actual existing PDF ("docs/WHAP Implementation Plan.pdf") without moving or duplicating the file. Preserve the existing .env.local and all credentials; inspect variable presence and verify remote Supabase connectivity without displaying secret values or committing them. Only stop for genuinely necessary account authentication (Supabase, GitHub, Vercel) or missing credentials.

### R2. Backend Data Model and Business Logic
Execute SQL migrations and seed data in Supabase (PostGIS, tables, GiST/FK/status indexes, CHECK constraints, RLS on every table, wallet/escrow writable only via functions). Implement backend functions with tests in tests/whap.test.js: post_task, nearby_tasks, place_bid, accept_bid (concurrency-safe with row locking), complete_task, cancel_task, resolve_dispute, submit_review, and expire_tasks, storing configuration values in a config table rather than hard-coding. Do not mock critical functionality, fabricate test results, or weaken tests.

### R3. Frontend Web Application & PWA
Build the requester and worker interfaces using Vite, React (JavaScript), Tailwind CSS, react-router, lucide-react, react-leaflet, and vite-plugin-pwa. Implement registration/login, role-protected routes, PWA manifest, service worker, realtime updates with 3-second polling fallback, and verification across requester and worker sessions (post, bid, accept, OTP, payout). Include the label "Prototype - simulated payments" in Wallet/Profile.

### R4. Security Hardening, Deployment, & Keep-Alive
Enforce and test security boundaries so that unauthorized users cannot read another user's data, workers cannot read OTPs, and wallets cannot be modified directly. Deploy the frontend to Vercel using environment variables (publishable key only), push code to GitHub, and set up a GitHub Action keep-alive that calls the Supabase API every few days. Produce README.md, PROJECT_EXPLAINED.md, DEMO_SCRIPT.md, and FINAL_REPORT.md verifying each phase against the Definition of Done.

## Acceptance Criteria

### Environment & Repository Setup
- [ ] D:\WHAP is preserved as the canonical workspace with .gitignore ignoring .env* and node_modules, and no secrets committed.
- [ ] Stale PDF reference in MASTER_PROMPT.md is corrected to "docs/WHAP Implementation Plan.pdf" without moving or duplicating the PDF.
- [ ] Supabase connection is verified using .env.local credentials without exposing secret values.

### Backend & Business Logic Verification
- [ ] SQL migrations and seed data are pushed to remote Supabase with RLS enabled on all tables.
- [ ] Gate verification passes proving a worker cannot see tasks beyond 1.5 km, even by id.
- [ ] All functions in tests/whap.test.js pass, including concurrency test with 2 simultaneous accepts and 100-request nearby_tasks load test with timings.

### Frontend & End-to-End Workflow
- [ ] Frontend builds cleanly with Vite, React, Tailwind, Leaflet map, and PWA manifest/service worker.
- [ ] End-to-end workflow (task posting, bidding, concurrency-safe acceptance, OTP completion, wallet payout) is verified across requester and worker roles.
- [ ] Prototype simulated payments label is visible in Wallet/Profile.

### Security, Deployment & Documentation
- [ ] Security break attempts fail (accessing other users' data, reading worker OTPs, direct wallet mutations).
- [ ] Frontend is deployed to Vercel with publishable key and verified accessible.
- [ ] GitHub repository contains clean commits, and GitHub Actions keep-alive workflow is active.
- [ ] README.md, PROJECT_EXPLAINED.md, DEMO_SCRIPT.md, and FINAL_REPORT.md are fully written with command outputs saved in evidence files.
