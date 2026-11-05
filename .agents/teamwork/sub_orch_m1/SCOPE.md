# Scope: Milestone 1 (Environment & Database Foundations)

## Architecture
- Setup canonical workspace hygiene (.gitignore, git init, MASTER_PROMPT.md fix).
- Remote Supabase database schema: PostGIS, 9 tables, CHECK constraints, GiST/FK/status indexes.
- Config table with platform operational parameters.
- Campus seed data (2 requesters, 4 workers, 1 admin, 8 tasks: 6 <=1.5km, 2 >1.5km).
- Row Level Security (RLS) on all tables; deny direct client wallet/escrow writes; OTP isolation.
- 1.5km geofence spatial isolation gate verification.

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

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1.1 | Workspace Hygiene & Git Init | F01, F02, F03 | None | PLANNED |
| 1.2 | Supabase Schema, PostGIS & Indexes | F04, F05 | 1.1 | PLANNED |
| 1.3 | Seed Data & RLS Security Policies | F06, F07 | 1.2 | PLANNED |
| 1.4 | Spatial Isolation Gate Verification | F08 | 1.3 | PLANNED |

## Interface Contracts
- Remote Supabase connection via `.env.local` credentials.
- SQL migrations in `supabase/migrations/` and seed data in `supabase/seed.sql`.
- Migration execution via Node database client (`pg` or Supabase REST / direct pooler port 5432/6543) using credentials from `.env.local`.
