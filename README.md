# WHAP — Hyperlocal Micro-Task Marketplace

> **Post any local task, connect with nearby helpers within 1.5 km, and pay safely with OTP verification.**

[![Live App](https://img.shields.io/badge/Live%20App-Vercel-black?logo=vercel)](https://whap-marketplace.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Ashith64%2FWHAP-blue?logo=github)](https://github.com/Ashith64/WHAP)
[![React 18](https://img.shields.io/badge/React-18.3-61dafb?logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20PostGIS-3ecf8e?logo=supabase)](https://supabase.com/)

---

## 1. What is WHAP?

**WHAP** is a neighborhood micro-task web app (and installable PWA) that connects people who need quick local help with people nearby who want to earn money.

Instead of waiting for big delivery apps or paying high fees, anyone can post a small job—like picking up groceries, fixing something at home, moving furniture, waiting in a line, or helping with tech—and people within **1.5 km** of that exact spot can send an offer to do it.

---

## 2. Live Links

- **Live Web App (Vercel)**: https://whap-marketplace.vercel.app
- **Source Code (GitHub)**: https://github.com/Ashith64/WHAP
- **Backend Database**: Supabase (PostgreSQL + PostGIS)

---

## 3. Key Features

- **Live GPS & 1.5 km Geofence**: Automatically detects your real browser location and shows only jobs within **1.5 km** on both a list view and an interactive OpenStreetMap (`Set Area` lets you also pick a spot on the map if GPS is turned off).
- **Post Any Kind of Local Work**: Supports 8 general categories:
  - *Errands & Delivery*
  - *Home & Repairs*
  - *Moving & Lifting*
  - *Cleaning & Chores*
  - *Tech & Setup*
  - *Print & Documents*
  - *Queue & Waiting*
  - *Any Other Work*
- **Easy Mode Switching (Hiring ↔ Working)**: One account can switch anytime between **Hiring Mode** (posting tasks and reviewing offers) and **Working Mode** (finding nearby jobs and earning).
- **Negotiable Offers**: Helpers can propose their own price (within fair guardrails), and task posters can compare offers and ratings before accepting.
- **Safe Escrow & 4-Digit OTP Handover**:
  - When an offer is accepted, the agreed amount is safely locked in escrow.
  - A private 4-digit OTP is shown **only to the task poster**.
  - Payment is released to the helper only after they enter that 4-digit OTP in person (3 wrong tries automatically flag a dispute for admin review).
- **Double-Blind Reviews**: Both sides rate each other after completion, and reviews stay hidden until both people submit (or 7 days pass) so nobody leaves a revenge rating.
- **Simulated Wallet**: Built-in virtual wallet (`Prototype - simulated payments`) with instant top-ups, simulated UPI withdrawals, and a complete transaction history.
- **Installable PWA + Live Updates**: Works smoothly on mobile and desktop with real-time updates (plus automatic 3-second polling fallback if the connection drops).

---

## 4. How It Works (Step-by-Step)

1. **Create an Account**: Sign up with your email, choose **Hire Help** or **Earn Money**, and allow live location access.
2. **Post a Task (Hiring Mode)**: Pick a category, write what you need done, drop/confirm the pin on the map, and set a budget (₹50–₹300).
3. **Find & Offer (Working Mode)**: Nearby helpers within 1.5 km see the job on their map/feed and submit an offer.
4. **Accept & Lock Escrow**: The poster picks an offer—funds move into escrow and a 4-digit OTP is generated.
5. **Complete & Get Paid**: Once the job is done in person, the helper enters the 4-digit OTP, confetti celebrates completion, and the wallet updates instantly (minus a 10% platform fee, minimum ₹5).
6. **Review Each Other**: Both users leave a 1–5 star review.

---

## 5. Everything We Built, Fixed & Upgraded

Here is a summary of everything completed in this project from start to deployment:

1. **Database & Security Foundation (Supabase + PostGIS)**:
   - Built 9 PostgreSQL tables (`profiles`, `wallets`, `tasks`, `bids`, `escrow_transactions`, `ledger_entries`, `reviews`, `notifications`, `config`) with spatial indexes and Row Level Security (RLS).
   - Built 9 secure database functions (`post_task`, `nearby_tasks`, `place_bid`, concurrency-safe `accept_bid` with row locking, `complete_task`, `cancel_task`, `resolve_dispute`, `submit_review`, and `expire_tasks`).
2. **Generalized Beyond College**:
   - Removed all college/campus-only wording and expanded database + UI categories so anyone can post any kind of local work anywhere.
3. **Clean Sign-In & Registration**:
   - Removed all 1-click demo login bars and hardcoded test accounts for a clean, real user experience.
4. **Live Geolocation & Bug Fixes**:
   - Replaced hardcoded fallback coordinates with a dedicated `useGeolocation` hook so dashboards, maps, registration, task posting, and offer placement all use real live GPS.
   - Fixed category icons across detail and active-job screens, optimized Realtime vs. polling background sync, and cleaned up leftover copy.
5. **Natural Language & UI Polish**:
   - Replaced technical labels with clear terms (**Hiring** / **Working**, **My Posted Tasks**, **Find Local Jobs**, **Make Offer**).
   - Added **Plus Jakarta Sans** typography, shimmer skeleton loaders, and smooth card transitions.
6. **Cloud Deployment & Keep-Alive Automation**:
   - Deployed the frontend to **Vercel** (`https://whap-marketplace.vercel.app`) with publishable Supabase environment variables only.
   - Added a GitHub Actions workflow (`.github/workflows/keep-alive.yml`) that pings Supabase every 3 days so the free-tier database never pauses.

---

## 6. Tech Stack

- **Frontend**: React 18, Vite 5, Tailwind CSS, React Router, Lucide Icons
- **Maps & Location**: Leaflet, React-Leaflet, OpenStreetMap, Browser Geolocation API
- **Backend & Auth**: Supabase (PostgreSQL 15+, PostGIS, GoTrue Auth, Realtime)
- **Offline / PWA**: `vite-plugin-pwa` (Workbox service worker)
- **Hosting & CI**: Vercel (Frontend), GitHub Actions (Keep-Alive)

---

## 7. How to Run Locally on Any Laptop

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Ashith64/WHAP.git
   cd WHAP
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Create `.env.local`** in the project root with your publishable Supabase keys:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
4. **Start the app**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173/` in your browser.

---

## 8. Testing & Security Summary

All core flows, security rules, and UI checks are covered by automated tests:

- **Backend & Concurrency Suite** (`npm test` — `tests/whap.test.js`): **24 / 24 passing** (all 9 RPCs, 1.5 km boundary checks, 2-accept race condition lock, 100-request load test, and 5 security break tests).
- **Dual-Session End-to-End Flow** (`npm run test:e2e`): **12 / 12 passing** (full lifecycle from posting to payout and zero-leakage ledger verification).
- **Frontend Integrity** (`node tests/test_frontend_integrity.js`): **21 / 21 passing**.
- **Business Rules** (`node tests/test_ui_business_rules.js`): **17 / 17 passing**.
