import assert from 'node:assert/strict';
import {
  getAdminClient,
  getAnonClient,
  getOrCreateTestUser
} from './helpers.js';

// Coordinates
const CAMPUS_CENTER = { lat: 13.0184, lng: 77.5684 };
const NEARBY_WORKER = { lat: 13.0190, lng: 77.5690 }; // ~100m away
const FAR_WORKER = { lat: 13.0450, lng: 77.5684 }; // ~2.9 km away
const OUTSIDE_LOCATION = { lat: 13.0460, lng: 77.5684 }; // ~3.0 km away

async function runAdversarialProbing() {
  console.log('================================================================');
  console.log('WHAP Milestone 1: EMPIRICAL ADVERSARIAL CHALLENGE SUITE');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  const adminClient = getAdminClient();
  const anonClient = getAnonClient();

  const results = {
    passed: 0,
    failed: 0,
    findings: []
  };

  function recordPass(testName, details) {
    results.passed++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       Details: ${details}`);
  }

  function recordFail(testName, reason) {
    results.failed++;
    results.findings.push({ testName, reason });
    console.error(`[FAIL / VULNERABILITY FOUND] ${testName}`);
    console.error(`       Reason: ${reason}`);
  }

  // Set up users
  console.log('--- Setting up test actors ---');
  const requester = await getOrCreateTestUser({
    email: 'adv_requester@whap.local',
    name: 'Adversarial Requester',
    role: 'REQUESTER',
    lat: CAMPUS_CENTER.lat,
    lng: CAMPUS_CENTER.lng,
    initialBalance: 500.00
  });

  const workerNearby = await getOrCreateTestUser({
    email: 'adv_worker_nearby@whap.local',
    name: 'Adversarial Worker Nearby',
    role: 'WORKER',
    lat: NEARBY_WORKER.lat,
    lng: NEARBY_WORKER.lng,
    initialBalance: 0.00
  });

  const workerFar = await getOrCreateTestUser({
    email: 'adv_worker_far@whap.local',
    name: 'Adversarial Worker Far',
    role: 'WORKER',
    lat: FAR_WORKER.lat,
    lng: FAR_WORKER.lng,
    initialBalance: 0.00
  });

  const workerNoLoc = await getOrCreateTestUser({
    email: 'adv_worker_noloc@whap.local',
    name: 'Adversarial Worker No Loc',
    role: 'WORKER',
    initialBalance: 0.00
  });
  // Ensure workerNoLoc has null location
  await adminClient.from('profiles').update({ location: null }).eq('id', workerNoLoc.userId);

  console.log('Actors created successfully.');

  // Create test tasks
  const campusPoint = `SRID=4326;POINT(${CAMPUS_CENTER.lng} ${CAMPUS_CENTER.lat})`;
  const outsidePoint = `SRID=4326;POINT(${OUTSIDE_LOCATION.lng} ${OUTSIDE_LOCATION.lat})`;

  // 1. Inside open task
  const { data: insideTask, error: inErr } = await adminClient
    .from('tasks')
    .insert({
      requester_id: requester.userId,
      title: 'Adv: Inside Campus Task',
      description: 'Inside 1.5km geofence',
      category: 'BUY_ITEMS',
      budget: 100.00,
      location: campusPoint,
      status: 'OPEN'
    })
    .select()
    .single();
  assert.ifError(inErr);

  // 2. Outside open task (> 1.5km)
  const { data: outsideTask, error: outErr } = await adminClient
    .from('tasks')
    .insert({
      requester_id: requester.userId,
      title: 'Adv: Far Outside Task',
      description: 'Far outside 1.5km geofence (3.0km)',
      category: 'OTHER',
      budget: 120.00,
      location: outsidePoint,
      status: 'OPEN'
    })
    .select()
    .single();
  assert.ifError(outErr);

  // 3. Inside assigned task with OTP
  const { data: assignedTask, error: assignErr } = await adminClient
    .from('tasks')
    .insert({
      requester_id: requester.userId,
      assigned_worker_id: workerNearby.userId,
      title: 'Adv: Assigned Task with Secret OTP',
      description: 'Contains secret OTP',
      category: 'OTHER',
      budget: 150.00,
      agreed_price: 130.00,
      location: campusPoint,
      status: 'ASSIGNED',
      otp_code: '7890'
    })
    .select()
    .single();
  assert.ifError(assignErr);

  const cleanupIds = [insideTask.id, outsideTask.id, assignedTask.id];

  try {
    // =========================================================================
    // ATTACK VECTOR 1: Spatial Geofence Evasion
    // =========================================================================
    console.log('\n--- ATTACK VECTOR 1: Spatial Geofence Evasion ---');

    // 1.1 Direct ID query on 'tasks' by nearby worker for outside task
    {
      const { data, error } = await workerNearby.client
        .from('tasks')
        .select('*')
        .eq('id', outsideTask.id);

      if (!error && data && data.length === 0) {
        recordPass('1.1 Worker cannot query outside task by direct ID on tasks table', 'Returned 0 rows');
      } else {
        recordFail('1.1 Worker queried outside task by direct ID on tasks table', `Returned ${data?.length} rows, error: ${error?.message}`);
      }
    }

    // 1.2 Title filter query on 'tasks' by nearby worker searching for outside task
    {
      const { data, error } = await workerNearby.client
        .from('tasks')
        .select('*')
        .ilike('title', '%Far Outside%');

      if (!error && data && data.length === 0) {
        recordPass('1.2 Worker cannot search outside task by title filter on tasks table', 'Returned 0 rows');
      } else {
        recordFail('1.2 Worker found outside task via title filter on tasks table', `Returned ${data?.length} rows`);
      }
    }

    // 1.3 PostgREST complex OR query injection attempting RLS bypass
    {
      const { data, error } = await workerNearby.client
        .from('tasks')
        .select('id, title')
        .or(`id.eq.${outsideTask.id},id.eq.${insideTask.id}`);

      // Should only return insideTask, NEVER outsideTask
      const returnedOutside = data?.some(t => t.id === outsideTask.id);
      if (!returnedOutside && data?.some(t => t.id === insideTask.id)) {
        recordPass('1.3 PostgREST OR filter cannot bypass RLS to leak outside task', 'Only inside task returned');
      } else if (returnedOutside) {
        recordFail('1.3 PostgREST OR filter leaked outside task', `Outside task was returned!`);
      } else {
        recordPass('1.3 PostgREST OR filter handled safely', `Data length: ${data?.length}`);
      }
    }

    // 1.4 PROBING tasks_view: Does tasks_view leak outside tasks?
    {
      const { data, error } = await workerNearby.client
        .from('tasks_view')
        .select('*')
        .eq('id', outsideTask.id);

      if (!error && data && data.length === 0) {
        recordPass('1.4 Worker querying tasks_view by ID for outside task returns 0 rows', 'tasks_view respects spatial boundaries');
      } else if (data && data.length > 0) {
        // High severity finding if view bypasses RLS
        recordFail('1.4 CRITICAL LEAK: tasks_view bypasses RLS and leaks task > 1.5km to worker!', `Worker queried outside task ${outsideTask.id} and got ${data.length} rows`);
      } else {
        recordPass('1.4 Worker query on tasks_view for outside task denied or empty', `Error: ${error?.message}`);
      }
    }

    // 1.5 PROBING tasks_view general list: Does tasks_view return outside tasks?
    {
      const { data, error } = await workerNearby.client
        .from('tasks_view')
        .select('id, title');

      const returnedOutside = data?.some(t => t.id === outsideTask.id);
      if (!returnedOutside) {
        recordPass('1.5 tasks_view general list does NOT contain tasks beyond 1.5km', `Total returned: ${data?.length}`);
      } else {
        recordFail('1.5 CRITICAL LEAK: tasks_view general query contains outside task!', `tasks_view leaked outside task in list`);
      }
    }

    // 1.6 Worker with NULL location: Can they see any tasks?
    {
      const { data, error } = await workerNoLoc.client
        .from('tasks')
        .select('*');

      if (!error && data && data.length === 0) {
        recordPass('1.6 Worker with NULL location sees 0 tasks', 'Worker without GPS cannot see any tasks');
      } else if (data && data.length > 0) {
        recordFail('1.6 Worker with NULL location was able to see tasks', `Returned ${data.length} tasks`);
      } else {
        recordPass('1.6 Worker with NULL location safely blocked', `Error: ${error?.message}`);
      }
    }

    // 1.7 Worker Far (> 2.9km away from campus): Can they see campus inside task?
    {
      const { data, error } = await workerFar.client
        .from('tasks')
        .select('*')
        .eq('id', insideTask.id);

      if (!error && data && data.length === 0) {
        recordPass('1.7 Far worker (2.9km away) cannot see campus task', 'Spatial filter works symmetrically relative to worker location');
      } else {
        recordFail('1.7 Far worker was able to see task 2.9km away', `Returned ${data?.length} rows`);
      }
    }

    // =========================================================================
    // ATTACK VECTOR 2: Direct Financial & Ledger Mutation Denial
    // =========================================================================
    console.log('\n--- ATTACK VECTOR 2: Direct Financial & Ledger Mutation Denial ---');

    // 2.1 Worker attempts to update own wallet balance
    {
      const { data, error } = await workerNearby.client
        .from('wallets')
        .update({ balance: 777777.00 })
        .eq('user_id', workerNearby.userId)
        .select();

      const updatedCount = data?.length || 0;
      if (updatedCount === 0 || error) {
        recordPass('2.1 Direct client UPDATE on own wallet denied by RLS', `0 rows updated. Error: ${error?.message || 'none'}`);
      } else {
        recordFail('2.1 CRITICAL VULNERABILITY: Worker updated own wallet balance!', `Updated ${updatedCount} rows`);
      }
    }

    // 2.2 Worker attempts to update requester wallet balance
    {
      const { data, error } = await workerNearby.client
        .from('wallets')
        .update({ balance: 0.00 })
        .eq('user_id', requester.userId)
        .select();

      const updatedCount = data?.length || 0;
      if (updatedCount === 0 || error) {
        recordPass('2.2 Worker cannot update requester wallet', `0 rows updated`);
      } else {
        recordFail('2.2 CRITICAL VULNERABILITY: Worker modified requester wallet!', `Updated ${updatedCount} rows`);
      }
    }

    // 2.3 Requester attempts to update own wallet balance directly
    {
      const { data, error } = await requester.client
        .from('wallets')
        .update({ balance: 999999.00 })
        .eq('user_id', requester.userId)
        .select();

      const updatedCount = data?.length || 0;
      if (updatedCount === 0 || error) {
        recordPass('2.3 Requester cannot directly inflate own wallet balance', `0 rows updated`);
      } else {
        recordFail('2.3 CRITICAL VULNERABILITY: Requester directly updated wallet balance!', `Updated ${updatedCount} rows`);
      }
    }

    // 2.4 Anonymous user attempts to update wallets
    {
      const { data, error } = await anonClient
        .from('wallets')
        .update({ balance: 100000.00 })
        .select();

      const updatedCount = data?.length || 0;
      if (updatedCount === 0 || error) {
        recordPass('2.4 Anonymous user cannot update any wallet', `0 rows updated`);
      } else {
        recordFail('2.4 Anonymous user was able to update wallets!', `Updated ${updatedCount} rows`);
      }
    }

    // 2.5 Direct INSERT into ledger_entries by worker
    {
      const { data: workerWallet } = await adminClient
        .from('wallets')
        .select('id')
        .eq('user_id', workerNearby.userId)
        .single();

      const { data, error } = await workerNearby.client
        .from('ledger_entries')
        .insert({
          wallet_id: workerWallet.id,
          type: 'TOPUP',
          amount: 50000.00
        })
        .select();

      if (error || (data?.length || 0) === 0) {
        recordPass('2.5 Direct INSERT into ledger_entries denied', `Error: ${error?.message || 'RLS denied'}`);
      } else {
        recordFail('2.5 CRITICAL VULNERABILITY: Worker inserted into ledger_entries!', `Inserted row`);
      }
    }

    // 2.6 Direct INSERT into escrow_transactions by worker
    {
      const { data, error } = await workerNearby.client
        .from('escrow_transactions')
        .insert({
          task_id: insideTask.id,
          amount: 1000.00,
          platform_fee: 100.00,
          status: 'RELEASED'
        })
        .select();

      if (error || (data?.length || 0) === 0) {
        recordPass('2.6 Direct INSERT into escrow_transactions denied', `Error: ${error?.message || 'RLS denied'}`);
      } else {
        recordFail('2.6 CRITICAL VULNERABILITY: Worker inserted into escrow_transactions!', `Inserted row`);
      }
    }

    // 2.7 Direct UPDATE on escrow_transactions by worker
    {
      const { data, error } = await workerNearby.client
        .from('escrow_transactions')
        .update({ status: 'RELEASED' })
        .eq('task_id', insideTask.id)
        .select();

      if (error || (data?.length || 0) === 0) {
        recordPass('2.7 Direct UPDATE on escrow_transactions denied', `0 rows updated`);
      } else {
        recordFail('2.7 CRITICAL VULNERABILITY: Worker updated escrow_transactions!', `Updated rows`);
      }
    }

    // 2.8 Direct DELETE on wallets by worker
    {
      const { data, error } = await workerNearby.client
        .from('wallets')
        .delete()
        .eq('user_id', requester.userId)
        .select();

      if (error || (data?.length || 0) === 0) {
        recordPass('2.8 Direct DELETE on wallets denied', `0 rows deleted`);
      } else {
        recordFail('2.8 CRITICAL VULNERABILITY: Worker deleted wallet!', `Deleted row`);
      }
    }

    // =========================================================================
    // ATTACK VECTOR 3: OTP Secrecy & Masking Probing
    // =========================================================================
    console.log('\n--- ATTACK VECTOR 3: OTP Secrecy & Masking Probing ---');

    // 3.1 Assigned Worker queries tasks_view for otp_code on assigned task
    {
      const { data, error } = await workerNearby.client
        .from('tasks_view')
        .select('id, otp_code')
        .eq('id', assignedTask.id)
        .maybeSingle();

      if (!error && (data === null || data.otp_code === null)) {
        recordPass('3.1 Assigned worker querying tasks_view receives NULL for otp_code', 'Masked successfully');
      } else if (data?.otp_code) {
        recordFail('3.1 CRITICAL LEAK: Assigned worker read secret OTP from tasks_view!', `Read OTP: ${data.otp_code}`);
      } else {
        recordPass('3.1 Assigned worker cannot read OTP from tasks_view', `Result: ${JSON.stringify(data)}`);
      }
    }

    // 3.2 Unassigned Worker queries raw tasks table for assigned task
    {
      const { data, error } = await workerFar.client
        .from('tasks')
        .select('id, otp_code, status')
        .eq('id', assignedTask.id);

      // On raw tasks table:
      // Status is ASSIGNED, and workerFar is not the assigned worker.
      // So unassigned worker querying tasks directly gets 0 rows!
      if (!error && data && data.length === 0) {
        recordPass('3.2 Unassigned worker querying raw tasks table receives 0 rows (RLS blocks non-assigned workers)', 'Raw table returns 0 rows');
      } else if (data && data.length > 0) {
        recordFail('3.2 CRITICAL LEAK: Unassigned worker read assigned task from raw tasks table!', `Read task: ${data[0].id}`);
      } else {
        recordPass('3.2 Worker query on raw tasks table safely blocked', `Error: ${error?.message}`);
      }
    }

    // 3.3 Worker invokes get_task_otp RPC
    {
      const { data, error } = await workerNearby.client
        .rpc('get_task_otp', { p_task_id: assignedTask.id });

      if (error || data === null) {
        recordPass('3.3 Worker invoking get_task_otp RPC rejected with authorization error', `Error: ${error?.message}`);
      } else {
        recordFail('3.3 CRITICAL LEAK: Worker successfully retrieved OTP via get_task_otp RPC!', `Returned: ${data}`);
      }
    }

    // 3.4 Requester invokes get_task_otp RPC (Legitimate access)
    {
      const { data, error } = await requester.client
        .rpc('get_task_otp', { p_task_id: assignedTask.id });

      if (!error && data === '7890') {
        recordPass('3.4 Legitimate requester successfully retrieves task OTP', `OTP: ${data}`);
      } else {
        recordFail('3.4 Requester could not retrieve own task OTP', `Error: ${error?.message}, data: ${data}`);
      }
    }

    // 3.5 Anonymous user invokes get_task_otp RPC
    {
      const { data, error } = await anonClient
        .rpc('get_task_otp', { p_task_id: assignedTask.id });

      if (error || data === null) {
        recordPass('3.5 Anonymous user invocation of get_task_otp denied', `Error: ${error?.message}`);
      } else {
        recordFail('3.5 Anonymous user retrieved OTP!', `Returned: ${data}`);
      }
    }

    // =========================================================================
    // ATTACK VECTOR 4: Task Status & Bid Tampering
    // =========================================================================
    console.log('\n--- ATTACK VECTOR 4: Task Status & Bid Tampering ---');

    // 4.1 Worker attempts to assign task to self directly via UPDATE on tasks
    {
      const { data, error } = await workerNearby.client
        .from('tasks')
        .update({
          assigned_worker_id: workerNearby.userId,
          status: 'ASSIGNED'
        })
        .eq('id', insideTask.id)
        .select();

      if (error || (data?.length || 0) === 0) {
        recordPass('4.1 Worker cannot directly update task status or assign self', `0 rows updated`);
      } else {
        recordFail('4.1 CRITICAL VULNERABILITY: Worker directly assigned task to self!', `Updated row`);
      }
    }

    // 4.2 Worker attempts to accept bid in bids table
    {
      // First, place a legitimate bid
      const { data: bidData, error: bidErr } = await workerNearby.client
        .from('bids')
        .insert({
          task_id: insideTask.id,
          worker_id: workerNearby.userId,
          price: 80.00
        })
        .select()
        .single();

      if (!bidErr && bidData) {
        // Attempt to update status to ACCEPTED
        const { data: hackData, error: hackErr } = await workerNearby.client
          .from('bids')
          .update({ status: 'ACCEPTED' })
          .eq('id', bidData.id)
          .select();

        // Check if status is still PENDING
        const { data: verifyBid } = await adminClient
          .from('bids')
          .select('status')
          .eq('id', bidData.id)
          .single();

        if (verifyBid.status === 'PENDING') {
          recordPass('4.2 Worker cannot change bid status to ACCEPTED', `Bid remained PENDING (hack error: ${hackErr?.message || 'none'})`);
        } else {
          recordFail('4.2 CRITICAL VULNERABILITY: Worker directly updated bid status to ACCEPTED!', `Bid status: ${verifyBid.status}`);
        }
      } else {
        console.log(`Note: Bid insert failed: ${bidErr?.message}`);
      }
    }

  } finally {
    // Teardown created tasks
    console.log('\n--- Cleaning up test fixtures ---');
    for (const id of cleanupIds) {
      await adminClient.from('tasks').delete().eq('id', id);
    }
    console.log('Cleanup complete.');
  }

  // =========================================================================
  // Summary & Findings
  // =========================================================================
  console.log('\n================================================================');
  console.log('EMPIRICAL ADVERSARIAL CHALLENGE SUMMARY');
  console.log('================================================================');
  console.log(`Total Probes Passed: ${results.passed}`);
  console.log(`Total Probes Failed: ${results.failed}`);

  if (results.findings.length > 0) {
    console.error('\nCRITICAL FINDINGS / VULNERABILITIES DETECTED:');
    results.findings.forEach((f, i) => {
      console.error(`  ${i + 1}. [${f.testName}] - ${f.reason}`);
    });
    console.log('\nCHALLENGER VERDICT: REJECT');
    return false;
  } else {
    console.log('\nALL ADVERSARIAL STRESS PROBES PASSED WITH ZERO BREACHES!');
    console.log('CHALLENGER VERDICT: APPROVE');
    return true;
  }
}

runAdversarialProbing().catch(err => {
  console.error('Adversarial testing failed with unhandled exception:', err);
  process.exit(1);
});
