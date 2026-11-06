import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import {
  getAdminClient,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  callRpc,
  cleanupTask
} from '../helpers.js';

// Canonical test accounts & coordinates
const REQUESTER_CREDENTIALS = {
  email: 'requester_1@whap.local',
  password: 'whap_demo_password_123'
};

const WORKER_CREDENTIALS = {
  email: 'worker_1@whap.local',
  password: 'whap_demo_password_123'
};

const IISC_CAMPUS_LOCATION = {
  lat: 13.0184,
  lng: 77.5684
};

const WORKER_LOCATION = {
  lat: 13.0185,
  lng: 77.5685
};

describe('WHAP Milestone 4: Dual-Session End-to-End Simulation (F27)', () => {
  let adminClient;
  let requesterClient;
  let workerClient;
  let requesterUser;
  let workerUser;

  // Track state across the 12 steps
  let taskId;
  let bidId;
  let otpCode;
  let initialRequesterBalance;
  let initialWorkerBalance;

  const stepMetrics = [];

  function recordStepMetric(stepNumber, name, durationMs, details = {}) {
    stepMetrics.push({
      step: stepNumber,
      name,
      durationMs: Number(durationMs.toFixed(2)),
      status: 'PASS',
      ...details
    });
  }

  before(async () => {
    adminClient = getAdminClient();

    // Instantiate Client A: Requester with distinct storage & no auto-refresh
    requesterClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'sb-requester-dual-session'
      }
    });

    // Instantiate Client B: Worker with distinct storage & no auto-refresh
    workerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'sb-worker-dual-session'
      }
    });

    // Sign in Requester
    const { data: reqAuth, error: reqErr } = await requesterClient.auth.signInWithPassword({
      email: REQUESTER_CREDENTIALS.email,
      password: REQUESTER_CREDENTIALS.password
    });
    assert.ifError(reqErr, `Requester sign in failed: ${reqErr?.message}`);
    requesterUser = reqAuth.user;
    assert.ok(requesterUser?.id, 'Requester user ID must be resolved');

    // Sign in Worker
    const { data: wrkAuth, error: wrkErr } = await workerClient.auth.signInWithPassword({
      email: WORKER_CREDENTIALS.email,
      password: WORKER_CREDENTIALS.password
    });
    assert.ifError(wrkErr, `Worker sign in failed: ${wrkErr?.message}`);
    workerUser = wrkAuth.user;
    assert.ok(workerUser?.id, 'Worker user ID must be resolved');

    // Invariant: Concurrent sessions must be completely isolated
    assert.notStrictEqual(
      requesterUser.id,
      workerUser.id,
      'AUTH ISOLATION VIOLATION: Requester and Worker share the same user ID!'
    );

    // Clean up any stale active jobs for worker_1 from previous interrupted runs
    const { data: staleTasks } = await adminClient
      .from('tasks')
      .select('id')
      .eq('assigned_worker_id', workerUser.id)
      .eq('status', 'ASSIGNED');

    if (staleTasks && staleTasks.length > 0) {
      for (const t of staleTasks) {
        await cleanupTask(t.id);
      }
    }

    // Ensure worker profile location is synchronized to IISc campus for spatial search
    await adminClient
      .from('profiles')
      .update({
        location: `SRID=4326;POINT(${WORKER_LOCATION.lng} ${WORKER_LOCATION.lat})`
      })
      .eq('id', workerUser.id);
  });

  after(async () => {
    // Teardown test chore artifacts
    if (taskId) {
      await cleanupTask(taskId);
      try {
        await adminClient.from('notifications').delete().eq('user_id', requesterUser?.id);
        await adminClient.from('notifications').delete().eq('user_id', workerUser?.id);
      } catch {
        // non-fatal
      }
    }

    // Disconnect realtime WebSockets to ensure clean Node.js event-loop exit
    if (requesterClient?.realtime) {
      try {
        requesterClient.realtime.disconnect();
      } catch {
        // ignore
      }
    }
    if (workerClient?.realtime) {
      try {
        workerClient.realtime.disconnect();
      } catch {
        // ignore
      }
    }

    // Print ASCII Execution Telemetry Table
    console.log('\n========================================================================================');
    console.log('                 WHAP DUAL-SESSION END-TO-END EXECUTION TELEMETRY (F27)                  ');
    console.log('========================================================================================');
    console.log('Step | Action                               | Latency   | Status | Verifications');
    console.log('-----+--------------------------------------+-----------+--------+----------------------');
    for (const m of stepMetrics) {
      const stepStr = String(m.step).padStart(4, ' ');
      const nameStr = m.name.padEnd(36, ' ');
      const latStr = `${m.durationMs} ms`.padStart(9, ' ');
      const statStr = m.status.padEnd(6, ' ');
      const noteStr = m.note || 'Verified';
      console.log(`${stepStr} | ${nameStr} | ${latStr} | ${statStr} | ${noteStr}`);
    }
    console.log('========================================================================================\n');
  });

  // -------------------------------------------------------------------------
  // STEP 1: Balance Verification & Simulated Top-Up
  // -------------------------------------------------------------------------
  test('Step 1: Check initial balances; if Requester balance < ₹100, invoke simulate_topup(100)', async () => {
    const t0 = performance.now();

    // Ensure Requester wallet exists and check balance
    let { data: reqWallet } = await adminClient
      .from('wallets')
      .select('balance, id')
      .eq('user_id', requesterUser.id)
      .maybeSingle();

    if (!reqWallet) {
      const { data: createdWallet, error: createErr } = await adminClient
        .from('wallets')
        .insert({ user_id: requesterUser.id, balance: 500.00 })
        .select()
        .single();
      assert.ifError(createErr);
      reqWallet = createdWallet;
    }

    let reqBal = Number(reqWallet.balance);
    let topupInvoked = false;

    // Invariant: Requester must possess at least ₹100 to fund the chore escrow
    if (reqBal < 100.00) {
      const topupRes = await requesterClient.rpc('simulate_topup', { p_amount: 100.00 });
      assert.ifError(topupRes.error, `simulate_topup failed: ${topupRes.error?.message}`);
      assert.ok(topupRes.data.success, 'simulate_topup must return success=true');
      reqBal = Number(topupRes.data.new_balance || topupRes.data.balance);
      topupInvoked = true;
    }

    initialRequesterBalance = reqBal;

    // Ensure Worker wallet exists
    let { data: wrkWallet } = await adminClient
      .from('wallets')
      .select('balance, id')
      .eq('user_id', workerUser.id)
      .maybeSingle();

    if (!wrkWallet) {
      const { data: createdWrkWallet, error: createWrkErr } = await adminClient
        .from('wallets')
        .insert({ user_id: workerUser.id, balance: 0.00 })
        .select()
        .single();
      assert.ifError(createWrkErr);
      wrkWallet = createdWrkWallet;
    }

    initialWorkerBalance = Number(wrkWallet.balance);

    const t1 = performance.now();
    recordStepMetric(1, 'Check & Top-up Initial Balances', t1 - t0, {
      note: `Req=₹${initialRequesterBalance}, Wrk=₹${initialWorkerBalance}${topupInvoked ? ' (Topup ₹100)' : ''}`
    });

    assert.ok(initialRequesterBalance >= 100.00, 'Requester balance must be >= ₹100');
    console.log(`[Step 1/12] Initial Balances: Requester = ₹${initialRequesterBalance}, Worker = ₹${initialWorkerBalance}`);
  });

  // -------------------------------------------------------------------------
  // STEP 2: Requester Posts Hyperlocal Chore
  // -------------------------------------------------------------------------
  test('Step 2: Requester posts task via post_task at IISc campus (budget ₹100, XEROX_PICKUP)', async () => {
    const t0 = performance.now();

    const postRes = await callRpc(
      requesterClient,
      'post_task',
      {
        p_title: 'Campus Xerox & Notes Pickup (Dual-Session E2E)',
        p_description: 'Pick up 15 photocopies from campus Xerox center and deliver to Aerospace Dept',
        p_category: 'XEROX_PICKUP',
        p_budget: 100.00,
        p_lat: IISC_CAMPUS_LOCATION.lat,
        p_lng: IISC_CAMPUS_LOCATION.lng,
        p_address: 'IISc Central Library Xerox Center'
      },
      {
        p_title: 'Campus Xerox & Notes Pickup (Dual-Session E2E)',
        p_description: 'Pick up 15 photocopies from campus Xerox center and deliver to Aerospace Dept',
        p_category: 'XEROX_PICKUP',
        p_budget: 100.00,
        p_latitude: IISC_CAMPUS_LOCATION.lat,
        p_longitude: IISC_CAMPUS_LOCATION.lng
      }
    );

    assert.ifError(postRes.error, `post_task failed: ${postRes.error?.message}`);
    const taskData = postRes.data;
    assert.ok(taskData, 'Task response data must be returned');

    taskId = taskData.id || taskData.task_id;
    assert.ok(taskId, 'Task ID must be populated');
    assert.match(
      taskId,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Task ID must be a valid UUID'
    );

    // Verify task state in database
    const { data: dbTask, error: fetchErr } = await adminClient
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    assert.ifError(fetchErr);
    assert.strictEqual(dbTask.status, 'OPEN');
    assert.strictEqual(Number(dbTask.budget), 100.00);
    assert.strictEqual(dbTask.category, 'XEROX_PICKUP');
    assert.strictEqual(dbTask.requester_id, requesterUser.id);
    assert.strictEqual(dbTask.assigned_worker_id, null);

    const t1 = performance.now();
    recordStepMetric(2, 'Requester post_task (₹100)', t1 - t0, {
      note: `Task ID: ${taskId.slice(0, 8)}... (OPEN)`
    });

    console.log(`[Step 2/12] Task Created: ID = ${taskId}, Status = OPEN, Budget = ₹100.00`);
  });

  // -------------------------------------------------------------------------
  // STEP 3: Worker Discovers Chore via Spatial Query
  // -------------------------------------------------------------------------
  test('Step 3: Worker queries nearby_tasks(13.0185, 77.5685, 1500) and discovers the newly created task', async () => {
    const t0 = performance.now();

    const nearbyRes = await callRpc(
      workerClient,
      'nearby_tasks',
      {
        p_lat: WORKER_LOCATION.lat,
        p_lng: WORKER_LOCATION.lng,
        p_radius_meters: 1500
      },
      {
        p_latitude: WORKER_LOCATION.lat,
        p_longitude: WORKER_LOCATION.lng,
        p_radius_meters: 1500
      }
    );

    assert.ifError(nearbyRes.error, `nearby_tasks failed: ${nearbyRes.error?.message}`);
    assert.ok(Array.isArray(nearbyRes.data), 'nearby_tasks must return an array');

    const discoveredTask = nearbyRes.data.find(t => t.id === taskId);
    assert.ok(
      discoveredTask,
      `Worker at (${WORKER_LOCATION.lat}, ${WORKER_LOCATION.lng}) must discover task ${taskId} within 1500m`
    );

    assert.ok(
      discoveredTask.distance_meters <= 1500,
      `Discovered task distance ${discoveredTask.distance_meters}m must be <= 1500m`
    );

    // Invariant: nearby_tasks must never expose OTP to browsing workers
    assert.strictEqual(
      discoveredTask.otp_code,
      undefined,
      'SECURITY INVARIANT: nearby_tasks must never project otp_code'
    );

    const t1 = performance.now();
    recordStepMetric(3, 'Worker nearby_tasks Discovery', t1 - t0, {
      note: `Discovered at ~${Math.round(discoveredTask.distance_meters)}m`
    });

    console.log(`[Step 3/12] Worker Discovered Task: dist = ${discoveredTask.distance_meters}m (OTP hidden)`);
  });

  // -------------------------------------------------------------------------
  // STEP 4: Worker Submits Reverse Bid
  // -------------------------------------------------------------------------
  test('Step 4: Worker submits reverse bid via place_bid at ₹90', async () => {
    const t0 = performance.now();

    const bidRes = await callRpc(
      workerClient,
      'place_bid',
      {
        p_task_id: taskId,
        p_price: 90.00,
        p_lat: WORKER_LOCATION.lat,
        p_lng: WORKER_LOCATION.lng,
        p_message: 'Ready at library now, can print and deliver immediately.'
      },
      {
        p_task_id: taskId,
        p_amount: 90.00
      }
    );

    assert.ifError(bidRes.error, `place_bid failed: ${bidRes.error?.message}`);
    const bidData = bidRes.data;
    assert.ok(bidData, 'place_bid response data must be returned');

    bidId = bidData.id || bidData.bid_id;
    assert.ok(bidId, 'Bid ID must be populated');

    // Verify bid row in database
    const { data: dbBid, error: bidErr } = await adminClient
      .from('bids')
      .select('*')
      .eq('id', bidId)
      .single();

    assert.ifError(bidErr);
    assert.strictEqual(dbBid.status, 'PENDING');
    assert.strictEqual(Number(dbBid.price), 90.00);
    assert.strictEqual(dbBid.worker_id, workerUser.id);
    assert.strictEqual(dbBid.task_id, taskId);

    const t1 = performance.now();
    recordStepMetric(4, 'Worker place_bid (₹90)', t1 - t0, {
      note: `Bid ID: ${bidId.slice(0, 8)}... (PENDING)`
    });

    console.log(`[Step 4/12] Worker Placed Bid: ID = ${bidId}, Price = ₹90.00, Status = PENDING`);
  });

  // -------------------------------------------------------------------------
  // STEP 5: Requester Accepts Worker's Bid
  // -------------------------------------------------------------------------
  test('Step 5: Requester queries bids, sees Worker ₹90 bid, verifies balance >= ₹90, and calls accept_bid', async () => {
    const t0 = performance.now();

    // 1. Requester inspects live bids for the chore
    const { data: liveBids, error: bidsListErr } = await requesterClient
      .from('bids')
      .select('*')
      .eq('task_id', taskId);

    assert.ifError(bidsListErr);
    assert.ok(Array.isArray(liveBids) && liveBids.length > 0, 'Requester must see active bids');
    const matchedBid = liveBids.find(b => b.id === bidId);
    assert.ok(matchedBid, 'Worker bid must appear in Requester bid list');
    assert.strictEqual(Number(matchedBid.price), 90.00);

    // 2. Requester checks sufficient wallet balance
    const { data: reqWallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', requesterUser.id)
      .single();
    assert.ok(
      Number(reqWallet.balance) >= 90.00,
      `Requester wallet (₹${reqWallet.balance}) must cover bid of ₹90.00`
    );

    // 3. Concurrency-safe bid acceptance with database row lock
    const acceptRes = await callRpc(
      requesterClient,
      'accept_bid',
      { p_bid_id: bidId },
      { p_task_id: taskId, p_bid_id: bidId }
    );

    assert.ifError(acceptRes.error, `accept_bid failed: ${acceptRes.error?.message}`);
    assert.ok(acceptRes.data, 'accept_bid response must be returned');

    const t1 = performance.now();
    recordStepMetric(5, 'Requester accept_bid (Row Locked)', t1 - t0, {
      note: 'Bid accepted, task ASSIGNED'
    });

    console.log(`[Step 5/12] Bid Accepted: Worker assigned at agreed price ₹90.00`);
  });

  // -------------------------------------------------------------------------
  // STEP 6: Escrow Reservation & Balance Deduction Verification
  // -------------------------------------------------------------------------
  test('Step 6: Verify task status is ASSIGNED, escrow record created with status = HELD and amount = 90', async () => {
    const t0 = performance.now();

    // Verify task state
    const { data: assignedTask, error: taskErr } = await adminClient
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    assert.ifError(taskErr);
    assert.strictEqual(assignedTask.status, 'ASSIGNED');
    assert.strictEqual(assignedTask.assigned_worker_id, workerUser.id);
    assert.strictEqual(Number(assignedTask.agreed_price), 90.00);

    // Verify Escrow record: status = HELD, amount = 90, platform_fee = 9
    const { data: escrowRecord, error: escrowErr } = await adminClient
      .from('escrow_transactions')
      .select('*')
      .eq('task_id', taskId)
      .single();

    assert.ifError(escrowErr);
    assert.ok(escrowRecord, 'Escrow transaction record must exist');
    assert.strictEqual(escrowRecord.status, 'HELD');
    assert.strictEqual(Number(escrowRecord.amount), 90.00);
    assert.strictEqual(Number(escrowRecord.platform_fee), 9.00);

    // Verify Requester wallet balance deducted by exactly ₹90
    const { data: reqWallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', requesterUser.id)
      .single();

    const expectedRequesterBal = initialRequesterBalance - 90.00;
    assert.strictEqual(
      Number(reqWallet.balance),
      expectedRequesterBal,
      `Requester wallet balance must decrease by ₹90 (from ${initialRequesterBalance} to ${expectedRequesterBal})`
    );

    // Verify ESCROW_LOCK ledger entry
    const { data: lockEntries, error: lockErr } = await adminClient
      .from('ledger_entries')
      .select('*')
      .eq('task_id', taskId)
      .eq('type', 'ESCROW_LOCK');

    assert.ifError(lockErr);
    assert.strictEqual(lockEntries.length, 1, 'Exactly 1 ESCROW_LOCK ledger entry must be recorded');
    assert.strictEqual(Number(lockEntries[0].amount), 90.00);

    const t1 = performance.now();
    recordStepMetric(6, 'Escrow Held & Balance Deduction', t1 - t0, {
      note: 'Escrow HELD ₹90 (Fee ₹9), Req deducted'
    });

    console.log(`[Step 6/12] Escrow Verified: Status = HELD, Amount = ₹90.00, Fee = ₹9.00`);
  });

  // -------------------------------------------------------------------------
  // STEP 7: Security Check on OTP Isolation Gate
  // -------------------------------------------------------------------------
  test('Step 7: Security check on OTP isolation: Requester gets OTP; Worker get_task_otp is rejected & tasks_view returns NULL', async () => {
    const t0 = performance.now();

    // 1. Authorized Access: Requester calls get_task_otp
    const reqOtpRes = await requesterClient.rpc('get_task_otp', { p_task_id: taskId });
    assert.ifError(reqOtpRes.error, `Requester get_task_otp error: ${reqOtpRes.error?.message}`);
    otpCode = reqOtpRes.data;
    assert.ok(otpCode, 'Requester must receive OTP');
    assert.match(otpCode, /^\d{4}$/, 'OTP must be exactly 4 numeric digits');

    // 2. Unauthorized Adversarial Probe 1: Worker direct call to get_task_otp must fail
    const wrkOtpRes = await workerClient.rpc('get_task_otp', { p_task_id: taskId });
    assert.ok(
      wrkOtpRes.error,
      'SECURITY BREACH: Worker must NOT be able to invoke get_task_otp successfully'
    );
    assert.ok(
      wrkOtpRes.error.message.includes('Unauthorized') || wrkOtpRes.error.message.includes('only the task requester'),
      `Expected authorization failure, got: ${wrkOtpRes.error.message}`
    );

    // 3. Unauthorized Adversarial Probe 2: Worker queries tasks_view for otp_code -> must be NULL
    const { data: wrkViewData, error: wrkViewErr } = await workerClient
      .from('tasks_view')
      .select('otp_code')
      .eq('id', taskId)
      .maybeSingle();

    assert.ifError(wrkViewErr);
    assert.ok(wrkViewData !== null, 'tasks_view record should be queryable by assigned worker');
    assert.strictEqual(
      wrkViewData.otp_code,
      null,
      'SECURITY BREACH: tasks_view exposed otp_code to assigned worker!'
    );

    const t1 = performance.now();
    recordStepMetric(7, 'Security Check: OTP Isolation Gate', t1 - t0, {
      note: 'Requester received OTP; Worker probes DENIED/NULL'
    });

    console.log(`[Step 7/12] OTP Isolation Verified: Requester OTP = ${otpCode}, Worker probes strictly rejected.`);
  });

  // -------------------------------------------------------------------------
  // STEP 8: Worker Completes Task with OTP Handover
  // -------------------------------------------------------------------------
  test('Step 8: Worker submits the OTP via complete_task', async () => {
    const t0 = performance.now();

    // Physical handover simulated: Worker enters the OTP provided by Requester
    const compRes = await callRpc(
      workerClient,
      'complete_task',
      {
        p_task_id: taskId,
        p_otp_code: otpCode
      }
    );

    assert.ifError(compRes.error, `complete_task failed: ${compRes.error?.message}`);
    const compData = compRes.data;
    assert.ok(compData, 'complete_task response must be returned');
    assert.strictEqual(compData.status, 'COMPLETED');
    assert.strictEqual(Number(compData.payout_amount || compData.payout), 81.00);

    const t1 = performance.now();
    recordStepMetric(8, 'Worker complete_task (OTP Handover)', t1 - t0, {
      note: 'OTP verified, status COMPLETED'
    });

    console.log(`[Step 8/12] Task Completed: Worker submitted valid OTP, status = COMPLETED`);
  });

  // -------------------------------------------------------------------------
  // STEP 9: Escrow Release & Worker Payout Verification
  // -------------------------------------------------------------------------
  test('Step 9: Verify task status transitions to COMPLETED, escrow transitions to RELEASED, Worker receives net ₹81', async () => {
    const t0 = performance.now();

    // 1. Verify task record
    const { data: completedTask, error: taskErr } = await adminClient
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    assert.ifError(taskErr);
    assert.strictEqual(completedTask.status, 'COMPLETED');
    assert.ok(completedTask.completed_at, 'completed_at must be populated');

    // 2. Verify Escrow status
    const { data: releasedEscrow, error: escrowErr } = await adminClient
      .from('escrow_transactions')
      .select('*')
      .eq('task_id', taskId)
      .single();

    assert.ifError(escrowErr);
    assert.strictEqual(releasedEscrow.status, 'RELEASED');
    assert.ok(releasedEscrow.released_at, 'released_at must be populated');

    // 3. Verify Worker wallet credited net ₹81 (₹90 - ₹9 fee)
    const { data: wrkWallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', workerUser.id)
      .single();

    const expectedWorkerBal = initialWorkerBalance + 81.00;
    assert.strictEqual(
      Number(wrkWallet.balance),
      expectedWorkerBal,
      `Worker wallet balance must increase by ₹81 net payout (from ${initialWorkerBalance} to ${expectedWorkerBal})`
    );

    // 4. Verify Ledger entries for PAYOUT and FEE
    const { data: payoutEntry } = await adminClient
      .from('ledger_entries')
      .select('*')
      .eq('task_id', taskId)
      .eq('type', 'PAYOUT')
      .single();

    assert.ok(payoutEntry, 'PAYOUT ledger entry must be recorded');
    assert.strictEqual(Number(payoutEntry.amount), 81.00);

    const { data: feeEntry } = await adminClient
      .from('ledger_entries')
      .select('*')
      .eq('task_id', taskId)
      .eq('type', 'FEE')
      .single();

    assert.ok(feeEntry, 'FEE ledger entry must be recorded');
    assert.strictEqual(Number(feeEntry.amount), 9.00);

    const t1 = performance.now();
    recordStepMetric(9, 'Escrow Released & Worker Payout', t1 - t0, {
      note: 'Escrow RELEASED, Wrk +₹81, Platform +₹9'
    });

    console.log(`[Step 9/12] Payout Verified: Escrow RELEASED, Worker credited ₹81.00 net, Fee ₹9.00`);
  });

  // -------------------------------------------------------------------------
  // STEP 10: Requester Submits Review (Double-Blind Hidden)
  // -------------------------------------------------------------------------
  test('Step 10: Requester submits 5-star review via submit_review; verify review is saved with is_revealed = false', async () => {
    const t0 = performance.now();

    const reqRevRes = await callRpc(
      requesterClient,
      'submit_review',
      {
        p_task_id: taskId,
        p_rating: 5,
        p_comment: 'Punctual and careful delivery of xerox documents! Highly recommended.'
      }
    );

    assert.ifError(reqRevRes.error, `Requester submit_review failed: ${reqRevRes.error?.message}`);
    const revData = reqRevRes.data;
    assert.ok(revData, 'Review response data must be returned');

    // Double-blind invariant: Counterpart has not submitted yet, review must remain hidden
    assert.strictEqual(revData.is_revealed, false, 'is_revealed must be false');
    assert.strictEqual(revData.visible, false, 'visible must be false');

    // Inspect database review row
    const { data: dbRev, error: dbRevErr } = await adminClient
      .from('reviews')
      .select('*')
      .eq('task_id', taskId)
      .eq('reviewer_id', requesterUser.id)
      .single();

    assert.ifError(dbRevErr);
    assert.strictEqual(dbRev.visible, false, 'First review in DB must have visible = false');

    // Counterpart (Worker) querying reviews for this chore must see 0 reviews due to RLS
    const { data: wrkViewReviews, error: wrkRevErr } = await workerClient
      .from('reviews')
      .select('*')
      .eq('task_id', taskId);

    assert.ifError(wrkRevErr);
    assert.strictEqual(
      wrkViewReviews.length,
      0,
      'Worker must not be able to read requester review prior to submitting own'
    );

    const t1 = performance.now();
    recordStepMetric(10, 'Requester Double-Blind Review', t1 - t0, {
      note: 'Submitted 5-stars (is_revealed=false)'
    });

    console.log(`[Step 10/12] Requester Review: Submitted, Double-blind isolation verified (is_revealed = false)`);
  });

  // -------------------------------------------------------------------------
  // STEP 11: Worker Submits Review (Both Reviews Revealed)
  // -------------------------------------------------------------------------
  test('Step 11: Worker submits 5-star review via submit_review; verify both reviews transition to is_revealed = true', async () => {
    const t0 = performance.now();

    const wrkRevRes = await callRpc(
      workerClient,
      'submit_review',
      {
        p_task_id: taskId,
        p_rating: 5,
        p_comment: 'Prompt communication and smooth OTP handover. Great requester!'
      }
    );

    assert.ifError(wrkRevRes.error, `Worker submit_review failed: ${wrkRevRes.error?.message}`);
    const wrkRevData = wrkRevRes.data;
    assert.ok(wrkRevData, 'Review response data must be returned');

    // Mutual revelation invariant: Both reviews are now submitted, both become revealed
    assert.strictEqual(wrkRevData.is_revealed, true, 'is_revealed must now be true');
    assert.strictEqual(wrkRevData.visible, true, 'visible must now be true');

    // Verify all reviews in database have transitioned to visible = true
    const { data: allReviews, error: allRevErr } = await adminClient
      .from('reviews')
      .select('*')
      .eq('task_id', taskId);

    assert.ifError(allRevErr);
    assert.strictEqual(allReviews.length, 2, 'Exactly 2 reviews must exist for chore');
    for (const r of allReviews) {
      assert.strictEqual(r.visible, true, `Review ${r.id} must be visible=true`);
    }

    // Worker querying reviews now sees both records
    const { data: wrkViewReviews } = await workerClient
      .from('reviews')
      .select('*')
      .eq('task_id', taskId);

    assert.strictEqual(
      wrkViewReviews.length,
      2,
      'Worker must now be able to view both revealed reviews'
    );

    const t1 = performance.now();
    recordStepMetric(11, 'Worker Review & Mutual Revelation', t1 - t0, {
      note: 'Both reviews now visible=true'
    });

    console.log(`[Step 11/12] Worker Review: Submitted, Mutual revelation verified (both visible = true)`);
  });

  // -------------------------------------------------------------------------
  // STEP 12: Full Double-Entry Ledger Reconciliation
  // -------------------------------------------------------------------------
  test('Step 12: Ledger reconciliation: verify double-entry consistency (ΔRequester -₹90 + ΔWorker +₹81 + ΔPlatform +₹9 = 0.00)', async () => {
    const t0 = performance.now();

    // Query all ledger entries associated with this chore
    const { data: taskLedger, error: ledgerErr } = await adminClient
      .from('ledger_entries')
      .select('*')
      .eq('task_id', taskId);

    assert.ifError(ledgerErr);
    assert.strictEqual(taskLedger.length, 3, 'Exactly 3 ledger entries must exist for chore');

    const escrowLockEntry = taskLedger.find(e => e.type === 'ESCROW_LOCK');
    const payoutEntry = taskLedger.find(e => e.type === 'PAYOUT');
    const feeEntry = taskLedger.find(e => e.type === 'FEE');

    assert.ok(escrowLockEntry, 'ESCROW_LOCK ledger entry missing');
    assert.ok(payoutEntry, 'PAYOUT ledger entry missing');
    assert.ok(feeEntry, 'FEE ledger entry missing');

    assert.strictEqual(Number(escrowLockEntry.amount), 90.00);
    assert.strictEqual(Number(payoutEntry.amount), 81.00);
    assert.strictEqual(Number(feeEntry.amount), 9.00);

    // Final wallet balance check
    const { data: finalReqWallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', requesterUser.id)
      .single();

    const { data: finalWrkWallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', workerUser.id)
      .single();

    const deltaRequester = Number(finalReqWallet.balance) - initialRequesterBalance;
    const deltaWorker = Number(finalWrkWallet.balance) - initialWorkerBalance;
    const deltaPlatform = Number(feeEntry.amount);

    // Assert exact balance deltas
    assert.strictEqual(deltaRequester, -90.00, 'Requester net delta must be -₹90.00');
    assert.strictEqual(deltaWorker, 81.00, 'Worker net delta must be +₹81.00');
    assert.strictEqual(deltaPlatform, 9.00, 'Platform fee collected must be +₹9.00');

    // Net Financial Conservation Law: ΔRequester + ΔWorker + ΔPlatform = 0.00
    const netLeakage = deltaRequester + deltaWorker + deltaPlatform;
    assert.strictEqual(
      Math.abs(netLeakage),
      0.00,
      `FINANCIAL INTEGRITY LEAKAGE: Net balance discrepancy = ${netLeakage}`
    );

    const t1 = performance.now();
    recordStepMetric(12, 'Double-Entry Ledger Reconciliation', t1 - t0, {
      note: 'ΔReq(-90) + ΔWrk(+81) + ΔFee(+9) = 0.00 (Zero Leakage)'
    });

    console.log(`[Step 12/12] Ledger Reconciled: ΔReq(-₹90) + ΔWrk(+₹81) + ΔPlatform(+₹9) = ₹0.00. Strict zero leakage!`);
  });

});
