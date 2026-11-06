import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAdminClient,
  getAnonClient,
  getOrCreateTestUser,
  cleanupTask,
  callRpc
} from './helpers.js';

const CAMPUS_LOC = { lat: 13.0184, lng: 77.5684 };
const WORKER_1_LOC = { lat: 13.0188, lng: 77.5688 };
const WORKER_2_LOC = { lat: 13.0192, lng: 77.5692 };
const WORKER_3_LOC = { lat: 13.0196, lng: 77.5696 };
const WORKER_4_LOC = { lat: 13.0200, lng: 77.5700 };

describe('Milestone 2 Adversarial & Stress Testing Suite', () => {
  let adminClient;
  let requester;
  let worker1;
  let worker2;
  let worker3;
  let worker4;
  let adminUser;
  const createdTaskIds = [];

  before(async () => {
    adminClient = getAdminClient();

    requester = await getOrCreateTestUser({
      email: 'stress_requester@whap.local',
      name: 'Stress Requester',
      role: 'REQUESTER',
      lat: CAMPUS_LOC.lat,
      lng: CAMPUS_LOC.lng,
      initialBalance: 1000.00
    });

    worker1 = await getOrCreateTestUser({
      email: 'stress_worker1@whap.local',
      name: 'Stress Worker 1',
      role: 'WORKER',
      lat: WORKER_1_LOC.lat,
      lng: WORKER_1_LOC.lng,
      initialBalance: 50.00
    });

    worker2 = await getOrCreateTestUser({
      email: 'stress_worker2@whap.local',
      name: 'Stress Worker 2',
      role: 'WORKER',
      lat: WORKER_2_LOC.lat,
      lng: WORKER_2_LOC.lng,
      initialBalance: 50.00
    });

    worker3 = await getOrCreateTestUser({
      email: 'stress_worker3@whap.local',
      name: 'Stress Worker 3',
      role: 'WORKER',
      lat: WORKER_3_LOC.lat,
      lng: WORKER_3_LOC.lng,
      initialBalance: 50.00
    });

    worker4 = await getOrCreateTestUser({
      email: 'stress_worker4@whap.local',
      name: 'Stress Worker 4',
      role: 'WORKER',
      lat: WORKER_4_LOC.lat,
      lng: WORKER_4_LOC.lng,
      initialBalance: 50.00
    });

    adminUser = await getOrCreateTestUser({
      email: 'stress_admin@whap.local',
      name: 'Stress Admin',
      role: 'ADMIN',
      initialBalance: 0.00
    });
  });

  after(async () => {
    for (const taskId of createdTaskIds) {
      await cleanupTask(taskId);
    }
  });

  // =========================================================================
  // 1. CONCURRENCY: Simultaneous 4-Way Bid Acceptance Race
  // =========================================================================
  describe('Adversarial Concurrency Probes', () => {

    test('Probe C1: 4 simultaneous concurrent calls to accept_bid on competing bids -> exactly 1 succeeds', async () => {
      // 1. Post task
      const { data: task, error: postErr } = await callRpc(requester.client, 'post_task', {
        p_title: 'Heavy Concurrency 4-Way Race Task',
        p_category: 'BUY_ITEMS',
        p_budget: 200.00,
        p_lat: CAMPUS_LOC.lat,
        p_lng: CAMPUS_LOC.lng
      });
      assert.ifError(postErr);
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // 2. 4 workers place competing bids
      const [b1, b2, b3, b4] = await Promise.all([
        callRpc(worker1.client, 'place_bid', { p_task_id: taskId, p_price: 150.00, p_lat: WORKER_1_LOC.lat, p_lng: WORKER_1_LOC.lng }),
        callRpc(worker2.client, 'place_bid', { p_task_id: taskId, p_price: 155.00, p_lat: WORKER_2_LOC.lat, p_lng: WORKER_2_LOC.lng }),
        callRpc(worker3.client, 'place_bid', { p_task_id: taskId, p_price: 160.00, p_lat: WORKER_3_LOC.lat, p_lng: WORKER_3_LOC.lng }),
        callRpc(worker4.client, 'place_bid', { p_task_id: taskId, p_price: 165.00, p_lat: WORKER_4_LOC.lat, p_lng: WORKER_4_LOC.lng })
      ]);

      assert.ifError(b1.error);
      assert.ifError(b2.error);
      assert.ifError(b3.error);
      assert.ifError(b4.error);

      const bidIds = [
        b1.data.id || b1.data.bid_id,
        b2.data.id || b2.data.bid_id,
        b3.data.id || b3.data.bid_id,
        b4.data.id || b4.data.bid_id
      ];

      const { data: wBefore } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      const balanceBefore = Number(wBefore.balance);

      // 3. Fire all 4 accept_bid RPC calls simultaneously
      const results = await Promise.allSettled(
        bidIds.map(bidId => callRpc(requester.client, 'accept_bid', { p_bid_id: bidId, p_task_id: taskId }))
      );

      const isSuccess = (r) => r.status === 'fulfilled' && !r.value?.error;
      const successes = results.filter(isSuccess);
      const failures = results.filter(r => !isSuccess(r));

      // Invariant: Exactly 1 succeeds, exactly 3 fail
      assert.strictEqual(successes.length, 1, `Expected exactly 1 success among 4 concurrent accepts, got ${successes.length}`);
      assert.strictEqual(failures.length, 3, `Expected exactly 3 failures among 4 concurrent accepts, got ${failures.length}`);

      // 4. Verify task assigned to the winning bid
      const { data: dbTask } = await adminClient
        .from('tasks')
        .select('status, agreed_price, assigned_worker_id')
        .eq('id', taskId)
        .single();
      assert.strictEqual(dbTask.status, 'ASSIGNED');

      // 5. Verify requester wallet was debited EXACTLY ONCE for winning bid price
      const { data: wAfter } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      assert.strictEqual(Number(wAfter.balance), balanceBefore - Number(dbTask.agreed_price));

      // 6. Verify exactly 1 escrow transaction exists
      const { data: escrows } = await adminClient
        .from('escrow_transactions')
        .select('*')
        .eq('task_id', taskId);
      assert.strictEqual(escrows.length, 1);
      assert.strictEqual(escrows[0].status, 'HELD');

      // 7. Verify winning bid is ACCEPTED and others are REJECTED
      const { data: allBids } = await adminClient
        .from('bids')
        .select('id, status')
        .eq('task_id', taskId);
      const acceptedBids = allBids.filter(b => b.status === 'ACCEPTED');
      const rejectedBids = allBids.filter(b => b.status === 'REJECTED');
      assert.strictEqual(acceptedBids.length, 1);
      assert.strictEqual(rejectedBids.length, 3);
    });

    test('Probe C2: Wallet underflow race condition — concurrent accepts exceeding total balance', async () => {
      // Setup dedicated requester with exactly Rs 100
      const tightRequester = await getOrCreateTestUser({
        email: 'tight_requester@whap.local',
        name: 'Tight Requester',
        role: 'REQUESTER',
        lat: CAMPUS_LOC.lat,
        lng: CAMPUS_LOC.lng,
        initialBalance: 100.00
      });

      // Post 2 tasks with Rs 80 budget each
      const { data: tA } = await callRpc(tightRequester.client, 'post_task', {
        p_title: 'Budget Race Task A',
        p_category: 'QUEUE',
        p_budget: 80.00,
        p_lat: CAMPUS_LOC.lat,
        p_lng: CAMPUS_LOC.lng
      });
      const { data: tB } = await callRpc(tightRequester.client, 'post_task', {
        p_title: 'Budget Race Task B',
        p_category: 'QUEUE',
        p_budget: 80.00,
        p_lat: CAMPUS_LOC.lat,
        p_lng: CAMPUS_LOC.lng
      });
      const taskAId = tA.id || tA.task_id;
      const taskBId = tB.id || tB.task_id;
      createdTaskIds.push(taskAId, taskBId);

      // Worker 1 bids Rs 70 on Task A, Worker 2 bids Rs 70 on Task B
      const { data: bA } = await callRpc(worker1.client, 'place_bid', { p_task_id: taskAId, p_price: 70.00, p_lat: WORKER_1_LOC.lat, p_lng: WORKER_1_LOC.lng });
      const { data: bB } = await callRpc(worker2.client, 'place_bid', { p_task_id: taskBId, p_price: 70.00, p_lat: WORKER_2_LOC.lat, p_lng: WORKER_2_LOC.lng });

      // Requester attempts to accept BOTH simultaneously (total 70+70 = 140 > 100)
      const [resA, resB] = await Promise.allSettled([
        callRpc(tightRequester.client, 'accept_bid', { p_bid_id: bA.id || bA.bid_id, p_task_id: taskAId }),
        callRpc(tightRequester.client, 'accept_bid', { p_bid_id: bB.id || bB.bid_id, p_task_id: taskBId })
      ]);

      const isSuccess = (r) => r.status === 'fulfilled' && !r.value?.error;
      const successes = [resA, resB].filter(isSuccess);
      const failures = [resA, resB].filter(r => !isSuccess(r));

      // Invariant: Exactly 1 must succeed, 1 must fail due to insufficient funds (underflow prevented)
      assert.strictEqual(successes.length, 1, 'Exactly one task can be accepted within balance');
      assert.strictEqual(failures.length, 1, 'Second accept must fail due to insufficient funds');

      // Verify final balance is 30.00 and NEVER negative
      const { data: finalWallet } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', tightRequester.userId)
        .single();
      assert.strictEqual(Number(finalWallet.balance), 30.00);
      assert.ok(Number(finalWallet.balance) >= 0, 'Wallet balance cannot underflow');
    });

  });

  // =========================================================================
  // 2. FINANCIAL INTEGRITY: Direct Client Mutation Attacks & RLS Enforcement
  // =========================================================================
  describe('Adversarial Financial Integrity & RLS Probes', () => {

    test('Probe F1: Direct client UPDATE on wallets is blocked by RLS', async () => {
      // Worker 1 attempts to update their own balance directly
      const { data, error } = await worker1.client
        .from('wallets')
        .update({ balance: 500000.00 })
        .eq('user_id', worker1.userId)
        .select();

      assert.ok(
        error || (data?.length || 0) === 0,
        'Direct UPDATE on wallets must be rejected by RLS'
      );

      // Verify balance did not change
      const { data: w } = await adminClient.from('wallets').select('balance').eq('user_id', worker1.userId).single();
      assert.notStrictEqual(Number(w.balance), 500000.00);
    });

    test('Probe F2: Direct client INSERT on wallets is blocked by RLS', async () => {
      const { data, error } = await worker1.client
        .from('wallets')
        .insert({ user_id: worker1.userId, balance: 10000.00 })
        .select();

      assert.ok(
        error || (data?.length || 0) === 0,
        'Direct INSERT on wallets must be rejected by RLS'
      );
    });

    test('Probe F3: Direct client DELETE on wallets is blocked by RLS', async () => {
      const { data, error } = await worker1.client
        .from('wallets')
        .delete()
        .eq('user_id', worker1.userId)
        .select();

      assert.ok(
        error || (data?.length || 0) === 0,
        'Direct DELETE on wallets must be rejected by RLS'
      );
    });

    test('Probe F4: Direct client mutations on escrow_transactions are blocked by RLS', async () => {
      // 1. Direct INSERT
      const insertRes = await worker1.client
        .from('escrow_transactions')
        .insert({
          task_id: '00000000-0000-0000-0000-000000000000',
          amount: 500.00,
          platform_fee: 50.00,
          status: 'RELEASED'
        })
        .select();
      assert.ok(insertRes.error || (insertRes.data?.length || 0) === 0, 'Direct INSERT on escrow must fail');

      // 2. Direct UPDATE
      const updateRes = await worker1.client
        .from('escrow_transactions')
        .update({ status: 'RELEASED' })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      assert.ok(updateRes.error || (updateRes.data?.length || 0) === 0, 'Direct UPDATE on escrow must fail');

      // 3. Direct DELETE
      const deleteRes = await worker1.client
        .from('escrow_transactions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      assert.ok(deleteRes.error || (deleteRes.data?.length || 0) === 0, 'Direct DELETE on escrow must fail');
    });

    test('Probe F5: Direct client mutations on ledger_entries are blocked by RLS', async () => {
      // 1. Direct INSERT
      const insertRes = await worker1.client
        .from('ledger_entries')
        .insert({
          wallet_id: '00000000-0000-0000-0000-000000000000',
          type: 'TOPUP',
          amount: 9999.00
        })
        .select();
      assert.ok(insertRes.error || (insertRes.data?.length || 0) === 0, 'Direct INSERT on ledger must fail');

      // 2. Direct UPDATE
      const updateRes = await worker1.client
        .from('ledger_entries')
        .update({ amount: 99999.00 })
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      assert.ok(updateRes.error || (updateRes.data?.length || 0) === 0, 'Direct UPDATE on ledger must fail');

      // 3. Direct DELETE
      const deleteRes = await worker1.client
        .from('ledger_entries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
      assert.ok(deleteRes.error || (deleteRes.data?.length || 0) === 0, 'Direct DELETE on ledger must fail');
    });

  });

  // =========================================================================
  // 3. OTP DISPUTE: 3 Wrong Attempts & Locked State Invariants
  // =========================================================================
  describe('Adversarial OTP Dispute & State Machine Probes', () => {

    test('Probe O1: 3 wrong OTP attempts lock task into DISPUTED, and subsequent completion attempts are rejected', async () => {
      // 1. Setup assigned task
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'OTP Invariant Lockout Task',
        p_category: 'QUEUE',
        p_budget: 100.00,
        p_lat: CAMPUS_LOC.lat,
        p_lng: CAMPUS_LOC.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 90.00,
        p_lat: WORKER_1_LOC.lat,
        p_lng: WORKER_1_LOC.lng
      });
      const acceptRes = await callRpc(requester.client, 'accept_bid', {
        p_bid_id: bid.id || bid.bid_id,
        p_task_id: taskId
      });
      assert.ifError(acceptRes.error);

      // Fetch actual valid OTP using admin
      const { data: taskData } = await adminClient.from('tasks').select('otp_code').eq('id', taskId).single();
      const realOtp = taskData.otp_code;
      const wrongOtp = realOtp === '1234' ? '4321' : '1234';

      // 2. Attempt 1: wrong OTP
      const try1 = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: wrongOtp });
      assert.ok(try1.error, 'Attempt 1 must fail');
      const { data: taskAft1 } = await adminClient.from('tasks').select('status, otp_attempts').eq('id', taskId).single();
      assert.strictEqual(taskAft1.status, 'ASSIGNED');
      assert.strictEqual(taskAft1.otp_attempts, 1);

      // 3. Attempt 2: wrong OTP
      const try2 = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: wrongOtp });
      assert.ok(try2.error, 'Attempt 2 must fail');
      const { data: taskAft2 } = await adminClient.from('tasks').select('status, otp_attempts').eq('id', taskId).single();
      assert.strictEqual(taskAft2.status, 'ASSIGNED');
      assert.strictEqual(taskAft2.otp_attempts, 2);

      // 4. Attempt 3: wrong OTP -> Must transition to DISPUTED
      const try3 = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: wrongOtp });
      assert.ok(try3.error, 'Attempt 3 must fail');
      const { data: taskAft3 } = await adminClient.from('tasks').select('status, otp_attempts').eq('id', taskId).single();
      assert.strictEqual(taskAft3.status, 'DISPUTED', 'Task must be in DISPUTED status after 3 wrong attempts');
      assert.strictEqual(taskAft3.otp_attempts, 3);

      // 5. Attempt 4: Worker tries again with wrong OTP -> Must be rejected because task is DISPUTED
      const try4 = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: wrongOtp });
      assert.ok(try4.error, 'Attempt 4 after lockout must be rejected');
      assert.ok(try4.error.message.includes('DISPUTED'), `Expected error message to mention DISPUTED, got: ${try4.error.message}`);

      // 6. Attempt 5: Worker tries with the REAL correct OTP -> Must STILL be rejected because task is DISPUTED!
      const tryRealAfterLock = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: realOtp });
      assert.ok(tryRealAfterLock.error, 'Completion even with real OTP must be rejected once locked in DISPUTED');
      assert.ok(tryRealAfterLock.error.message.includes('DISPUTED'));

      // 7. Verify escrow is STILL HELD and was NOT released to worker
      const { data: escrow } = await adminClient.from('escrow_transactions').select('status').eq('task_id', taskId).single();
      assert.strictEqual(escrow.status, 'HELD', 'Escrow must remain HELD when task is DISPUTED');
    });

    test('Probe O2: Unauthorized callers cannot complete tasks', async () => {
      // Post and assign task to Worker 1
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Unauthorized OTP Completion Task',
        p_category: 'OTHER',
        p_budget: 80.00,
        p_lat: CAMPUS_LOC.lat,
        p_lng: CAMPUS_LOC.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 70.00,
        p_lat: WORKER_1_LOC.lat,
        p_lng: WORKER_1_LOC.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id, p_task_id: taskId });

      // Worker 2 attempts to complete Worker 1's task
      const unauthorizedRes = await callRpc(worker2.client, 'complete_task', {
        p_task_id: taskId,
        p_otp_code: '1234'
      });
      assert.ok(unauthorizedRes.error, 'Unassigned worker calling complete_task must be rejected');
      assert.ok(unauthorizedRes.error.message.includes('Unauthorized') || unauthorizedRes.error.message.includes('worker'));
    });

  });

});
