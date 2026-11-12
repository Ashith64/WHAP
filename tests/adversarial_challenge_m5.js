// tests/adversarial_challenge_m5.js
// Empirical Adversarial Challenge Suite for Milestone 5
// Focus: Authentication bypass, malformed tokens, cross-user OTP snooping,
// direct REST mutations on wallets/escrow/ledger, and parameter boundary fuzzing.

import assert from 'node:assert/strict';
import {
  getAdminClient,
  getAnonClient,
  getOrCreateTestUser,
  cleanupTask,
  callRpc,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from './helpers.js';

const CAMPUS_REF = { lat: 13.0184, lng: 77.5684 };

async function runAdversarialM5() {
  console.log('================================================================');
  console.log('STARTING EMPIRICAL ADVERSARIAL PENETRATION SUITE (M5)');
  console.log('================================================================');

  const adminClient = getAdminClient();
  const anonClient = getAnonClient();
  const cleanupTasks = [];

  try {
    // 0. Setup Test Personas
    console.log('\n[Setup] Provisioning test users...');
    const requester = await getOrCreateTestUser({
      email: 'adv_m5_req@whap.local',
      name: 'Adversarial M5 Requester',
      role: 'REQUESTER',
      lat: CAMPUS_REF.lat,
      lng: CAMPUS_REF.lng,
      initialBalance: 1500.00
    });

    const legitWorker = await getOrCreateTestUser({
      email: 'adv_m5_legit_worker@whap.local',
      name: 'Legit Worker',
      role: 'WORKER',
      lat: CAMPUS_REF.lat,
      lng: CAMPUS_REF.lng,
      initialBalance: 100.00
    });

    const rogueWorker = await getOrCreateTestUser({
      email: 'adv_m5_rogue_worker@whap.local',
      name: 'Rogue Worker',
      role: 'WORKER',
      lat: CAMPUS_REF.lat,
      lng: CAMPUS_REF.lng,
      initialBalance: 100.00
    });

    // Create an assigned task with a secret OTP
    const SECRET_OTP = '9876';
    const { data: testTask, error: taskErr } = await adminClient
      .from('tasks')
      .insert({
        requester_id: requester.userId,
        assigned_worker_id: legitWorker.userId,
        title: 'Adversarial M5 Target Chore',
        description: 'Target task for adversarial intrusion probes',
        category: 'OTHER',
        budget: 150.00,
        agreed_price: 130.00,
        location: `SRID=4326;POINT(${CAMPUS_REF.lng} ${CAMPUS_REF.lat})`,
        status: 'ASSIGNED',
        otp_code: SECRET_OTP
      })
      .select()
      .single();

    assert.ifError(taskErr, `Task setup failed: ${taskErr?.message}`);
    cleanupTasks.push(testTask.id);
    console.log(`[Setup] Target task created: ${testTask.id} with secret OTP`);

    // =========================================================================
    // ATTACK 1: Unauthenticated REST Call to get_task_otp
    // =========================================================================
    console.log('\n--- ATTACK 1: Unauthenticated REST Call to get_task_otp ---');
    const unauthOtpRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_task_otp`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_task_id: testTask.id })
    });
    const unauthOtpBody = await unauthOtpRes.json();
    console.log(`[Attack 1] Status: ${unauthOtpRes.status}, Body:`, unauthOtpBody);
    // Should either be 401 Unauthorized or return null/error, never the secret OTP
    assert.notStrictEqual(unauthOtpBody, SECRET_OTP, 'Unauthenticated REST call MUST NOT return secret OTP');
    if (unauthOtpRes.ok) {
      assert.strictEqual(unauthOtpBody, null, 'If HTTP 200, OTP body must be null');
    }
    console.log('✔ ATTACK 1 DEFEATED: Unauthenticated REST cannot read OTP');

    // =========================================================================
    // ATTACK 2: Malformed JWT Bearer Token to get_task_otp
    // =========================================================================
    console.log('\n--- ATTACK 2: Malformed JWT Bearer Token to get_task_otp ---');
    const malformedJwtRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_task_otp`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed.payload',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_task_id: testTask.id })
    });
    console.log(`[Attack 2] Status: ${malformedJwtRes.status}`);
    assert.strictEqual(malformedJwtRes.status, 401, 'Malformed JWT must be rejected with HTTP 401');
    console.log('✔ ATTACK 2 DEFEATED: Malformed JWT rejected with 401 Unauthorized');

    // =========================================================================
    // ATTACK 3: Cross-User OTP Snooping by Rogue Worker via RPC
    // =========================================================================
    console.log('\n--- ATTACK 3: Cross-User OTP Snooping by Rogue Worker ---');
    const rogueOtpCall = await callRpc(rogueWorker.client, 'get_task_otp', {
      p_task_id: testTask.id
    });
    console.log(`[Attack 3] Rogue worker RPC result:`, rogueOtpCall);
    assert.ok(
      rogueOtpCall.error || rogueOtpCall.data === null,
      'Rogue worker must NOT receive OTP for task they are not assigned to'
    );
    assert.notStrictEqual(rogueOtpCall.data, SECRET_OTP, 'Rogue worker cannot inspect secret OTP');
    console.log('✔ ATTACK 3 DEFEATED: Cross-worker OTP access blocked');

    // =========================================================================
    // ATTACK 4: Unauthenticated REST Direct Mutation on Wallets
    // =========================================================================
    console.log('\n--- ATTACK 4: Unauthenticated REST Direct Mutation on Wallets ---');
    const unauthWalletRes = await fetch(`${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${rogueWorker.userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ balance: 999999.00 })
    });
    const unauthWalletData = await unauthWalletRes.json();
    console.log(`[Attack 4] Status: ${unauthWalletRes.status}, Body:`, unauthWalletData);
    // RLS should either return 0 rows or throw error
    if (Array.isArray(unauthWalletData)) {
      assert.strictEqual(unauthWalletData.length, 0, 'Unauthenticated PATCH must update 0 rows');
    }
    const { data: realRogueWallet } = await adminClient
      .from('wallets')
      .select('balance')
      .eq('user_id', rogueWorker.userId)
      .single();
    assert.notStrictEqual(Number(realRogueWallet.balance), 999999.00, 'Wallet balance was not inflated');
    console.log('✔ ATTACK 4 DEFEATED: Direct unauthenticated wallet inflation blocked');

    // =========================================================================
    // ATTACK 5: Malformed Token Direct Mutation on Wallets
    // =========================================================================
    console.log('\n--- ATTACK 5: Malformed Token Direct Mutation on Wallets ---');
    const malformedWalletRes = await fetch(`${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${rogueWorker.userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer completely_garbage_token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ balance: 888888.00 })
    });
    console.log(`[Attack 5] Status: ${malformedWalletRes.status}`);
    assert.strictEqual(malformedWalletRes.status, 401, 'Malformed JWT on wallet update must return 401');
    console.log('✔ ATTACK 5 DEFEATED: Malformed JWT on wallet update rejected');

    // =========================================================================
    // ATTACK 6: Direct Client Arbitrary Insert into ledger_entries
    // =========================================================================
    console.log('\n--- ATTACK 6: Direct Client Arbitrary Insert into ledger_entries ---');
    const rogueWalletId = (await adminClient.from('wallets').select('id').eq('user_id', rogueWorker.userId).single()).data.id;
    const { data: ledgerInsert, error: ledgerErr } = await rogueWorker.client
      .from('ledger_entries')
      .insert({
        wallet_id: rogueWalletId,
        amount: 50000.00,
        type: 'TOPUP'
      })
      .select();

    console.log(`[Attack 6] Ledger insert result:`, { data: ledgerInsert, error: ledgerErr?.message });
    assert.ok(
      ledgerErr || (ledgerInsert?.length || 0) === 0,
      'Direct insertion into ledger_entries by client must be denied by RLS'
    );
    console.log('✔ ATTACK 6 DEFEATED: Direct ledger insertion blocked');

    // =========================================================================
    // ATTACK 7: Rogue Worker Task Hijack (Attempt complete_task on unassigned task)
    // =========================================================================
    console.log('\n--- ATTACK 7: Rogue Worker complete_task Hijack Attempt ---');
    const rogueCompleteRes = await callRpc(rogueWorker.client, 'complete_task', {
      p_task_id: testTask.id,
      p_otp_code: SECRET_OTP // Even if rogue guessed OTP!
    });
    console.log(`[Attack 7] Rogue complete_task result:`, rogueCompleteRes.error?.message || rogueCompleteRes.data);
    assert.ok(
      rogueCompleteRes.error,
      'Rogue worker must NOT be able to complete a task assigned to someone else'
    );
    console.log('✔ ATTACK 7 DEFEATED: Unassigned worker cannot hijack task completion');

    // =========================================================================
    // ATTACK 8: Parameter Fuzzing & SQL Injection on nearby_tasks & get_task_otp
    // =========================================================================
    console.log('\n--- ATTACK 8: Parameter Fuzzing & Boundary Enforcement ---');
    // Fuzz 8.1: Extreme out-of-world lat/lng
    const fuzz1 = await callRpc(anonClient, 'nearby_tasks', {
      p_lat: 999999.99,
      p_lng: -999999.99,
      p_radius_meters: 1500
    });
    console.log(`[Attack 8.1] Extreme lat/lng response count: ${fuzz1.data?.length ?? 'error: ' + fuzz1.error?.message}`);
    assert.strictEqual(fuzz1.data?.length || 0, 0, 'Extreme lat/lng must return 0 rows');

    // Probe 8.2: Radius Cap Enforcement (Worker at 2500m requests 5000m radius)
    // Distance from CAMPUS_REF (13.0184) to (13.0409) is ~2.5km North
    const FAR_LAT = 13.0409;
    const FAR_LNG = 77.5684;
    const resFarAttempt = await callRpc(anonClient, 'nearby_tasks', {
      p_lat: FAR_LAT,
      p_lng: FAR_LNG,
      p_radius_meters: 5000 // Attempting to bypass 1500m boundary
    });
    const foundTargetAtFar = resFarAttempt.data?.find(t => t.id === testTask.id);
    console.log(`[Attack 8.2] Radius bypass attempt (2.5km away requesting 5000m): found = ${Boolean(foundTargetAtFar)}`);
    assert.strictEqual(foundTargetAtFar, undefined, 'Worker at 2.5km cannot discover task even if requesting 5000m radius');

    // Probe 8.3: SQL Injection payload in RPC argument
    const sqlInjRes = await callRpc(anonClient, 'get_task_otp', {
      p_task_id: "00000000-0000-0000-0000-000000000000' OR '1'='1"
    });
    console.log(`[Attack 8.3] SQL injection in UUID response:`, sqlInjRes.error?.message || sqlInjRes.data);
    assert.ok(sqlInjRes.error, 'SQL injection attempt in UUID parameter must be rejected by PostgreSQL parser');
    console.log('✔ ATTACK 8 DEFEATED: Spatial bounds enforced and SQL injection defeated');

    console.log('\n================================================================');
    console.log('ALL 8 ADVERSARIAL PENETRATION PROBES DEFEATED / PASSED SECURELY!');
    console.log('================================================================');

  } finally {
    console.log('\n[Teardown] Cleaning up adversarial tasks...');
    for (const tid of cleanupTasks) {
      await cleanupTask(tid);
    }
    console.log('[Teardown] Finished.');
  }
}

runAdversarialM5().catch(err => {
  console.error('\n❌ ADVERSARIAL CHALLENGE FAILED:', err);
  process.exit(1);
});
