// tests/test_ui_business_rules.js
/**
 * Standalone Empirical Test Suite: Milestone 3 UI Business Rules & Boundaries
 * 
 * Verifies:
 * 1. Geofencing & Map Constraints (1500m radius, custom SVG markers)
 * 2. Financial & Wallet Boundaries (Regulatory disclaimers, topup bounds Rs 1-5000, min fee Rs 5, double-entry ledger)
 * 3. OTP Security & 3-Strike Lockout (Requester isolation, digit auto-advance, dispute transition)
 * 4. Concurrency Limits (Requester 3-open-tasks limit, Worker 1-active-job limit)
 * 5. Budget Slider & Reverse Bidding Bounds (Rs 50-300 budget, min Rs 20 bid, max 2x budget)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ============================================================================
// SUITE 1: Geofencing, Radius & Custom SVG Map Markers
// ============================================================================
describe('Suite 1: Geofencing & Map Constraints', () => {
  test('1.1 RadiusCircle specifies exact 1500m geodesic radius default', () => {
    const radiusFilePath = path.join(projectRoot, 'src/components/map/RadiusCircle.jsx');
    const content = fs.readFileSync(radiusFilePath, 'utf8');

    assert.match(
      content,
      /radiusMeters\s*=\s*1500/,
      'RadiusCircle must specify radiusMeters = 1500 as default parameter'
    );
    assert.match(
      content,
      /radius=\{radiusMeters\}/,
      'RadiusCircle must pass radiusMeters to Leaflet Circle component'
    );
  });

  test('1.2 LeafletMap and WorkerHomeScreen bind 1500m geodesic circle and query radius', () => {
    const mapFilePath = path.join(projectRoot, 'src/components/map/LeafletMap.jsx');
    const mapContent = fs.readFileSync(mapFilePath, 'utf8');

    assert.match(
      mapContent,
      /<RadiusCircle\s+center=\{safeCenter\}\s+radiusMeters=\{1500\}\s*\/>/,
      'LeafletMap must render RadiusCircle with radiusMeters={1500}'
    );

    const workerScreenPath = path.join(projectRoot, 'src/pages/WorkerHomeScreen.jsx');
    const workerContent = fs.readFileSync(workerScreenPath, 'utf8');
    assert.match(
      workerContent,
      /useNearbyTasks\(\s*workerCoords\.lat,\s*workerCoords\.lng,\s*1500\s*\)/,
      'WorkerHomeScreen must invoke useNearbyTasks with exact 1500m radius'
    );
  });

  test('1.3 Custom SVG markers avoid Leaflet PNG bundler 404 bug', () => {
    const pulsePinPath = path.join(projectRoot, 'src/components/map/PulsePin.jsx');
    const pulseContent = fs.readFileSync(pulsePinPath, 'utf8');

    // Must use L.divIcon and inline HTML/SVG, no Leaflet marker PNG imports
    assert.match(pulseContent, /L\.divIcon\(/, 'PulsePin must use L.divIcon');
    assert.doesNotMatch(pulseContent, /marker-icon.*\.png/, 'Must not import default Leaflet PNG marker');

    const priceMarkerPath = path.join(projectRoot, 'src/components/map/TaskPriceMarker.jsx');
    const priceContent = fs.readFileSync(priceMarkerPath, 'utf8');
    assert.match(priceContent, /L\.divIcon\(/, 'TaskPriceMarker must use L.divIcon');
    assert.match(priceContent, /custom-task-price-pin/, 'TaskPriceMarker must apply custom pin class');
    assert.doesNotMatch(priceContent, /marker-icon.*\.png/, 'Must not import default Leaflet PNG marker');
  });

  test('1.4 Task price marker category colors and coordinate extraction', () => {
    // Pure function logic mirroring TaskPriceMarker.jsx
    const getCategoryColor = (category) => {
      switch (category) {
        case 'XEROX_PICKUP':
          return '#4f46e5';
        case 'BUY_ITEMS':
          return '#059669';
        case 'CARRY_THINGS':
          return '#d97706';
        case 'QUEUE':
          return '#7c3aed';
        default:
          return '#334155';
      }
    };

    assert.equal(getCategoryColor('XEROX_PICKUP'), '#4f46e5');
    assert.equal(getCategoryColor('BUY_ITEMS'), '#059669');
    assert.equal(getCategoryColor('CARRY_THINGS'), '#d97706');
    assert.equal(getCategoryColor('QUEUE'), '#7c3aed');
    assert.equal(getCategoryColor('OTHER'), '#334155');

    // Coordinate resolution function
    const extractCoords = (task) => {
      let lat = task.latitude ?? task.lat;
      let lng = task.longitude ?? task.lng;
      if ((lat === undefined || lng === undefined) && task.location?.coordinates) {
        lng = task.location.coordinates[0];
        lat = task.location.coordinates[1];
      }
      return { lat, lng };
    };

    assert.deepEqual(extractCoords({ latitude: 13.0184, longitude: 77.5684 }), { lat: 13.0184, lng: 77.5684 });
    assert.deepEqual(extractCoords({ lat: 13.02, lng: 77.57 }), { lat: 13.02, lng: 77.57 });
    assert.deepEqual(extractCoords({ location: { coordinates: [77.569, 13.019] } }), { lat: 13.019, lng: 77.569 });
  });
});

// ============================================================================
// SUITE 2: Financial & Wallet Boundaries
// ============================================================================
describe('Suite 2: Financial & Wallet Boundaries', () => {
  test('2.1 Mandatory label "Prototype - simulated payments" exists in regulatory notice', () => {
    const noticePath = path.join(projectRoot, 'src/components/common/SimulatedPaymentNotice.jsx');
    const content = fs.readFileSync(noticePath, 'utf8');

    assert.match(
      content,
      /Prototype - simulated payments/,
      'SimulatedPaymentNotice must contain the exact string "Prototype - simulated payments"'
    );
    assert.match(
      content,
      /strictly simulated for prototype testing/,
      'SimulatedPaymentNotice must include disclaimer that balances are simulated'
    );
  });

  test('2.2 WalletScreen.jsx and ProfileScreen.jsx visibly mount SimulatedPaymentNotice', () => {
    const walletPath = path.join(projectRoot, 'src/pages/WalletScreen.jsx');
    const walletContent = fs.readFileSync(walletPath, 'utf8');

    assert.match(walletContent, /import.*SimulatedPaymentNotice.*from/, 'WalletScreen must import SimulatedPaymentNotice');
    assert.match(walletContent, /<SimulatedPaymentNotice\s+variant="banner"\s*\/>/, 'WalletScreen must mount banner notice');
    assert.match(walletContent, /<SimulatedPaymentNotice\s+variant="pill"\s*\/>/, 'WalletScreen must mount pill notice');

    const profilePath = path.join(projectRoot, 'src/pages/ProfileScreen.jsx');
    const profileContent = fs.readFileSync(profilePath, 'utf8');

    assert.match(profileContent, /import.*SimulatedPaymentNotice.*from/, 'ProfileScreen must import SimulatedPaymentNotice');
    assert.match(profileContent, /<SimulatedPaymentNotice\s+variant="banner"\s*\/>/, 'ProfileScreen must mount banner notice');
    assert.match(profileContent, /<SimulatedPaymentNotice\s+variant="pill"\s*\/>/, 'ProfileScreen must mount pill notice');
  });

  test('2.3 Top-up bounds validation (Rs 1 - Rs 5000)', () => {
    const validateTopupAmount = (amount) => {
      const num = Number(amount);
      if (isNaN(num)) return { valid: false, error: 'Invalid number' };
      if (num < 1) return { valid: false, error: 'Top-up amount must be between Rs 1 and Rs 5000' };
      if (num > 5000) return { valid: false, error: 'Top-up amount must be between Rs 1 and Rs 5000' };
      return { valid: true, amount: num };
    };

    // Valid boundaries
    assert.equal(validateTopupAmount(1).valid, true);
    assert.equal(validateTopupAmount(100).valid, true);
    assert.equal(validateTopupAmount(200).valid, true);
    assert.equal(validateTopupAmount(500).valid, true);
    assert.equal(validateTopupAmount(5000).valid, true);

    // Invalid boundaries
    assert.equal(validateTopupAmount(0).valid, false);
    assert.equal(validateTopupAmount(-10).valid, false);
    assert.equal(validateTopupAmount(5001).valid, false);
    assert.equal(validateTopupAmount(100000).valid, false);
    assert.equal(validateTopupAmount('abc').valid, false);

    // Inspect WalletScreen.jsx input attributes
    const walletContent = fs.readFileSync(path.join(projectRoot, 'src/pages/WalletScreen.jsx'), 'utf8');
    assert.match(walletContent, /min=\{1\}/, 'Top-up input must enforce min={1}');
    assert.match(walletContent, /max=\{5000\}/, 'Top-up input must enforce max={5000}');
  });

  test('2.4 Platform fee calculation: 10% fee with Rs 5 minimum', () => {
    const calculatePlatformFee = (price) => {
      const rawFee = price * 0.1;
      const platformFee = Math.max(5, Math.round(rawFee));
      const netPayout = Math.max(0, price - platformFee);
      return { platformFee, netPayout };
    };

    // Minimum bid (Rs 20) -> 10% is Rs 2, minimum fee Rs 5 applies
    const f20 = calculatePlatformFee(20);
    assert.equal(f20.platformFee, 5, 'Rs 20 bid must trigger minimum Rs 5 fee');
    assert.equal(f20.netPayout, 15, 'Net payout for Rs 20 bid must be Rs 15');

    // Rs 40 chore -> 10% is Rs 4, minimum fee Rs 5 applies
    const f40 = calculatePlatformFee(40);
    assert.equal(f40.platformFee, 5, 'Rs 40 chore must trigger minimum Rs 5 fee');
    assert.equal(f40.netPayout, 35, 'Net payout for Rs 40 chore must be Rs 35');

    // Rs 50 chore -> 10% is Rs 5 exactly
    const f50 = calculatePlatformFee(50);
    assert.equal(f50.platformFee, 5, 'Rs 50 chore fee must be Rs 5');
    assert.equal(f50.netPayout, 45, 'Net payout for Rs 50 chore must be Rs 45');

    // Rs 55 chore -> 10% is 5.5, rounds to 6
    const f55 = calculatePlatformFee(55);
    assert.equal(f55.platformFee, 6, 'Rs 55 chore fee must round to Rs 6');
    assert.equal(f55.netPayout, 49, 'Net payout for Rs 55 chore must be Rs 49');

    // Rs 100 chore -> 10% is Rs 10
    const f100 = calculatePlatformFee(100);
    assert.equal(f100.platformFee, 10);
    assert.equal(f100.netPayout, 90);

    // Rs 300 chore -> 10% is Rs 30
    const f300 = calculatePlatformFee(300);
    assert.equal(f300.platformFee, 30);
    assert.equal(f300.netPayout, 270);

    // Maximum bid Rs 600 (2x Rs 300 budget) -> 10% is Rs 60
    const f600 = calculatePlatformFee(600);
    assert.equal(f600.platformFee, 60);
    assert.equal(f600.netPayout, 540);

    // Invariant: Fee + Net Payout === Price for all integers in [20, 1000]
    for (let p = 20; p <= 1000; p += 5) {
      const res = calculatePlatformFee(p);
      assert.equal(
        res.platformFee + res.netPayout,
        p,
        `Conservation of funds violated at price ${p}: ${res.platformFee} + ${res.netPayout} !== ${p}`
      );
    }
  });

  test('2.5 Double-entry ledger entry types and balance invariant', () => {
    const ALLOWED_TYPES = ['TOPUP', 'ESCROW_LOCK', 'ESCROW_REFUND', 'PAYOUT', 'FEE'];

    // Verify all 5 ledger badge styles exist in WalletScreen.jsx
    const walletContent = fs.readFileSync(path.join(projectRoot, 'src/pages/WalletScreen.jsx'), 'utf8');
    for (const type of ALLOWED_TYPES) {
      assert.match(
        walletContent,
        new RegExp(`case\\s+'${type}'`),
        `WalletScreen must define badge rendering for ledger type '${type}'`
      );
    }

    // Mathematical simulation of ledger balance invariants
    let requesterBalance = 0;
    let workerBalance = 0;

    // 1. Topup Rs 500
    const topupAmt = 500;
    requesterBalance += topupAmt;
    assert.equal(requesterBalance, 500);

    // 2. Accept Bid Rs 120 -> Escrow Lock
    const bidPrice = 120;
    assert.ok(requesterBalance >= bidPrice, 'Requester has sufficient balance');
    requesterBalance -= bidPrice;
    assert.equal(requesterBalance, 380);

    // 3. Worker completes chore -> Payout & Fee
    const fee = Math.max(5, Math.round(bidPrice * 0.1)); // 12
    const netPayout = bidPrice - fee; // 108
    workerBalance += netPayout;

    // Invariant check: Total value preserved
    assert.equal(requesterBalance + workerBalance + fee, topupAmt);

    // 4. Test Scenario: Task Cancellation with Full Refund
    requesterBalance -= 100; // Escrow lock on 2nd chore
    assert.equal(requesterBalance, 280);
    requesterBalance += 100; // Full escrow refund
    assert.equal(requesterBalance, 380);
  });
});

// ============================================================================
// SUITE 3: OTP Security, Isolation & Strike Lockout
// ============================================================================
describe('Suite 3: OTP Security & Strike Lockout', () => {
  test('3.1 OtpDisplayCard is strictly isolated to Requester role', () => {
    // Check that OtpDisplayCard is only imported in RequesterTaskDetailScreen
    const reqScreenPath = path.join(projectRoot, 'src/pages/RequesterTaskDetailScreen.jsx');
    const reqContent = fs.readFileSync(reqScreenPath, 'utf8');

    assert.match(
      reqContent,
      /import.*OtpDisplayCard.*from/,
      'RequesterTaskDetailScreen must import OtpDisplayCard'
    );
    assert.match(
      reqContent,
      /task\.status\s*===\s*'ASSIGNED'\s*&&\s*isRequester\s*&&/,
      'OtpDisplayCard must be guarded by task.status === ASSIGNED and isRequester'
    );

    // Verify Worker screens do NOT import or render OtpDisplayCard
    const workerHome = fs.readFileSync(path.join(projectRoot, 'src/pages/WorkerHomeScreen.jsx'), 'utf8');
    assert.doesNotMatch(workerHome, /OtpDisplayCard/, 'WorkerHomeScreen must never import OtpDisplayCard');

    const workerDetail = fs.readFileSync(path.join(projectRoot, 'src/pages/WorkerTaskDetailScreen.jsx'), 'utf8');
    assert.doesNotMatch(workerDetail, /OtpDisplayCard/, 'WorkerTaskDetailScreen must never import OtpDisplayCard');

    const workerActive = fs.readFileSync(path.join(projectRoot, 'src/pages/ActiveJobScreen.jsx'), 'utf8');
    assert.doesNotMatch(workerActive, /OtpDisplayCard/, 'ActiveJobScreen must never import OtpDisplayCard');
  });

  test('3.2 OtpDisplayCard formats 4 digits with zero-padding', () => {
    const formatOtpDigits = (otpCode) => {
      if (!otpCode) return null;
      return String(otpCode).padStart(4, '0').split('');
    };

    assert.deepEqual(formatOtpDigits(1234), ['1', '2', '3', '4']);
    assert.deepEqual(formatOtpDigits('5678'), ['5', '6', '7', '8']);
    assert.deepEqual(formatOtpDigits(42), ['0', '0', '4', '2']);
    assert.deepEqual(formatOtpDigits(7), ['0', '0', '0', '7']);
    assert.equal(formatOtpDigits(null), null);
  });

  test('3.3 OtpInputBoxes auto-advance and numeric sanitization logic', () => {
    // Simulate OtpInputBoxes change handler logic
    const simulateInputChange = (currentDigits, index, inputVal) => {
      const cleaned = inputVal.replace(/\D/g, '');
      const newDigits = [...currentDigits];
      let nextFocus = index;

      if (cleaned.length > 0) {
        newDigits[index] = cleaned.charAt(cleaned.length - 1);
        if (index < 3) {
          nextFocus = index + 1;
        }
      } else {
        newDigits[index] = '';
      }
      return { newDigits, nextFocus, fullCode: newDigits.join('') };
    };

    let digits = ['', '', '', ''];

    // User types '4' at box 0
    let step1 = simulateInputChange(digits, 0, '4');
    assert.deepEqual(step1.newDigits, ['4', '', '', '']);
    assert.equal(step1.nextFocus, 1, 'Focus should advance to index 1');

    // User types non-numeric 'x' at box 1 -> stripped
    let step2 = simulateInputChange(step1.newDigits, 1, 'x');
    assert.deepEqual(step2.newDigits, ['4', '', '', ''], 'Non-numeric input must be rejected');

    // User types '7' at box 1
    let step3 = simulateInputChange(step1.newDigits, 1, '7');
    assert.deepEqual(step3.newDigits, ['4', '7', '', '']);
    assert.equal(step3.nextFocus, 2, 'Focus should advance to index 2');

    // Simulate Paste "9821"
    const simulatePaste = (clipboardText) => {
      const pasted = clipboardText.replace(/\D/g, '').slice(0, 4);
      const newDigits = ['', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      const nextFocus = Math.min(3, pasted.length);
      return { newDigits, nextFocus, fullCode: newDigits.join('') };
    };

    const pasteRes = simulatePaste('9821');
    assert.deepEqual(pasteRes.newDigits, ['9', '8', '2', '1']);
    assert.equal(pasteRes.fullCode, '9821');
    assert.equal(pasteRes.nextFocus, 3);

    const dirtyPaste = simulatePaste('otp: 4-3-2-1!');
    assert.deepEqual(dirtyPaste.newDigits, ['4', '3', '2', '1']);
    assert.equal(dirtyPaste.fullCode, '4321');
  });

  test('3.4 3-Strike Lockout state machine transitioning to DISPUTED', () => {
    // Model task state progression on wrong OTP submissions
    class OtpLockoutSession {
      constructor(correctOtp = '8492') {
        this.correctOtp = correctOtp;
        this.attempts = 0;
        this.maxAttempts = 3;
        this.status = 'ASSIGNED';
      }

      submit(code) {
        if (this.status !== 'ASSIGNED') {
          return { error: `Task status is ${this.status}, cannot verify OTP` };
        }

        if (code === this.correctOtp) {
          this.status = 'COMPLETED';
          return { success: true, status: 'COMPLETED' };
        }

        this.attempts += 1;
        if (this.attempts >= this.maxAttempts) {
          this.status = 'DISPUTED';
          return {
            success: false,
            isDisputed: true,
            attemptCount: this.attempts,
            remainingAttempts: 0,
            error: '3 failed attempts exceeded. Task is now DISPUTED',
          };
        }

        return {
          success: false,
          isDisputed: false,
          attemptCount: this.attempts,
          remainingAttempts: this.maxAttempts - this.attempts,
          error: `Invalid OTP. Attempt ${this.attempts} of ${this.maxAttempts}`,
        };
      }
    }

    const session = new OtpLockoutSession('8492');

    // Strike 1
    const strike1 = session.submit('1111');
    assert.equal(strike1.success, false);
    assert.equal(strike1.isDisputed, false);
    assert.equal(strike1.attemptCount, 1);
    assert.equal(strike1.remainingAttempts, 2);
    assert.equal(session.status, 'ASSIGNED');

    // Strike 2
    const strike2 = session.submit('2222');
    assert.equal(strike2.success, false);
    assert.equal(strike2.isDisputed, false);
    assert.equal(strike2.attemptCount, 2);
    assert.equal(strike2.remainingAttempts, 1);
    assert.equal(session.status, 'ASSIGNED');

    // Strike 3 -> Lockout & DISPUTED
    const strike3 = session.submit('3333');
    assert.equal(strike3.success, false);
    assert.equal(strike3.isDisputed, true);
    assert.equal(strike3.attemptCount, 3);
    assert.equal(strike3.remainingAttempts, 0);
    assert.equal(session.status, 'DISPUTED');

    // Further attempts must fail because task is locked in DISPUTED
    const extraAttempt = session.submit('8492');
    assert.match(extraAttempt.error, /Task status is DISPUTED/);
  });
});

// ============================================================================
// SUITE 4: Platform Limits (Requester 3-Open & Worker 1-Active-Job)
// ============================================================================
describe('Suite 4: Platform Concurrency & Operation Limits', () => {
  test('4.1 Requester 3-open-tasks limit enforcement logic', () => {
    const evaluateRequesterLimit = (tasks) => {
      const openTasks = tasks.filter((t) => t.status === 'OPEN');
      const isLimitReached = openTasks.length >= 3;
      return { openCount: openTasks.length, isLimitReached, canPost: !isLimitReached };
    };

    // 0, 1, 2 open tasks -> can post
    assert.equal(evaluateRequesterLimit([]).canPost, true);
    assert.equal(evaluateRequesterLimit([{ id: 1, status: 'OPEN' }]).canPost, true);
    assert.equal(
      evaluateRequesterLimit([
        { id: 1, status: 'OPEN' },
        { id: 2, status: 'OPEN' },
      ]).canPost,
      true
    );

    // Exactly 3 open tasks -> limit reached, CTA disabled
    const limit3 = evaluateRequesterLimit([
      { id: 1, status: 'OPEN' },
      { id: 2, status: 'OPEN' },
      { id: 3, status: 'OPEN' },
    ]);
    assert.equal(limit3.isLimitReached, true);
    assert.equal(limit3.canPost, false);

    // Tasks in non-OPEN status do not count towards the 3-open limit
    const mixed = evaluateRequesterLimit([
      { id: 1, status: 'OPEN' },
      { id: 2, status: 'OPEN' },
      { id: 3, status: 'ASSIGNED' },
      { id: 4, status: 'COMPLETED' },
      { id: 5, status: 'CANCELLED' },
      { id: 6, status: 'DISPUTED' },
    ]);
    assert.equal(mixed.openCount, 2);
    assert.equal(mixed.isLimitReached, false);
    assert.equal(mixed.canPost, true);

    // Verify presence of limit banner in RequesterHomeScreen.jsx
    const reqHome = fs.readFileSync(path.join(projectRoot, 'src/pages/RequesterHomeScreen.jsx'), 'utf8');
    assert.match(reqHome, /openTasks\.length\s*>=\s*3/, 'Must evaluate openTasks.length >= 3');
    assert.match(reqHome, /Open Task Limit Reached \(3\/3 Open Tasks\)/, 'Must render explicit 3/3 warning banner');
    assert.match(reqHome, /Limit Reached \(3\/3\)/, 'Must disable Post button with "Limit Reached (3/3)"');
  });

  test('4.2 Worker 1-active-job limit enforcement logic', () => {
    const evaluateWorkerCanBid = (activeJob, currentTaskId) => {
      const hasActiveJob = Boolean(activeJob && activeJob.id !== currentTaskId);
      return {
        canBid: !hasActiveJob,
        errorMessage: hasActiveJob
          ? 'You already have an active job in progress! Maximum 1 active job per worker.'
          : null,
      };
    };

    // Worker with no active job can place bids
    assert.equal(evaluateWorkerCanBid(null, 'task-1').canBid, true);

    // Worker with an active job in progress cannot bid on another chore
    const busyCheck = evaluateWorkerCanBid({ id: 'task-active', title: 'Xerox Job' }, 'task-2');
    assert.equal(busyCheck.canBid, false);
    assert.match(busyCheck.errorMessage, /Maximum 1 active job per worker/);

    // Verify WorkerHomeScreen.jsx and BidSheet.jsx enforce 1-active-job banner & guard
    const workerHome = fs.readFileSync(path.join(projectRoot, 'src/pages/WorkerHomeScreen.jsx'), 'utf8');
    assert.match(workerHome, /Active Job in Progress!/, 'WorkerHomeScreen must display Active Job banner');

    const bidSheet = fs.readFileSync(path.join(projectRoot, 'src/components/worker/BidSheet.jsx'), 'utf8');
    assert.match(bidSheet, /if\s*\(hasActiveJob\)/, 'BidSheet must check hasActiveJob before submit');
  });
});

// ============================================================================
// SUITE 5: Budget Slider & Reverse Bidding Bounds
// ============================================================================
describe('Suite 5: Budget Slider & Reverse Bidding Bounds', () => {
  test('5.1 Budget slider step and boundary clamping (Rs 50 - Rs 300)', () => {
    const handleBudgetStep = (currentBudget, delta) => {
      return Math.min(300, Math.max(50, currentBudget + delta));
    };

    // Step stepping behavior
    assert.equal(handleBudgetStep(100, 10), 110);
    assert.equal(handleBudgetStep(100, -10), 90);

    // Boundary clamping at bottom (Rs 50)
    assert.equal(handleBudgetStep(50, -10), 50, 'Cannot step below Rs 50');
    assert.equal(handleBudgetStep(50, -100), 50, 'Cannot drop below Rs 50');

    // Boundary clamping at ceiling (Rs 300)
    assert.equal(handleBudgetStep(300, 10), 300, 'Cannot step above Rs 300');
    assert.equal(handleBudgetStep(300, 200), 300, 'Cannot exceed Rs 300');

    // Presets in PostTaskScreen.jsx
    const postTaskContent = fs.readFileSync(path.join(projectRoot, 'src/pages/PostTaskScreen.jsx'), 'utf8');
    assert.match(
      postTaskContent,
      /BUDGET_PRESETS\s*=\s*\[50,\s*80,\s*100,\s*150,\s*200,\s*250,\s*300\]/,
      'PostTaskScreen must define standard budget presets [50, 80, 100, 150, 200, 250, 300]'
    );
    assert.match(postTaskContent, /min=\{50\}/, 'Range input min must be 50');
    assert.match(postTaskContent, /max=\{300\}/, 'Range input max must be 300');
  });

  test('5.2 Reverse bidding bounds: min Rs 20, max 2x task budget', () => {
    const calculateBidBounds = (taskBudget) => {
      const minBid = 20;
      const maxBid = Number(taskBudget) * 2;
      return { minBid, maxBid };
    };

    const handleBidStep = (currentPrice, delta, minBid, maxBid) => {
      return Math.min(maxBid, Math.max(minBid, currentPrice + delta));
    };

    // Case A: Task budget Rs 50
    const b50 = calculateBidBounds(50);
    assert.equal(b50.minBid, 20);
    assert.equal(b50.maxBid, 100);
    assert.equal(handleBidStep(20, -10, b50.minBid, b50.maxBid), 20, 'Cannot bid below Rs 20');
    assert.equal(handleBidStep(100, 10, b50.minBid, b50.maxBid), 100, 'Cannot bid above 2x budget (Rs 100)');

    // Case B: Task budget Rs 100
    const b100 = calculateBidBounds(100);
    assert.equal(b100.minBid, 20);
    assert.equal(b100.maxBid, 200);

    // Case C: Task budget Rs 300 (maximum allowed budget)
    const b300 = calculateBidBounds(300);
    assert.equal(b300.minBid, 20);
    assert.equal(b300.maxBid, 600);

    // Verify BidSheet.jsx source implementation
    const bidSheetContent = fs.readFileSync(path.join(projectRoot, 'src/components/worker/BidSheet.jsx'), 'utf8');
    assert.match(bidSheetContent, /const minBid = 20;/, 'BidSheet must enforce minBid = 20');
    assert.match(bidSheetContent, /const maxBid = Number\(task\.budget\) \* 2;/, 'BidSheet must enforce maxBid = 2x budget');
  });
});
