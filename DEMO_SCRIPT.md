# WHAP Evaluator Testing Guide & Demo Script

This document provides a guided walkthrough for evaluators, judges, and developers to test all features of the **WHAP** platform.

---

## 1. Quick-Start & Evaluator Setup

### Live URLs
- **GitHub Repository**: `https://github.com/Ashith64/WHAP`
- **Backend API**: `https://cmszsqdxztvtkwpzbvmr.supabase.co`
- **Frontend Web Application**: Local dev server (`http://localhost:5173`) or Vercel deployed instance.

### Recommended Evaluator Setup (Dual Windows)
For the best evaluation experience, open two side-by-side browser windows:
- **Window A (Left)**: Standard browser window — Logged in as **Requester 1 (Rahul)**
- **Window B (Right)**: Incognito / Private window — Logged in as **Worker 1 (Amit)**

> **Tip**: Use the **Sticky 1-Click Demo Accounts Bar** at the top of the page. Clicking any demo account badge instantly switches sessions without entering credentials.

---

## 2. Core Evaluation Scenarios

### Scenario 1: The Complete Happy Path Chore Lifecycle
*Time to complete: ~3 minutes*

#### Step 1: Requester Posts a Task (Window A)
1. In Window A, click **Req 1 (Rahul)** in the Demo Bar.
2. Note your starting wallet balance (e.g., ₹500.00).
3. Click the **"Post a Task"** button or navigate to `/requester/post-task`.
4. Enter task details:
   - **Title**: `Nesara Xerox Notes Delivery`
   - **Category**: `XEROX_PICKUP`
   - **Budget**: `₹80.00` (must be between ₹50 and ₹300)
   - **Description**: `Pick up 5 copies of ML notes from Nesara Xerox and bring to CSA Room 102.`
   - **Location**: Use default campus pin or drag pin on map.
5. Click **"Publish Task"**.
6. **Observation**: Task appears immediately on the Requester Dashboard with status **OPEN**.

#### Step 2: Worker Discovers Chore on Campus Map (Window B)
1. In Window B, click **Wrk 1 (Amit)** in the Demo Bar.
2. Navigate to the **Worker Dashboard** (`/worker`).
3. **Observation**:
   - The interactive Leaflet map displays a 1.5 km blue circle around your location.
   - The newly posted task `Nesara Xerox Notes Delivery` appears in the nearby feed sorted by distance (~15m).
   - Note that the completion OTP is completely hidden.

#### Step 3: Worker Places Reverse Bid (Window B)
1. Click on the task card to open **Task Details**.
2. Observe the budget is ₹80.00.
3. In the reverse bidding box, enter **₹75.00** (or use `-`/`+` stepper).
4. Click **"Submit Bid"**.
5. **Observation**: Status changes to *"Bid Placed: ₹75.00 (Pending)"*.

#### Step 4: Requester Reviews & Accepts Bid (Window A)
1. Return to Window A (Requester).
2. The live bid updates via Supabase Realtime / 3-second polling.
3. Open the task detail view to inspect the **Live Bids Drawer**.
4. Observe Worker 1 (Amit) with bid ₹75.00.
5. Click **"Accept Bid"**.
6. **Observation**:
   - Requester wallet balance immediately decrements by ₹75.00 (e.g. ₹500 → ₹425).
   - Task status changes to **ASSIGNED**.
   - A prominent **Completion OTP Card** appears displaying a 4-digit code (e.g. `6760`).
   - Instructions state: *"Share this code with the worker only after the task is completed in person."*

#### Step 5: Worker Completes Chore & Submits OTP (Window B)
1. In Window B, navigate to the **Active Job** tab (`/worker/active` or task detail).
2. Observe that the job is now active at agreed price ₹75.00.
3. Notice the worker interface has 4 numeric OTP input boxes. The worker cannot view the code.
4. Enter the 4-digit code displayed in Window A.
5. Click **"Verify & Complete Task"**.
6. **Observation**:
   - Confetti animation celebrates task completion!
   - Task status transitions to **COMPLETED**.
   - Navigate to Worker Wallet (`/wallet`): Worker balance is credited ₹67.50 (₹75 agreed minus 10% platform fee of ₹7.50).

#### Step 6: Double-Blind Mutual Reviews
1. In Window A (Requester), rate Worker 1: 5 stars, *"Excellent service!"*.
2. Notice the review is submitted, but not yet publicly displayed.
3. In Window B (Worker), rate Requester 1: 5 stars, *"Great communication!"*.
4. **Observation**: Upon the second review submission, both reviews instantly unlock and appear on public profiles with updated rating averages!

---

### Scenario 2: Security & OTP Failure Dispute Flow
*Time to complete: ~2 minutes*

1. Worker enters incorrect OTP (e.g., `0000`):
   - Warning displayed: *"Invalid OTP. Attempt 1 of 3."*
2. Worker enters incorrect OTP again (`1111`):
   - Warning displayed: *"Invalid OTP. Attempt 2 of 3."*
3. Worker enters incorrect OTP a 3rd time (`2222`):
   - System locks the task: *"Invalid OTP. Task marked as DISPUTED."*
4. Switch to **Campus Admin** via Demo Bar (`admin@whap.local`).
5. Navigate to `/admin`.
6. Inspect the **Dispute Resolution Panel**:
   - Review dispute history and escrow amount.
   - Choose: **"Refund Requester"** or **"Release to Worker"** or **"Split Escrow"**.
   - Click **"Execute Resolution"** -> Funds are dispatched, ledger entries recorded, and dispute is closed.

---

### Scenario 3: 1.5 km Geofence Isolation Verification
1. Log in as **Deepa Worker (Sports Ground)** or inspect seed tasks located outside the campus perimeter (> 1.5 km, e.g. Metro Station at 3.2 km).
2. Confirm that distant tasks are completely omitted from the feed.
3. Direct UUID querying of distant tasks via PostgREST returns 0 rows.

---

### Scenario 4: Simulated Payment Notice & Wallet Top-up
1. Navigate to `/wallet`.
2. Verify the prominent disclaimer banner: *"Prototype - simulated payments"*.
3. Click **"+ Top Up ₹100"** to simulate virtual wallet balance injection.
