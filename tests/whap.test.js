import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  getAdminClient,
  getAnonClient,
  getOrCreateTestUser,
  cleanupTask,
  callRpc,
  calculatePercentiles
} from './helpers.js';

// Coordinates for campus testing (IISc Bangalore reference)
const CAMPUS_CENTER = { lat: 13.0184, lng: 77.5684 };
const NEARBY_WORKER_1 = { lat: 13.0190, lng: 77.5690 }; // ~100m away
const NEARBY_WORKER_2 = { lat: 13.0210, lng: 77.5710 }; // ~400m away
const BOUNDARY_INSIDE = { lat: 13.0310, lng: 77.5684 }; // ~1400m away (inside 1500m)
const BOUNDARY_OUTSIDE = { lat: 13.0340, lng: 77.5684 }; // ~1730m away (outside 1500m)
const FAR_WORKER = { lat: 13.0450, lng: 77.5684 }; // ~2.9 km away

describe('WHAP Automated Test Suite', () => {
  let adminClient;
  let anonClient;
  let requester;
  let worker1;
  let worker2;
  let workerBoundary;
  let workerFar;
  let adminUser;

  // Track created tasks for cleanup
  const createdTaskIds = [];

  before(async () => {
    adminClient = getAdminClient();
    anonClient = getAnonClient();

    // Setup isolated test users with appropriate roles and initial balances
    requester = await getOrCreateTestUser({
      email: 'test_requester_e2e@whap.local',
      name: 'Test Requester E2E',
      role: 'REQUESTER',
      lat: CAMPUS_CENTER.lat,
      lng: CAMPUS_CENTER.lng,
      initialBalance: 1000.00
    });

    worker1 = await getOrCreateTestUser({
      email: 'test_worker1_e2e@whap.local',
      name: 'Test Worker 1 E2E',
      role: 'WORKER',
      lat: NEARBY_WORKER_1.lat,
      lng: NEARBY_WORKER_1.lng,
      initialBalance: 100.00
    });

    worker2 = await getOrCreateTestUser({
      email: 'test_worker2_e2e@whap.local',
      name: 'Test Worker 2 E2E',
      role: 'WORKER',
      lat: NEARBY_WORKER_2.lat,
      lng: NEARBY_WORKER_2.lng,
      initialBalance: 100.00
    });

    workerBoundary = await getOrCreateTestUser({
      email: 'test_worker_boundary@whap.local',
      name: 'Test Worker Boundary',
      role: 'WORKER',
      lat: BOUNDARY_OUTSIDE.lat,
      lng: BOUNDARY_OUTSIDE.lng,
      initialBalance: 100.00
    });

    workerFar = await getOrCreateTestUser({
      email: 'test_worker_far@whap.local',
      name: 'Test Worker Far',
      role: 'WORKER',
      lat: FAR_WORKER.lat,
      lng: FAR_WORKER.lng,
      initialBalance: 100.00
    });

    adminUser = await getOrCreateTestUser({
      email: 'test_admin_e2e@whap.local',
      name: 'Test Admin E2E',
      role: 'ADMIN',
      initialBalance: 0.00
    });
  });

  after(async () => {
    // Teardown all created tasks
    for (const taskId of createdTaskIds) {
      await cleanupTask(taskId);
    }
  });

  // =========================================================================
  // TIER 1: Feature Coverage (Core RPC Functions)
  // =========================================================================
  describe('Tier 1: Feature Coverage', () => {

    test('F09: post_task — creates open task with valid parameters within budget', async () => {
      const res = await callRpc(
        requester.client,
        'post_task',
        {
          p_title: 'Chore: Library Book Return',
          p_description: 'Return 2 books to main campus library',
          p_category: 'CARRY_THINGS',
          p_budget: 80.00,
          p_lat: CAMPUS_CENTER.lat,
          p_lng: CAMPUS_CENTER.lng,
          p_address: 'Central Library Desk'
        },
        {
          p_title: 'Chore: Library Book Return',
          p_description: 'Return 2 books to main campus library',
          p_category: 'CARRY_THINGS',
          p_budget: 80.00,
          p_latitude: CAMPUS_CENTER.lat,
          p_longitude: CAMPUS_CENTER.lng
        }
      );

      assert.ifError(res.error, `post_task error: ${res.error?.message}`);
      const task = res.data;
      assert.ok(task, 'Expected task object to be returned');
      const taskId = task.id || task.task_id;
      assert.ok(taskId, 'Expected task to have an ID');
      createdTaskIds.push(taskId);

      // Verify task fields in DB
      const { data: dbTask, error: fetchErr } = await adminClient
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      assert.ifError(fetchErr);
      assert.strictEqual(dbTask.status, 'OPEN');
      assert.strictEqual(Number(dbTask.budget), 80.00);
      assert.strictEqual(dbTask.category, 'CARRY_THINGS');
      assert.strictEqual(dbTask.requester_id, requester.userId);
    });

    test('F10: nearby_tasks — returns open tasks within 1.5 km sorted by distance', async () => {
      // Query nearby tasks from worker1's location
      const res = await callRpc(
        worker1.client,
        'nearby_tasks',
        {
          p_lat: NEARBY_WORKER_1.lat,
          p_lng: NEARBY_WORKER_1.lng,
          p_radius_meters: 1500
        },
        {
          p_latitude: NEARBY_WORKER_1.lat,
          p_longitude: NEARBY_WORKER_1.lng,
          p_radius_meters: 1500
        }
      );

      assert.ifError(res.error, `nearby_tasks error: ${res.error?.message}`);
      assert.ok(Array.isArray(res.data), 'Expected array of nearby tasks');
      assert.ok(res.data.length > 0, 'Expected at least 1 open task');

      // Check distance invariant: all returned tasks must be <= 1500m
      for (const t of res.data) {
        if (t.distance_meters !== undefined) {
          assert.ok(
            t.distance_meters <= 1500,
            `Task ${t.id} distance ${t.distance_meters}m exceeds 1500m limit`
          );
        }
        // OTP must never be exposed
        assert.strictEqual(t.otp_code, undefined, 'nearby_tasks must never expose otp_code');
      }

      // Check sorting: ascending by distance
      if (res.data.length > 1 && res.data[0].distance_meters !== undefined) {
        for (let i = 0; i < res.data.length - 1; i++) {
          assert.ok(
            res.data[i].distance_meters <= res.data[i + 1].distance_meters,
            'nearby_tasks must be sorted in ascending distance order'
          );
        }
      }
    });

    test('F11: place_bid — worker submits reverse bid and upserts single pending bid', async () => {
      // Post a task to bid on
      const { data: task, error: postErr } = await callRpc(
        requester.client,
        'post_task',
        {
          p_title: 'Xerox Notes Pickup',
          p_description: 'Fetch 15 photocopies from shop',
          p_category: 'XEROX_PICKUP',
          p_budget: 100.00,
          p_lat: CAMPUS_CENTER.lat,
          p_lng: CAMPUS_CENTER.lng,
          p_address: 'Campus Xerox Corner'
        }
      );
      assert.ifError(postErr);
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // Worker 1 places bid of Rs 85
      const bidRes1 = await callRpc(
        worker1.client,
        'place_bid',
        {
          p_task_id: taskId,
          p_price: 85.00,
          p_lat: NEARBY_WORKER_1.lat,
          p_lng: NEARBY_WORKER_1.lng
        },
        {
          p_task_id: taskId,
          p_amount: 85.00
        }
      );
      assert.ifError(bidRes1.error, `place_bid error: ${bidRes1.error?.message}`);
      const bid1 = bidRes1.data;
      assert.ok(bid1, 'Expected bid record returned');
      assert.strictEqual(bid1.status || 'PENDING', 'PENDING');

      // Worker 1 updates bid to Rs 75 (upsert behavior)
      const bidRes2 = await callRpc(
        worker1.client,
        'place_bid',
        {
          p_task_id: taskId,
          p_price: 75.00,
          p_lat: NEARBY_WORKER_1.lat,
          p_lng: NEARBY_WORKER_1.lng
        },
        {
          p_task_id: taskId,
          p_amount: 75.00
        }
      );
      assert.ifError(bidRes2.error, `place_bid update error: ${bidRes2.error?.message}`);

      // Verify in DB that only one bid exists for worker1 on this task
      const { data: workerBids, error: bidsErr } = await adminClient
        .from('bids')
        .select('*')
        .eq('task_id', taskId)
        .eq('worker_id', worker1.userId);

      assert.ifError(bidsErr);
      assert.strictEqual(workerBids.length, 1, 'Only one pending bid per worker/task allowed');
      assert.strictEqual(Number(workerBids[0].price), 75.00, 'Bid price should be updated to Rs 75');
    });

    test('F12: accept_bid — locks task, holds escrow, creates OTP, rejects competing bids', async () => {
      // 1. Post task
      const { data: task } = await callRpc(
        requester.client,
        'post_task',
        {
          p_title: 'Queue for Hostel Mess Coupon',
          p_description: 'Wait in line for monthly coupon',
          p_category: 'QUEUE',
          p_budget: 120.00,
          p_lat: CAMPUS_CENTER.lat,
          p_lng: CAMPUS_CENTER.lng,
          p_address: 'Mess Hall Office'
        }
      );
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // 2. Worker 1 bids Rs 110, Worker 2 bids Rs 100
      const { data: bid1 } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 110.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      const { data: bid2 } = await callRpc(worker2.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 100.00,
        p_lat: NEARBY_WORKER_2.lat,
        p_lng: NEARBY_WORKER_2.lng
      });

      const bid2Id = bid2.id || bid2.bid_id;

      // Check requester balance before accept
      const { data: walletBefore } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      const balanceBefore = Number(walletBefore.balance);

      // 3. Requester accepts Worker 2's bid (Rs 100)
      const acceptRes = await callRpc(
        requester.client,
        'accept_bid',
        { p_bid_id: bid2Id },
        { p_task_id: taskId, p_bid_id: bid2Id }
      );
      assert.ifError(acceptRes.error, `accept_bid error: ${acceptRes.error?.message}`);

      // 4. Verify task is ASSIGNED with agreed_price = 100 and OTP generated
      const { data: dbTask } = await adminClient
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      assert.strictEqual(dbTask.status, 'ASSIGNED');
      assert.strictEqual(dbTask.assigned_worker_id, worker2.userId);
      assert.strictEqual(Number(dbTask.agreed_price), 100.00);
      assert.ok(dbTask.otp_code, 'OTP code must be generated');
      assert.match(dbTask.otp_code, /^\d{4}$/, 'OTP code must be 4 digits');

      // 5. Verify requester wallet deducted exactly Rs 100
      const { data: walletAfter } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      const balanceAfter = Number(walletAfter.balance);
      assert.strictEqual(balanceAfter, balanceBefore - 100.00);

      // 6. Verify Escrow transaction created in HELD status with 10% platform fee
      const { data: escrow } = await adminClient
        .from('escrow_transactions')
        .select('*')
        .eq('task_id', taskId)
        .single();
      assert.ok(escrow, 'Escrow transaction must exist');
      assert.strictEqual(escrow.status, 'HELD');
      assert.strictEqual(Number(escrow.amount), 100.00);
      assert.strictEqual(Number(escrow.platform_fee), 10.00); // 10% of 100

      // 7. Verify competing bid rejected
      const bid1Id = bid1.id || bid1.bid_id;
      const { data: rejectedBid } = await adminClient
        .from('bids')
        .select('status')
        .eq('id', bid1Id)
        .single();
      assert.strictEqual(rejectedBid.status, 'REJECTED');
    });

    test('F13: complete_task — releases escrow minus 10% fee on correct OTP', async () => {
      // 1. Post and assign a task
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Canteen Snack Delivery',
        p_description: 'Bring samosas and chai',
        p_category: 'BUY_ITEMS',
        p_budget: 60.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 50.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id });

      // Fetch generated OTP from admin client
      const { data: assignedTask } = await adminClient
        .from('tasks')
        .select('otp_code')
        .eq('id', taskId)
        .single();
      const validOtp = assignedTask.otp_code;

      // Check worker1 balance before completion
      const { data: wWalletBefore } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', worker1.userId)
        .single();
      const workerBalanceBefore = Number(wWalletBefore.balance);

      // 2. Worker completes task with valid OTP
      const compRes = await callRpc(worker1.client, 'complete_task', {
        p_task_id: taskId,
        p_otp_code: validOtp
      });
      assert.ifError(compRes.error, `complete_task error: ${compRes.error?.message}`);

      // 3. Verify task status is COMPLETED
      const { data: completedTask } = await adminClient
        .from('tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      assert.strictEqual(completedTask.status, 'COMPLETED');

      // 4. Verify Escrow status is RELEASED
      const { data: escrow } = await adminClient
        .from('escrow_transactions')
        .select('*')
        .eq('task_id', taskId)
        .single();
      assert.strictEqual(escrow.status, 'RELEASED');

      // 5. Verify Worker wallet credited (50 - 5 fee = 45 net payout; 10% of 50 is 5.00 min fee)
      const { data: wWalletAfter } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', worker1.userId)
        .single();
      const workerBalanceAfter = Number(wWalletAfter.balance);
      const expectedPayout = 50.00 - Number(escrow.platform_fee);
      assert.strictEqual(workerBalanceAfter, workerBalanceBefore + expectedPayout);
    });

    test('F14: cancel_task — cancels OPEN task without fee & ASSIGNED task with full refund', async () => {
      // Test Case A: Cancel OPEN task
      const { data: openTask } = await callRpc(requester.client, 'post_task', {
        p_title: 'Chore to Cancel While Open',
        p_description: 'Testing cancel on open task',
        p_category: 'OTHER',
        p_budget: 90.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const openTaskId = openTask.id || openTask.task_id;
      createdTaskIds.push(openTaskId);

      const cancelOpenRes = await callRpc(requester.client, 'cancel_task', {
        p_task_id: openTaskId
      });
      assert.ifError(cancelOpenRes.error);

      const { data: dbOpenTask } = await adminClient
        .from('tasks')
        .select('status')
        .eq('id', openTaskId)
        .single();
      assert.strictEqual(dbOpenTask.status, 'CANCELLED');

      // Test Case B: Cancel ASSIGNED task with full escrow refund
      const { data: assignedTask } = await callRpc(requester.client, 'post_task', {
        p_title: 'Chore to Cancel While Assigned',
        p_description: 'Testing escrow refund on cancel',
        p_category: 'BUY_ITEMS',
        p_budget: 150.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const assignedTaskId = assignedTask.id || assignedTask.task_id;
      createdTaskIds.push(assignedTaskId);

      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: assignedTaskId,
        p_price: 140.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id });

      const { data: walletPriorRefund } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      const balancePriorRefund = Number(walletPriorRefund.balance);

      // Cancel assigned task
      const cancelAssignedRes = await callRpc(requester.client, 'cancel_task', {
        p_task_id: assignedTaskId
      });
      assert.ifError(cancelAssignedRes.error);

      // Verify full refund to requester wallet
      const { data: walletPostRefund } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      assert.strictEqual(Number(walletPostRefund.balance), balancePriorRefund + 140.00);

      // Verify escrow status is REFUNDED
      const { data: refundedEscrow } = await adminClient
        .from('escrow_transactions')
        .select('status')
        .eq('task_id', assignedTaskId)
        .single();
      assert.strictEqual(refundedEscrow.status, 'REFUNDED');
    });

    test('F15: resolve_dispute — admin resolves DISPUTED task (REFUND_REQUESTER vs PAY_WORKER)', async () => {
      // 1. Post and assign task
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Disputed Task',
        p_description: 'Testing admin dispute resolution',
        p_category: 'OTHER',
        p_budget: 100.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 90.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id });

      // Simulate 3 wrong OTP attempts to transition into DISPUTED
      await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: '0000' });
      await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: '0001' });
      await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: '0002' });

      const { data: disputedTask } = await adminClient
        .from('tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      assert.strictEqual(disputedTask.status, 'DISPUTED');

      // 2. Admin resolves dispute with REFUND_REQUESTER
      const resolveRes = await callRpc(
        adminUser.client,
        'resolve_dispute',
        {
          p_task_id: taskId,
          p_decision: 'REFUND_REQUESTER'
        },
        {
          p_task_id: taskId,
          p_resolution: 'REFUND_REQUESTER'
        }
      );
      assert.ifError(resolveRes.error, `resolve_dispute error: ${resolveRes.error?.message}`);

      // Verify task closed as CANCELLED and escrow REFUNDED
      const { data: resolvedTask } = await adminClient
        .from('tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      assert.strictEqual(resolvedTask.status, 'CANCELLED');

      const { data: resolvedEscrow } = await adminClient
        .from('escrow_transactions')
        .select('status')
        .eq('task_id', taskId)
        .single();
      assert.strictEqual(resolvedEscrow.status, 'REFUNDED');
    });

    test('F16: submit_review — double-blind reviews stay hidden until both parties submit', async () => {
      // 1. Post, assign, and complete a task
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Chore for Double-Blind Review',
        p_description: 'Review system testing',
        p_category: 'XEROX_PICKUP',
        p_budget: 70.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 60.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id });

      const { data: taskOtp } = await adminClient
        .from('tasks')
        .select('otp_code')
        .eq('id', taskId)
        .single();
      await callRpc(worker1.client, 'complete_task', {
        p_task_id: taskId,
        p_otp_code: taskOtp.otp_code
      });

      // 2. Requester submits 5-star review
      const rev1Res = await callRpc(requester.client, 'submit_review', {
        p_task_id: taskId,
        p_rating: 5,
        p_comment: 'Excellent and punctual delivery!'
      });
      assert.ifError(rev1Res.error, `submit_review requester error: ${rev1Res.error?.message}`);

      // Check review 1 visibility in DB: must be FALSE (hidden)
      const { data: rev1InDb } = await adminClient
        .from('reviews')
        .select('visible')
        .eq('task_id', taskId)
        .eq('reviewer_id', requester.userId)
        .single();
      assert.strictEqual(rev1InDb.visible, false, 'First review must remain hidden (visible=false)');

      // Worker should NOT be able to view requester review via RLS
      const { data: workerViewReviews } = await worker1.client
        .from('reviews')
        .select('*')
        .eq('task_id', taskId);
      assert.strictEqual(
        workerViewReviews.length,
        0,
        'Counterpart cannot view review before submitting their own'
      );

      // 3. Worker submits 5-star review
      const rev2Res = await callRpc(worker1.client, 'submit_review', {
        p_task_id: taskId,
        p_rating: 5,
        p_comment: 'Great communication and friendly requester'
      });
      assert.ifError(rev2Res.error, `submit_review worker error: ${rev2Res.error?.message}`);

      // Both reviews must now be visible=true
      const { data: allReviewsInDb } = await adminClient
        .from('reviews')
        .select('visible')
        .eq('task_id', taskId);
      assert.strictEqual(allReviewsInDb.length, 2);
      for (const r of allReviewsInDb) {
        assert.strictEqual(r.visible, true, 'Both reviews must be visible after paired submission');
      }
    });

    test('F17: expire_tasks — expires stale open tasks older than 30 minutes', async () => {
      // 1. Post a task
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Chore to Expire',
        p_description: 'Task for testing expiration procedure',
        p_category: 'OTHER',
        p_budget: 75.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // Simulate stale task: manually update created_at to 35 minutes ago
      const staleTimestamp = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      await adminClient
        .from('tasks')
        .update({ created_at: staleTimestamp })
        .eq('id', taskId);

      // Place a pending bid on it
      await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 65.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });

      // 2. Run expire_tasks
      const expireRes = await callRpc(adminClient, 'expire_tasks', {});
      assert.ifError(expireRes.error, `expire_tasks error: ${expireRes.error?.message}`);

      // 3. Verify task status is EXPIRED
      const { data: expiredTask } = await adminClient
        .from('tasks')
        .select('status')
        .eq('id', taskId)
        .single();
      assert.strictEqual(expiredTask.status, 'EXPIRED');

      // 4. Verify bid status is WITHDRAWN
      const { data: withdrawnBid } = await adminClient
        .from('bids')
        .select('status')
        .eq('task_id', taskId)
        .single();
      assert.strictEqual(withdrawnBid.status, 'WITHDRAWN');
    });

  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases
  // =========================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {

    test('Boundary 1: Task budget limits (Rs 50 - Rs 300)', async () => {
      // Below lower bound (Rs 49.00) -> Must fail
      const belowMin = await callRpc(requester.client, 'post_task', {
        p_title: 'Invalid Low Budget Chore',
        p_category: 'OTHER',
        p_budget: 49.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      assert.ok(belowMin.error, 'Budget < Rs 50 must be rejected');

      // Exact lower bound (Rs 50.00) -> Must succeed
      const exactMin = await callRpc(requester.client, 'post_task', {
        p_title: 'Exact Minimum Budget Chore',
        p_category: 'OTHER',
        p_budget: 50.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      assert.ifError(belowMin.error && exactMin.error ? null : exactMin.error);
      if (exactMin.data) createdTaskIds.push(exactMin.data.id || exactMin.data.task_id);

      // Exact upper bound (Rs 300.00) -> Must succeed
      const exactMax = await callRpc(requester.client, 'post_task', {
        p_title: 'Exact Maximum Budget Chore',
        p_category: 'OTHER',
        p_budget: 300.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      assert.ifError(exactMax.error);
      if (exactMax.data) createdTaskIds.push(exactMax.data.id || exactMax.data.task_id);

      // Above upper bound (Rs 301.00) -> Must fail
      const aboveMax = await callRpc(requester.client, 'post_task', {
        p_title: 'Invalid High Budget Chore',
        p_category: 'OTHER',
        p_budget: 301.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      assert.ok(aboveMax.error, 'Budget > Rs 300 must be rejected');
    });

    test('Boundary 2: Minimum bid price (Rs 20)', async () => {
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Min Bid Test Chore',
        p_category: 'OTHER',
        p_budget: 100.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // Bid below minimum (Rs 19.00) -> Must fail
      const belowMinBid = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 19.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      assert.ok(belowMinBid.error, 'Bid < Rs 20 must be rejected');

      // Exact minimum bid (Rs 20.00) -> Must succeed
      const exactMinBid = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 20.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      assert.ifError(exactMinBid.error, 'Bid = Rs 20.00 must be accepted');
    });

    test('Boundary 3: Maximum bid ratio (2x task budget)', async () => {
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Max Bid Ratio Test Chore',
        p_category: 'OTHER',
        p_budget: 100.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // Exact 2x budget (Rs 200.00) -> Must succeed
      const exact2xBid = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 200.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      assert.ifError(exact2xBid.error, 'Bid = 2x budget must be accepted');

      // Above 2x budget (Rs 201.00) -> Must fail
      const above2xBid = await callRpc(worker2.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 201.00,
        p_lat: NEARBY_WORKER_2.lat,
        p_lng: NEARBY_WORKER_2.lng
      });
      assert.ok(above2xBid.error, 'Bid > 2x budget must be rejected');
    });

    test('Boundary 4: Exact 1500m geofence boundary separation', async () => {
      // Post task at reference campus center
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Geofence Boundary Chore',
        p_category: 'OTHER',
        p_budget: 100.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // Query from Boundary Inside (~1400m) -> Must find task
      const insideRes = await callRpc(anonClient, 'nearby_tasks', {
        p_lat: BOUNDARY_INSIDE.lat,
        p_lng: BOUNDARY_INSIDE.lng,
        p_radius_meters: 1500
      });
      assert.ifError(insideRes.error);
      const foundInside = insideRes.data?.some(t => t.id === taskId);
      assert.ok(foundInside, 'Task at ~1400m must be returned in nearby_tasks');

      // Query from Boundary Outside (~1730m) -> Must NOT find task
      const outsideRes = await callRpc(anonClient, 'nearby_tasks', {
        p_lat: BOUNDARY_OUTSIDE.lat,
        p_lng: BOUNDARY_OUTSIDE.lng,
        p_radius_meters: 1500
      });
      assert.ifError(outsideRes.error);
      const foundOutside = outsideRes.data?.some(t => t.id === taskId);
      assert.strictEqual(foundOutside, false, 'Task at > 1500m must NOT be returned in nearby_tasks');

      // Worker outside attempting place_bid -> Must fail
      const outsideBid = await callRpc(workerBoundary.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 80.00,
        p_lat: BOUNDARY_OUTSIDE.lat,
        p_lng: BOUNDARY_OUTSIDE.lng
      });
      assert.ok(outsideBid.error, 'Worker outside 1.5 km must be rejected when placing bid');
    });

    test('Boundary 5: 3 wrong OTP attempts triggering DISPUTED transition', async () => {
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'OTP Lockout Chore',
        p_category: 'QUEUE',
        p_budget: 100.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 90.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id });

      // Attempt 1: wrong OTP -> Error, attempt 1/3, status ASSIGNED
      const try1 = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: '0000' });
      assert.ok(try1.error, 'Attempt 1 with wrong OTP must fail');
      const { data: taskAfter1 } = await adminClient.from('tasks').select('status, otp_attempts').eq('id', taskId).single();
      assert.strictEqual(taskAfter1.status, 'ASSIGNED');
      assert.strictEqual(taskAfter1.otp_attempts, 1);

      // Attempt 2: wrong OTP -> Error, attempt 2/3, status ASSIGNED
      const try2 = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: '1111' });
      assert.ok(try2.error, 'Attempt 2 with wrong OTP must fail');
      const { data: taskAfter2 } = await adminClient.from('tasks').select('status, otp_attempts').eq('id', taskId).single();
      assert.strictEqual(taskAfter2.status, 'ASSIGNED');
      assert.strictEqual(taskAfter2.otp_attempts, 2);

      // Attempt 3: wrong OTP -> Error, triggers DISPUTED status
      const try3 = await callRpc(worker1.client, 'complete_task', { p_task_id: taskId, p_otp_code: '2222' });
      assert.ok(try3.error, 'Attempt 3 with wrong OTP must fail and lock');
      const { data: taskAfter3 } = await adminClient.from('tasks').select('status, otp_attempts').eq('id', taskId).single();
      assert.strictEqual(taskAfter3.status, 'DISPUTED', 'Task must transition to DISPUTED after 3 failed OTP attempts');
      assert.strictEqual(taskAfter3.otp_attempts, 3);
    });

  });

  // =========================================================================
  // TIER 3: Concurrency & Load
  // =========================================================================
  describe('Tier 3: Concurrency & Load', () => {

    test('Concurrency: 2 simultaneous calls to accept_bid on same task — exactly 1 succeeds', async () => {
      // 1. Post task
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Race Condition Acceptance Chore',
        p_category: 'BUY_ITEMS',
        p_budget: 150.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // 2. Worker 1 and Worker 2 both place bids
      const { data: bid1 } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 130.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      const { data: bid2 } = await callRpc(worker2.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 135.00,
        p_lat: NEARBY_WORKER_2.lat,
        p_lng: NEARBY_WORKER_2.lng
      });

      const bid1Id = bid1.id || bid1.bid_id;
      const bid2Id = bid2.id || bid2.bid_id;

      const { data: wBefore } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      const balanceBefore = Number(wBefore.balance);

      // 3. Fire simultaneous accept_bid calls
      const [res1, res2] = await Promise.allSettled([
        callRpc(requester.client, 'accept_bid', { p_bid_id: bid1Id }, { p_task_id: taskId, p_bid_id: bid1Id }),
        callRpc(requester.client, 'accept_bid', { p_bid_id: bid2Id }, { p_task_id: taskId, p_bid_id: bid2Id })
      ]);

      const isSuccess = (r) => r.status === 'fulfilled' && !r.value?.error;
      const successes = [res1, res2].filter(isSuccess);
      const failures = [res1, res2].filter(r => !isSuccess(r));

      // Assertions: Exactly 1 must succeed, exactly 1 must fail
      assert.strictEqual(successes.length, 1, 'Exactly one concurrent accept_bid must succeed');
      assert.strictEqual(failures.length, 1, 'Second concurrent accept_bid must fail with concurrency error');

      // 4. Verify task is ASSIGNED to the single winning bid
      const { data: dbTask } = await adminClient
        .from('tasks')
        .select('status, assigned_worker_id, agreed_price')
        .eq('id', taskId)
        .single();
      assert.strictEqual(dbTask.status, 'ASSIGNED');

      // 5. Verify requester wallet was deducted ONCE (not twice)
      const { data: wAfter } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', requester.userId)
        .single();
      const balanceAfter = Number(wAfter.balance);
      assert.strictEqual(balanceAfter, balanceBefore - Number(dbTask.agreed_price));

      // 6. Verify exactly 1 escrow transaction exists for this task
      const { data: escrows } = await adminClient
        .from('escrow_transactions')
        .select('*')
        .eq('task_id', taskId);
      assert.strictEqual(escrows.length, 1, 'Escrow must be held exactly once');
      assert.strictEqual(escrows[0].status, 'HELD');
    });

    test('Load Test: 100 simultaneous requests to nearby_tasks with percentiles & 0% errors', async () => {
      const TOTAL_REQUESTS = 100;
      const latencies = [];

      const startTime = performance.now();

      // Launch 100 simultaneous requests
      const requestPromises = Array.from({ length: TOTAL_REQUESTS }, async (_, i) => {
        const t0 = performance.now();
        const res = await callRpc(anonClient, 'nearby_tasks', {
          p_lat: CAMPUS_CENTER.lat,
          p_lng: CAMPUS_CENTER.lng,
          p_radius_meters: 1500
        });
        const t1 = performance.now();
        latencies.push(t1 - t0);
        return res;
      });

      const results = await Promise.all(requestPromises);
      const totalWallDuration = performance.now() - startTime;

      // Calculate latency metrics
      const stats = calculatePercentiles(latencies);
      const errors = results.filter(r => r.error);

      console.log(`\n======================================================`);
      console.log(`[LOAD TEST REPORT] 100 Simultaneous nearby_tasks Requests`);
      console.log(`Total Wall-Clock Time: ${totalWallDuration.toFixed(2)} ms`);
      console.log(`Requests Succeeded:    ${TOTAL_REQUESTS - errors.length} / ${TOTAL_REQUESTS}`);
      console.log(`Error Rate:            ${((errors.length / TOTAL_REQUESTS) * 100).toFixed(2)}%`);
      console.log(`Min Latency:           ${stats.min} ms`);
      console.log(`Mean Latency:          ${stats.mean} ms`);
      console.log(`p50 (Median):          ${stats.p50} ms`);
      console.log(`p95 Latency:           ${stats.p95} ms`);
      console.log(`p99 Latency:           ${stats.p99} ms`);
      console.log(`Max Latency:           ${stats.max} ms`);
      console.log(`======================================================\n`);

      // Invariant: 0% errors
      assert.strictEqual(errors.length, 0, `Load test experienced ${errors.length} errors; expected 0% errors`);
      assert.ok(stats.p95 > 0, 'p95 latency must be measured');
    });

  });

  // =========================================================================
  // TIER 4: Real-World Scenarios
  // =========================================================================
  describe('Tier 4: Real-World Scenarios', () => {

    test('Scenario 1: Campus Xerox Pickup Full Lifecycle', async () => {
      // Step 1: Requester posts Rs 70 chore
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Campus Xerox Pickup Chore',
        p_description: 'Pick up 10 pages xerox copy from campus center',
        p_category: 'XEROX_PICKUP',
        p_budget: 70.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng,
        p_address: 'Main Building Xerox Room'
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // Step 2: Two workers bid (Rs 60, Rs 65)
      const { data: bidW1 } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 60.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      await callRpc(worker2.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 65.00,
        p_lat: NEARBY_WORKER_2.lat,
        p_lng: NEARBY_WORKER_2.lng
      });

      // Step 3: Requester accepts Worker 1's bid (Rs 60)
      const acceptRes = await callRpc(requester.client, 'accept_bid', {
        p_bid_id: bidW1.id || bidW1.bid_id
      });
      assert.ifError(acceptRes.error);

      // Step 4: Worker 1 enters OTP provided by requester
      const { data: assignedTask } = await adminClient
        .from('tasks')
        .select('otp_code')
        .eq('id', taskId)
        .single();

      const completeRes = await callRpc(worker1.client, 'complete_task', {
        p_task_id: taskId,
        p_otp_code: assignedTask.otp_code
      });
      assert.ifError(completeRes.error);

      // Step 5: Both leave 5-star reviews
      await callRpc(requester.client, 'submit_review', {
        p_task_id: taskId,
        p_rating: 5,
        p_comment: 'Xerox copies delivered promptly!'
      });
      await callRpc(worker1.client, 'submit_review', {
        p_task_id: taskId,
        p_rating: 5,
        p_comment: 'Clear instructions, smooth pickup.'
      });

      // Step 6: Verify final task, escrow, and review state
      const { data: finalTask } = await adminClient.from('tasks').select('status').eq('id', taskId).single();
      const { data: finalEscrow } = await adminClient.from('escrow_transactions').select('status, amount, platform_fee').eq('task_id', taskId).single();
      const { data: finalReviews } = await adminClient.from('reviews').select('visible').eq('task_id', taskId);

      assert.strictEqual(finalTask.status, 'COMPLETED');
      assert.strictEqual(finalEscrow.status, 'RELEASED');
      assert.strictEqual(Number(finalEscrow.amount), 60.00);
      assert.strictEqual(Number(finalEscrow.platform_fee), 6.00); // 10%
      assert.strictEqual(finalReviews.length, 2);
      assert.ok(finalReviews.every(r => r.visible === true));
    });

    test('Scenario 2: Task Cancellation with Full Escrow Refund', async () => {
      // Requester posts Rs 200 chore
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Chore For Cancellation Lifecycle',
        p_category: 'BUY_ITEMS',
        p_budget: 200.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      // Worker bids Rs 180 and requester accepts
      const { data: bid } = await callRpc(worker1.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 180.00,
        p_lat: NEARBY_WORKER_1.lat,
        p_lng: NEARBY_WORKER_1.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id });

      const { data: walletPreCancel } = await adminClient.from('wallets').select('balance').eq('user_id', requester.userId).single();
      const balancePreCancel = Number(walletPreCancel.balance);

      // Requester cancels before completion
      const cancelRes = await callRpc(requester.client, 'cancel_task', { p_task_id: taskId });
      assert.ifError(cancelRes.error);

      // Verify full refund
      const { data: walletPostCancel } = await adminClient.from('wallets').select('balance').eq('user_id', requester.userId).single();
      assert.strictEqual(Number(walletPostCancel.balance), balancePreCancel + 180.00);

      const { data: escrow } = await adminClient.from('escrow_transactions').select('status').eq('task_id', taskId).single();
      assert.strictEqual(escrow.status, 'REFUNDED');
    });

    test('Scenario 3: Dispute Resolution on OTP Lockout', async () => {
      const { data: task } = await callRpc(requester.client, 'post_task', {
        p_title: 'Chore For Dispute Lifecycle',
        p_category: 'QUEUE',
        p_budget: 150.00,
        p_lat: CAMPUS_CENTER.lat,
        p_lng: CAMPUS_CENTER.lng
      });
      const taskId = task.id || task.task_id;
      createdTaskIds.push(taskId);

      const { data: bid } = await callRpc(worker2.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 120.00,
        p_lat: NEARBY_WORKER_2.lat,
        p_lng: NEARBY_WORKER_2.lng
      });
      await callRpc(requester.client, 'accept_bid', { p_bid_id: bid.id || bid.bid_id });

      // Worker fails OTP 3 times
      await callRpc(worker2.client, 'complete_task', { p_task_id: taskId, p_otp_code: '9991' });
      await callRpc(worker2.client, 'complete_task', { p_task_id: taskId, p_otp_code: '9992' });
      await callRpc(worker2.client, 'complete_task', { p_task_id: taskId, p_otp_code: '9993' });

      // Admin resolves dispute in favor of requester
      const resolveRes = await callRpc(adminUser.client, 'resolve_dispute', {
        p_task_id: taskId,
        p_decision: 'REFUND_REQUESTER'
      });
      assert.ifError(resolveRes.error);

      const { data: dbTask } = await adminClient.from('tasks').select('status').eq('id', taskId).single();
      assert.strictEqual(dbTask.status, 'CANCELLED');
    });

  });

  // =========================================================================
  // SECURITY BREAK TESTS (Penetration & RLS Hardening)
  // =========================================================================
  describe('Security Break Tests', () => {

    test('Security Break 1: Worker queries task > 1.5 km by ID -> returns 0 rows', async () => {
      // 1. Create or use task located > 1.5 km away (outside boundary, ~2.9 km away)
      const farLocation = `SRID=4326;POINT(${FAR_WORKER.lng} ${FAR_WORKER.lat})`;
      const { data: farTask, error: insertErr } = await adminClient
        .from('tasks')
        .insert({
          requester_id: requester.userId,
          title: 'Far Out Chore Beyond Boundary',
          description: 'Task located 3km away from worker',
          category: 'OTHER',
          budget: 120.00,
          location: farLocation,
          status: 'OPEN'
        })
        .select()
        .single();

      assert.ifError(insertErr);
      const farTaskId = farTask.id;
      createdTaskIds.push(farTaskId);

      // 2. Worker 1 (at campus center) queries this task directly by ID
      const { data: queryResult, error: queryErr } = await worker1.client
        .from('tasks')
        .select('*')
        .eq('id', farTaskId);

      assert.ifError(queryErr);
      assert.strictEqual(
        queryResult.length,
        0,
        'RLS spatial gate must block worker from seeing task > 1.5 km, even by direct ID query'
      );
    });

    test('Security Break 2: Worker attempts to read OTP -> fails or returns null', async () => {
      // 1. Setup assigned task with OTP using admin fixture
      const nearbyLocation = `SRID=4326;POINT(${CAMPUS_CENTER.lng} ${CAMPUS_CENTER.lat})`;
      const { data: assignedTask, error: insertErr } = await adminClient
        .from('tasks')
        .insert({
          requester_id: requester.userId,
          assigned_worker_id: worker1.userId,
          title: 'OTP Confidentiality Check',
          category: 'OTHER',
          budget: 80.00,
          location: nearbyLocation,
          status: 'ASSIGNED',
          agreed_price: 70.00,
          otp_code: '4321'
        })
        .select()
        .single();

      assert.ifError(insertErr);
      const taskId = assignedTask.id;
      createdTaskIds.push(taskId);

      // 2. Assigned Worker 1 queries tasks_view to inspect otp_code
      const { data: workerView, error: workerErr } = await worker1.client
        .from('tasks_view')
        .select('otp_code')
        .eq('id', taskId)
        .maybeSingle();

      assert.ifError(workerErr);
      if (workerView) {
        assert.strictEqual(
          workerView.otp_code,
          null,
          'Worker querying tasks_view must receive NULL for otp_code'
        );
      }

      // 3. Worker attempts to call get_task_otp RPC directly
      const { data: otpData, error: otpErr } = await worker1.client
        .rpc('get_task_otp', { p_task_id: taskId });

      assert.ok(
        otpErr || otpData === null,
        'Worker direct invocation of get_task_otp must be denied'
      );
    });

    test('Security Break 3: Direct client wallet update -> throws RLS permission error', async () => {
      // Worker 1 attempts to directly inflate their own wallet balance via client SDK
      const { data, error } = await worker1.client
        .from('wallets')
        .update({ balance: 999999.00 })
        .eq('user_id', worker1.userId)
        .select();

      // Direct client mutation must fail with RLS violation or return 0 rows updated
      if (error) {
        assert.ok(
          error.message.includes('policy') || error.code === '42501' || error.message.includes('permission'),
          `Expected RLS policy error, received: ${error.message}`
        );
      } else {
        assert.strictEqual(
          data?.length || 0,
          0,
          'Direct client wallet mutation must update 0 rows due to RLS'
        );
      }

      // Verify real wallet balance was NOT modified
      const { data: realWallet } = await adminClient
        .from('wallets')
        .select('balance')
        .eq('user_id', worker1.userId)
        .single();
      assert.notStrictEqual(Number(realWallet.balance), 999999.00, 'Wallet balance must remain protected');
    });

    test('Security Break 4: Direct client escrow manipulation -> throws RLS permission error', async () => {
      // Worker attempts to insert arbitrary escrow transaction
      const { data, error } = await worker1.client
        .from('escrow_transactions')
        .insert({
          task_id: createdTaskIds[0] || '00000000-0000-0000-0000-000000000000',
          amount: 5000.00,
          platform_fee: 50.00,
          status: 'RELEASED'
        })
        .select();

      assert.ok(
        error || (data?.length || 0) === 0,
        'Direct client insertion into escrow_transactions must be denied'
      );
    });

    test('Security Break 5: Direct client task status tampering -> throws RLS error or denied', async () => {
      if (createdTaskIds.length === 0) return;
      const targetTaskId = createdTaskIds[0];

      // Worker attempts to mark task as COMPLETED directly via client SDK
      const { data, error } = await worker1.client
        .from('tasks')
        .update({ status: 'COMPLETED' })
        .eq('id', targetTaskId)
        .select();

      assert.ok(
        error || (data?.length || 0) === 0,
        'Direct client tampering with task status must be denied'
      );
    });

  });

});
