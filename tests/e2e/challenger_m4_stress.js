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

// Test credentials
const REQUESTER_CREDENTIALS = {
  email: 'requester_1@whap.local',
  password: 'whap_demo_password_123'
};

const WORKER_CREDENTIALS = {
  email: 'worker_1@whap.local',
  password: 'whap_demo_password_123'
};

const WORKER_2_CREDENTIALS = {
  email: 'worker_2@whap.local',
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

describe('WHAP Milestone 4: Empirical Challenger Stress Harness (Adversarial & Boundary Verification)', () => {
  let adminClient;
  let requesterClient;
  let workerClient;
  let worker2Client;
  let requesterUser;
  let workerUser;
  let worker2User;

  const createdTaskIds = [];

  before(async () => {
    adminClient = getAdminClient();

    // Client 1: Requester
    requesterClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'sb-challenger-req-session'
      }
    });

    // Client 2: Worker 1
    workerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'sb-challenger-wrk1-session'
      }
    });

    // Client 3: Worker 2 (Third-party adversary)
    worker2Client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'sb-challenger-wrk2-session'
      }
    });

    // Sign in Requester
    const { data: reqAuth, error: reqErr } = await requesterClient.auth.signInWithPassword({
      email: REQUESTER_CREDENTIALS.email,
      password: REQUESTER_CREDENTIALS.password
    });
    assert.ifError(reqErr, `Requester sign in failed: ${reqErr?.message}`);
    requesterUser = reqAuth.user;

    // Sign in Worker 1
    const { data: wrkAuth, error: wrkErr } = await workerClient.auth.signInWithPassword({
      email: WORKER_CREDENTIALS.email,
      password: WORKER_CREDENTIALS.password
    });
    assert.ifError(wrkErr, `Worker 1 sign in failed: ${wrkErr?.message}`);
    workerUser = wrkAuth.user;

    // Sign in Worker 2
    const { data: wrk2Auth, error: wrk2Err } = await worker2Client.auth.signInWithPassword({
      email: WORKER_2_CREDENTIALS.email,
      password: WORKER_2_CREDENTIALS.password
    });
    assert.ifError(wrk2Err, `Worker 2 sign in failed: ${wrk2Err?.message}`);
    worker2User = wrk2Auth.user;

    // Ensure initial balances for test accounts
    await adminClient.from('wallets').update({ balance: 500.00 }).eq('user_id', requesterUser.id);
  });

  after(async () => {
    // Teardown all created tasks
    for (const tid of createdTaskIds) {
      await cleanupTask(tid);
    }

    if (requesterClient?.realtime) requesterClient.realtime.disconnect();
    if (workerClient?.realtime) workerClient.realtime.disconnect();
    if (worker2Client?.realtime) worker2Client.realtime.disconnect();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Cross-Session Token Bleeding Probe
  // -------------------------------------------------------------------------
  test('Probe 1: Strict Session Isolation & Token Bleeding Resistance under concurrent interleaved operations', async () => {
    // Fire concurrent calls to ensure sessions don't bleed or cross-authenticate
    const [reqAuthUser, wrkAuthUser, wrk2AuthUser] = await Promise.all([
      requesterClient.auth.getUser(),
      workerClient.auth.getUser(),
      worker2Client.auth.getUser()
    ]);

    assert.strictEqual(reqAuthUser.data.user.id, requesterUser.id, 'Requester user ID mutated or leaked');
    assert.strictEqual(wrkAuthUser.data.user.id, workerUser.id, 'Worker 1 user ID mutated or leaked');
    assert.strictEqual(wrk2AuthUser.data.user.id, worker2User.id, 'Worker 2 user ID mutated or leaked');

    // Concurrently query profiles via RLS
    const [reqProfileRes, wrkProfileRes, wrk2ProfileRes] = await Promise.all([
      requesterClient.from('profiles').select('id, role').eq('id', requesterUser.id).single(),
      workerClient.from('profiles').select('id, role').eq('id', workerUser.id).single(),
      worker2Client.from('profiles').select('id, role').eq('id', worker2User.id).single()
    ]);

    assert.strictEqual(reqProfileRes.data.id, requesterUser.id);
    assert.strictEqual(wrkProfileRes.data.id, workerUser.id);
    assert.strictEqual(wrk2ProfileRes.data.id, worker2User.id);

    console.log('✔ Probe 1 Passed: Complete session token isolation across 3 concurrent clients.');
  });

  // -------------------------------------------------------------------------
  // TEST 2: Worker Accepting Own Bid (Role Violation Probe)
  // -------------------------------------------------------------------------
  test('Probe 2: Adversarial Role Probe — Worker attempting accept_bid on their own bid must be rejected', async () => {
    // 1. Requester posts task
    const postRes = await callRpc(
      requesterClient,
      'post_task',
      {
        p_title: 'Challenger Stress Task - Bid Acceptance Probe',
        p_description: 'Testing unauthorized bid acceptance defense',
        p_category: 'XEROX_PICKUP',
        p_budget: 100.00,
        p_lat: IISC_CAMPUS_LOCATION.lat,
        p_lng: IISC_CAMPUS_LOCATION.lng,
        p_address: 'IISc Main Gate'
      },
      {
        p_title: 'Challenger Stress Task - Bid Acceptance Probe',
        p_description: 'Testing unauthorized bid acceptance defense',
        p_category: 'XEROX_PICKUP',
        p_budget: 100.00,
        p_latitude: IISC_CAMPUS_LOCATION.lat,
        p_longitude: IISC_CAMPUS_LOCATION.lng
      }
    );

    assert.ifError(postRes.error);
    const testTaskId = postRes.data.id || postRes.data.task_id;
    createdTaskIds.push(testTaskId);

    // 2. Worker places bid
    const bidRes = await callRpc(
      workerClient,
      'place_bid',
      {
        p_task_id: testTaskId,
        p_price: 85.00,
        p_lat: WORKER_LOCATION.lat,
        p_lng: WORKER_LOCATION.lng,
        p_message: 'Worker bid'
      },
      {
        p_task_id: testTaskId,
        p_amount: 85.00
      }
    );

    assert.ifError(bidRes.error);
    const testBidId = bidRes.data.id || bidRes.data.bid_id;

    // 3. Worker calls accept_bid (Adversarial probe)
    const unauthorizedAcceptRes = await callRpc(
      workerClient,
      'accept_bid',
      { p_bid_id: testBidId },
      { p_task_id: testTaskId, p_bid_id: testBidId }
    );

    assert.ok(
      unauthorizedAcceptRes.error,
      'SECURITY BREACH: Worker was able to call accept_bid on their own bid!'
    );
    assert.match(
      unauthorizedAcceptRes.error.message,
      /Only the task requester can accept bids/i,
      `Expected 'Only the task requester can accept bids', got: ${unauthorizedAcceptRes.error.message}`
    );

    // 4. Third-party worker calls accept_bid (Adversarial probe)
    const thirdPartyAcceptRes = await callRpc(
      worker2Client,
      'accept_bid',
      { p_bid_id: testBidId },
      { p_task_id: testTaskId, p_bid_id: testBidId }
    );

    assert.ok(
      thirdPartyAcceptRes.error,
      'SECURITY BREACH: Third-party worker was able to call accept_bid!'
    );

    // 5. Invariant: Task must remain OPEN and unassigned
    const { data: taskCheck } = await adminClient
      .from('tasks')
      .select('status, assigned_worker_id')
      .eq('id', testTaskId)
      .single();

    assert.strictEqual(taskCheck.status, 'OPEN');
    assert.strictEqual(taskCheck.assigned_worker_id, null);

    // 6. Invariant: No escrow transaction created
    const { data: escrowCheck } = await adminClient
      .from('escrow_transactions')
      .select('*')
      .eq('task_id', testTaskId);

    assert.strictEqual(escrowCheck.length, 0, 'No escrow must be created on rejected acceptance');

    console.log('✔ Probe 2 Passed: Worker & third-party accept_bid attempts rejected with strict role check.');
  });

  // -------------------------------------------------------------------------
  // TEST 3: Negative Condition — Wrong OTP & 3-Strike Dispute Escalation
  // -------------------------------------------------------------------------
  test('Probe 3: Boundary & Negative Condition — Wrong OTP attempts counter and 3-strike DISPUTED state transition', async () => {
    // 1. Requester posts task
    const postRes = await callRpc(
      requesterClient,
      'post_task',
      {
        p_title: 'Challenger Stress Task - Wrong OTP Probe',
        p_description: 'Testing 3-strike invalid OTP escalation',
        p_category: 'XEROX_PICKUP',
        p_budget: 100.00,
        p_lat: IISC_CAMPUS_LOCATION.lat,
        p_lng: IISC_CAMPUS_LOCATION.lng,
        p_address: 'IISc Science Library'
      },
      {
        p_title: 'Challenger Stress Task - Wrong OTP Probe',
        p_description: 'Testing 3-strike invalid OTP escalation',
        p_category: 'XEROX_PICKUP',
        p_budget: 100.00,
        p_latitude: IISC_CAMPUS_LOCATION.lat,
        p_longitude: IISC_CAMPUS_LOCATION.lng
      }
    );

    assert.ifError(postRes.error);
    const testTaskId = postRes.data.id || postRes.data.task_id;
    createdTaskIds.push(testTaskId);

    // 2. Worker places bid
    const bidRes = await callRpc(
      workerClient,
      'place_bid',
      {
        p_task_id: testTaskId,
        p_price: 90.00,
        p_lat: WORKER_LOCATION.lat,
        p_lng: WORKER_LOCATION.lng,
        p_message: 'Worker bid'
      },
      {
        p_task_id: testTaskId,
        p_amount: 90.00
      }
    );
    assert.ifError(bidRes.error);
    const testBidId = bidRes.data.id || bidRes.data.bid_id;

    // 3. Requester accepts bid -> status ASSIGNED, OTP created
    const acceptRes = await callRpc(
      requesterClient,
      'accept_bid',
      { p_bid_id: testBidId },
      { p_task_id: testTaskId, p_bid_id: testBidId }
    );
    assert.ifError(acceptRes.error);

    // Retrieve real OTP via requester
    const reqOtpRes = await requesterClient.rpc('get_task_otp', { p_task_id: testTaskId });
    assert.ifError(reqOtpRes.error);
    const realOtp = reqOtpRes.data;
    assert.match(realOtp, /^\d{4}$/);

    const wrongOtp = realOtp === '0000' ? '9999' : '0000';

    // Record worker balance before OTP attempts
    const { data: wrkWalletBefore } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', workerUser.id)
      .single();
    const initialWrkBal = Number(wrkWalletBefore.balance);

    // 4. ATTEMPT 1: Wrong OTP
    const attempt1Res = await callRpc(
      workerClient,
      'complete_task',
      { p_task_id: testTaskId, p_otp_code: wrongOtp }
    );
    // complete_task sets response.status 400 and returns error object
    const res1 = attempt1Res.data || {};
    assert.ok(
      attempt1Res.error || res1.error || res1.status === 'ASSIGNED',
      'Attempt 1 with wrong OTP must be flagged as invalid'
    );

    const { data: taskAfter1 } = await adminClient
      .from('tasks')
      .select('status, otp_attempts')
      .eq('id', testTaskId)
      .single();
    assert.strictEqual(taskAfter1.otp_attempts, 1, 'Task otp_attempts must be 1 after first wrong OTP');
    assert.strictEqual(taskAfter1.status, 'ASSIGNED', 'Task status must remain ASSIGNED after attempt 1');

    // 5. ATTEMPT 2: Wrong OTP
    const attempt2Res = await callRpc(
      workerClient,
      'complete_task',
      { p_task_id: testTaskId, p_otp_code: wrongOtp }
    );
    const res2 = attempt2Res.data || {};
    assert.ok(
      attempt2Res.error || res2.error || res2.status === 'ASSIGNED',
      'Attempt 2 with wrong OTP must be flagged as invalid'
    );

    const { data: taskAfter2 } = await adminClient
      .from('tasks')
      .select('status, otp_attempts')
      .eq('id', testTaskId)
      .single();
    assert.strictEqual(taskAfter2.otp_attempts, 2, 'Task otp_attempts must be 2 after second wrong OTP');
    assert.strictEqual(taskAfter2.status, 'ASSIGNED', 'Task status must remain ASSIGNED after attempt 2');

    // 6. ATTEMPT 3: Wrong OTP (Must escalate to DISPUTED)
    const attempt3Res = await callRpc(
      workerClient,
      'complete_task',
      { p_task_id: testTaskId, p_otp_code: wrongOtp }
    );
    const res3 = attempt3Res.data || {};
    assert.ok(
      attempt3Res.error || res3.error || res3.status === 'DISPUTED',
      'Attempt 3 must report dispute escalation'
    );

    const { data: taskAfter3 } = await adminClient
      .from('tasks')
      .select('status, otp_attempts')
      .eq('id', testTaskId)
      .single();
    assert.strictEqual(taskAfter3.otp_attempts, 3, 'Task otp_attempts must be 3 after third wrong OTP');
    assert.strictEqual(taskAfter3.status, 'DISPUTED', 'Task status MUST escalate to DISPUTED after 3 failed OTP attempts!');

    // 7. INVARIANT: Escrow must remain HELD (NOT released)
    const { data: escrowAfterDispute } = await adminClient
      .from('escrow_transactions')
      .select('*')
      .eq('task_id', testTaskId)
      .single();

    assert.strictEqual(escrowAfterDispute.status, 'HELD', 'Escrow must remain HELD when task is DISPUTED');

    // 8. INVARIANT: Worker wallet must NOT have been credited
    const { data: wrkWalletAfter } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', workerUser.id)
      .single();

    assert.strictEqual(
      Number(wrkWalletAfter.balance),
      initialWrkBal,
      'Worker wallet balance must not change when task enters DISPUTED'
    );

    // 9. INVARIANT: Even submitting the correct OTP now MUST fail because task is DISPUTED
    const lateCorrectAttempt = await callRpc(
      workerClient,
      'complete_task',
      { p_task_id: testTaskId, p_otp_code: realOtp }
    );

    assert.ok(
      lateCorrectAttempt.error || (lateCorrectAttempt.data && lateCorrectAttempt.data.error),
      'Task in DISPUTED status must reject subsequent complete_task calls'
    );

    console.log('✔ Probe 3 Passed: 3 wrong OTP attempts cleanly triggered DISPUTED state; escrow preserved; late OTP blocked.');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Database Clean Teardown Verification
  // -------------------------------------------------------------------------
  test('Probe 4: Database Teardown Integrity & Residual State Audit', async () => {
    // Clean up all tasks created in this harness
    for (const tid of createdTaskIds) {
      await cleanupTask(tid);
    }
    createdTaskIds.length = 0; // cleared

    // Query remote database to verify zero orphan records for these tasks
    const { data: tasksRemaining } = await adminClient
      .from('tasks')
      .select('id, title, status')
      .ilike('title', '%Challenger Stress Task%');

    assert.strictEqual(
      tasksRemaining.length,
      0,
      `Teardown failure: ${tasksRemaining.length} challenger stress tasks remain in database!`
    );

    // Also check for any tasks created with the canonical dual-session title
    const { data: dualSessionTasks } = await adminClient
      .from('tasks')
      .select('id, title, status')
      .ilike('title', '%Campus Xerox & Notes Pickup (Dual-Session E2E)%');

    assert.strictEqual(
      dualSessionTasks.length,
      0,
      `Teardown failure: ${dualSessionTasks.length} dual-session simulation tasks remain in database!`
    );

    console.log('✔ Probe 4 Passed: Remote database teardown verified — 0 leftover test tasks or dangling records.');
  });
});
