# WHAP — Wagers Hiring Application Platform
> **Hyperlocal Zero-Cost Micro-Task Campus Marketplace**  
> *Operates within a strict 1.5 km geographic radius with atomic escrow, concurrency-safe bidding, and double-blind reputation.*

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.19-green.svg)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18.3.1-blue.svg)](https://react.dev/)
[![Vite 5](https://img.shields.io/badge/Vite-5.4.11-purple.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.15-38bdf8.svg)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%2015%2B-3ecf8e.svg)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Workbox%20Offline-orange.svg)](https://vite-pwa-org.netlify.app/)
[![Tests](https://img.shields.io/badge/Tests-24%2F24%20Pass-success.svg)](./FINAL_REPORT.md)

---

## 1. Executive Summary & Problem Statement

On university and institutional campuses, students and staff face frequent micro-chore friction: picking up Xerox photocopies, standing in canteen queues, fetching packages from campus security gates, or transporting lab equipment between buildings. Commercial delivery platforms fail on campuses due to high minimum order fees, slow vehicular transit, and gate access barriers.

**WHAP** solves this by establishing a zero-friction peer-to-peer campus task marketplace:
- **Strict 1.5 km Geofencing**: All tasks and bids are mathematically restricted to a 1.5 km radius using PostGIS spatial indexing.
- **Reverse Bidding**: Workers compete for tasks with transparent pricing bounded by platform guardrails (₹20 floor, max 2x budget).
- **Concurrency-Safe Escrow**: Funds are locked using 3-level database row locks (`FOR UPDATE`), eliminating double-spend and race conditions.
- **In-Person OTP Handover**: Payouts are released only when the worker physically enters the requester's 4-digit numeric OTP.
- **Double-Blind Reviews**: Ratings remain completely hidden until both parties review or 7 days elapse, preventing retaliatory scores.
- **Simulated Payments**: High-fidelity prototype with virtual wallet management labeled *"Prototype - simulated payments"*.

---

## 2. Core Architecture & Tech Stack

### System Architecture Flow
```
[ Client Browser / PWA ] 
       │
       ▼  (HTTPS / WSS - Publishable Anon Key Only)
[ Supabase PostgREST & Realtime Gateway ]
       │
       ▼  (Row Level Security & PostgreSQL 15 Engine)
[ PostgreSQL + PostGIS (SRID 4326) ]
  ├── Stored Procedures (SECURITY DEFINER with FOR UPDATE row locks)
  ├── 9 Tables with CHECK constraints & GiST Spatial Indexes
  ├── Double-Entry Financial Ledger (wallets, escrow_transactions, ledger_entries)
  └── Masked Views (tasks_view with OTP security invoker)
```

### Technology Matrix
- **Frontend Framework**: React 18.3 (JavaScript JSX), Vite 5.4, React Router DOM 6.28
- **Styling & UI**: Tailwind CSS 3.4, Lucide React icons, Canvas Confetti
- **Mapping & Geolocation**: Leaflet 1.9, React-Leaflet 4.2 (OpenStreetMap tiles with 30-day offline cache)
- **PWA / Service Worker**: `vite-plugin-pwa` with Workbox 7 runtime caching
- **Backend & Database**: Supabase PostgreSQL 15+, PostGIS spatial extension, GoTrue Auth (ES256 Bearer JWTs), Realtime replication
- **CI / Keep-Alive**: GitHub Actions automated 3-day cron pinging the Supabase REST API
- **Deployment**: Vercel Single-Page Application (SPA)

---

## 3. Live Deployment & Evaluator Access

- **GitHub Repository**: [https://github.com/Ashith64/WHAP](https://github.com/Ashith64/WHAP)
- **Supabase Remote Project**: `https://cmszsqdxztvtkwpzbvmr.supabase.co`
- **Live Web Application**: Vercel Single Page Application (`scripts/verify_live_deployment.js`)

> **Evaluator Convenience**: The application features a **Sticky 1-Click Demo Accounts Bar** pinned at the top of every screen. Evaluators can switch between Requesters, Workers, and Admin with a single click—no password typing required!

---

## 4. Pre-Seeded Campus Demo Accounts (IISc Bangalore Reference)

| Persona / Name | Role | Email | Password | Coordinates / Location | Starting Balance | Purpose / Testing Use Case |
|---|---|---|---|---|---|---|
| **Rahul Requester** | `REQUESTER` | `requester_1@whap.local` | `whap_demo_password_123` | `13.0184, 77.5684` (Eng Dept) | ₹500.00 | Post tasks, review incoming bids, test OTP issuance |
| **Priya Requester** | `REQUESTER` | `requester_2@whap.local` | `whap_demo_password_123` | `13.0190, 77.5690` (Bio Dept) | ₹500.00 | Parallel task poster, multi-requester concurrency |
| **Amit Worker** | `WORKER` | `worker_1@whap.local` | `whap_demo_password_123` | `13.0185, 77.5685` (Main Gate, ~15m) | ₹0.00 | Primary worker; discover tasks, submit bids, enter OTP |
| **Sneha Worker** | `WORKER` | `worker_2@whap.local` | `whap_demo_password_123` | `13.0210, 77.5700` (Library, ~350m) | ₹0.00 | Competing bidder; test concurrency race conditions |
| **Karthik Worker** | `WORKER` | `worker_3@whap.local` | `whap_demo_password_123` | `13.0240, 77.5750` (Hostel, ~950m) | ₹0.00 | Mid-distance worker; test spatial distance ordering |
| **Deepa Worker** | `WORKER` | `worker_4@whap.local` | `whap_demo_password_123` | `13.0120, 77.5600` (Sports, ~1200m) | ₹0.00 | Edge-distance worker; boundary limit testing |
| **Campus Admin** | `ADMIN` | `admin@whap.local` | `whap_admin_password_123` | `13.0184, 77.5684` (Admin Office) | ₹0.00 | Adjudicate disputes, refund or release escrow funds |

---

## 5. Local Quickstart Guide

### Prerequisites
- Node.js >= 20.19.0
- npm >= 10.0.0

### Installation
```bash
# 1. Clone repository
git clone https://github.com/Ashith64/WHAP.git D:\WHAP
cd D:\WHAP

# 2. Install dependencies
npm install

# 3. Verify .env.local configuration
# Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present
```

### Running Locally
```bash
# Start Vite development server
npm run dev
# Open http://localhost:5173
```

### Production Build & PWA Generation
```bash
npm run build
npm run preview
```

---

## 6. Automated Test Suite Execution

WHAP includes an extensive automated test suite validating business logic, race conditions, and spatial boundaries:

```bash
# 1. Full Regression Test Suite (24 tests across 6 suites)
npm test

# 2. Dual-Session End-to-End Simulation (12 sequential steps, 104 assertions)
npm run test:e2e

# 3. Security Penetration Break Tests (5 RLS & boundary vectors)
node --test --test-name-pattern="Security Break" tests/whap.test.js

# 4. Frontend Integrity & Adversarial Validation (21 tests across 6 suites)
node tests/test_frontend_integrity.js

# 5. UI Business Rules & Edge Cases (17 tests across 5 suites)
node tests/test_ui_business_rules.js
```

---

## 7. Documentation Suite Index
- **[PROJECT_EXPLAINED.md](./PROJECT_EXPLAINED.md)**: Comprehensive architectural deep dive on PostGIS geofencing, row locking, double-entry financial ledger, and penetration defense.
- **[DEMO_SCRIPT.md](./DEMO_SCRIPT.md)**: Step-by-step evaluator testing guide with dual-window setup, OTP verification, dispute flows, and edge cases.
- **[FINAL_REPORT.md](./FINAL_REPORT.md)**: Forensic verification audit report across Milestones 1–5 with test logs and Definition of Done sign-offs.
