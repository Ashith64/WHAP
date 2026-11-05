# Dispatch to teamwork_spec_miner (Backend & Data Model)

You are teamwork_spec_miner specializing in Backend, Data Model, RLS, and Business Logic specifications.
Your working directory is: d:\WHAP\.agents\teamwork\spec_miner_backend\

## Objective
Read ORIGINAL_REQUEST.md (at d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md), MASTER_PROMPT.md (at d:\WHAP\MASTER_PROMPT.md), and docs/WHAP Implementation Plan.pdf (at d:\WHAP\docs\WHAP Implementation Plan.pdf).
Mine all backend, database, PostGIS, RLS, RPC functions, indexes, CHECK constraints, and business logic requirements.

## Requirements to Investigate
1. Database tables, columns, constraints, foreign keys, status enums.
2. PostGIS setup and spatial queries (specifically nearby_tasks, distance calculations, 1.5 km boundaries).
3. Row Level Security (RLS) policies for every table (requester, worker, public/anon, direct wallet/escrow protection).
4. Stored procedures / RPC functions required:
   - post_task
   - nearby_tasks
   - place_bid
   - accept_bid (concurrency safety, row locking, escrow deduction)
   - complete_task (OTP verification, escrow release, wallet update)
   - cancel_task
   - resolve_dispute
   - submit_review
   - expire_tasks
5. Config table requirements for platform parameters (platform fee %, distance radius, expiration timers, etc.).
6. Test cases expected in tests/whap.test.js (concurrency test, 100-request load test, gate checks).

## Deliverable
Write your comprehensive analysis and specification extraction to:
d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md
and a complete handoff report to:
d:\WHAP\.agents\teamwork\spec_miner_backend\handoff.md

Report back when complete.


## 2026-11-05T16:00:18Z
You are teamwork_spec_miner specializing in Backend, Data Model, RLS, and Business Logic specifications.
Your working directory is: d:\WHAP\.agents\teamwork\spec_miner_backend\
Your parent is: dd373ee0-ea33-4375-bc24-2ece74f17800 (orchestrator)

Read:
- ORIGINAL_REQUEST.md at d:\WHAP\.agents\teamwork\ORIGINAL_REQUEST.md
- MASTER_PROMPT.md at d:\WHAP\MASTER_PROMPT.md
- docs/WHAP Implementation Plan.pdf at d:\WHAP\docs\WHAP Implementation Plan.pdf
- DISPATCH.md at d:\WHAP\.agents\teamwork\spec_miner_backend\DISPATCH.md

Investigate and extract all backend specifications:
1. Schema: PostGIS, tables, columns, data types, GiST/FK/status indexes, CHECK constraints.
2. Row Level Security: Policies per table (requester, worker, public/anon), wallet/escrow protection rules.
3. RPC Stored Procedures & Business Logic: post_task, nearby_tasks (with 1.5km limit), place_bid, accept_bid (row locking, concurrency safety), complete_task (OTP, escrow release, wallet update), cancel_task, resolve_dispute, submit_review, expire_tasks.
4. Configuration: config table structure and platform parameters.
5. Tests: requirements for tests/whap.test.js including concurrency tests and 100-request load test.

Write your findings to:
- d:\WHAP\.agents\teamwork\spec_miner_backend\analysis.md
- d:\WHAP\.agents\teamwork\spec_miner_backend\handoff.md

Send a message to your parent when done.
