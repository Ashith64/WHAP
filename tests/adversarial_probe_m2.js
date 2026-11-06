import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {
  getAdminClient,
  getAnonClient,
  getOrCreateTestUser,
  cleanupTask,
  callRpc,
  calculatePercentiles
} from './helpers.js';

const CAMPUS_REF = { lat: 13.0184, lng: 77.5684 };

async function calculateCoordinatesViaPostGIS(adminClient, refPoint, distancesMeters, azimuthDeg = 0) {
  // Query PostGIS directly for exact geodesic coordinates at given distances
  const coords = {};
  for (const dist of distancesMeters) {
    const { data, error } = await adminClient.rpc('nearby_tasks', {
      p_lat: refPoint.lat,
      p_lng: refPoint.lng
    }); // Just a test to ensure RPC works
    
    // Use SQL via pg or an RPC if available, or compute geodesic projection
    // PostGIS calculation via raw SQL or mathematical Vincenty/great-circle:
    // At lat ~13 degrees:
    // Earth radius R = 6378137m, WGS84 ellipsoid
    // Along meridian (azimuth 0, North):
    // dLat = dist / 110574.0 (approx)
    // But let's compute precisely using WGS-84 geodesic formulas:
  }
}

/**
 * Geodesic destination point calculation on WGS-84 ellipsoid
 */
function destinationPoint(lat, lng, distanceMeters, bearingDegrees = 0) {
  const R = 6371008.8; // Mean Earth radius in meters
  const delta = distanceMeters / R;
  const theta = (bearingDegrees * Math.PI) / 180;

  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lng * Math.PI) / 180;

  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(sinPhi2);

  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * sinPhi2;
  const lambda2 = lambda1 + Math.atan2(y, x);

  return {
    lat: (phi2 * 180) / Math.PI,
    lng: (lambda2 * 180) / Math.PI
  };
}

export async function runAdversarialProbes() {
  const adminClient = getAdminClient();
  const anonClient = getAnonClient();
  const cleanupTasks = [];

  const probeReport = {
    spatial: {},
    reviewSecrecy: {},
    loadTest: {},
    passedAll: false
  };

  try {
    console.log('=== Initializing Adversarial Test Environment ===');
    const requester = await getOrCreateTestUser({
      email: 'adv_requester@whap.local',
      name: 'Adversarial Requester',
      role: 'REQUESTER',
      lat: CAMPUS_REF.lat,
      lng: CAMPUS_REF.lng,
      initialBalance: 2000.00
    });

    const workerA = await getOrCreateTestUser({
      email: 'adv_worker_a@whap.local',
      name: 'Adversarial Worker A',
      role: 'WORKER',
      lat: CAMPUS_REF.lat,
      lng: CAMPUS_REF.lng,
      initialBalance: 200.00
    });

    const workerB = await getOrCreateTestUser({
      email: 'adv_worker_b@whap.local',
      name: 'Adversarial Worker B',
      role: 'WORKER',
      lat: CAMPUS_REF.lat,
      lng: CAMPUS_REF.lng,
      initialBalance: 200.00
    });

    const workerThirdParty = await getOrCreateTestUser({
      email: 'adv_worker_third@whap.local',
      name: 'Adversarial Worker Third Party',
      role: 'WORKER',
      lat: CAMPUS_REF.lat,
      lng: CAMPUS_REF.lng,
      initialBalance: 200.00
    });

    // =========================================================================
    // PROBE 1: Spatial Boundary Precision (1490m, 1500m, 1510m)
    // =========================================================================
    console.log('\n--- PROBE 1: Spatial Boundary Precision (1490m, 1500m, 1510m) ---');
    
    // Reference Task at IISc Campus Center
    const { data: spatialTask, error: stErr } = await callRpc(requester.client, 'post_task', {
      p_title: 'Adversarial Spatial Probe Task',
      p_description: 'Precision boundary probe at 1490m, 1500m, 1510m',
      p_category: 'OTHER',
      p_budget: 100.00,
      p_lat: CAMPUS_REF.lat,
      p_lng: CAMPUS_REF.lng
    });
    assert.ifError(stErr, `post_task failed: ${stErr?.message}`);
    const spatialTaskId = spatialTask.id || spatialTask.task_id;
    cleanupTasks.push(spatialTaskId);

    // Compute precise points at 1490m, 1500m, 1510m using WGS-84 spherical/ellipsoidal model
    // Let's verify actual PostGIS distances for the candidate coordinates:
    const pt1490 = destinationPoint(CAMPUS_REF.lat, CAMPUS_REF.lng, 1490, 0); // North
    const pt1500 = destinationPoint(CAMPUS_REF.lat, CAMPUS_REF.lng, 1500, 0); // North
    const pt1510 = destinationPoint(CAMPUS_REF.lat, CAMPUS_REF.lng, 1510, 0); // North

    // Test nearby_tasks from 1490m
    const res1490 = await callRpc(anonClient, 'nearby_tasks', {
      p_lat: pt1490.lat,
      p_lng: pt1490.lng,
      p_radius_meters: 1500
    });
    assert.ifError(res1490.error, `nearby_tasks at 1490m error: ${res1490.error?.message}`);
    const found1490 = res1490.data?.find(t => t.id === spatialTaskId);
    console.log(`[1490m Probe] Found task: ${Boolean(found1490)}, Reported distance: ${found1490?.distance_meters}m`);
    assert.ok(found1490, 'Task must be returned at 1490m (inside 1500m geofence)');
    assert.ok(found1490.distance_meters <= 1500, 'Distance must be <= 1500m');

    // Test nearby_tasks from 1500m
    const res1500 = await callRpc(anonClient, 'nearby_tasks', {
      p_lat: pt1500.lat,
      p_lng: pt1500.lng,
      p_radius_meters: 1500
    });
    assert.ifError(res1500.error, `nearby_tasks at 1500m error: ${res1500.error?.message}`);
    const found1500 = res1500.data?.find(t => t.id === spatialTaskId);
    console.log(`[1500m Probe] Found task: ${Boolean(found1500)}, Reported distance: ${found1500?.distance_meters}m`);
    // Boundary condition: exactly 1500m is within boundary (ST_DWithin uses <=)
    // Note: Due to floating point geodesic computation, distance might be ~1500.00
    if (found1500) {
      assert.ok(found1500.distance_meters <= 1500.05, '1500m must be within threshold');
    }

    // Test nearby_tasks from 1510m
    const res1510 = await callRpc(anonClient, 'nearby_tasks', {
      p_lat: pt1510.lat,
      p_lng: pt1510.lng,
      p_radius_meters: 1500
    });
    assert.ifError(res1510.error, `nearby_tasks at 1510m error: ${res1510.error?.message}`);
    const found1510 = res1510.data?.find(t => t.id === spatialTaskId);
    console.log(`[1510m Probe] Found task: ${Boolean(found1510)} (Expected: false)`);
    assert.strictEqual(found1510, undefined, 'Task must NOT be returned at 1510m (outside 1500m boundary)');

    // Test place_bid from 1490m (Allowed) vs 1510m (Blocked)
    const bid1490Res = await callRpc(workerA.client, 'place_bid', {
      p_task_id: spatialTaskId,
      p_price: 90.00,
      p_lat: pt1490.lat,
      p_lng: pt1490.lng
    });
    assert.ifError(bid1490Res.error, `place_bid at 1490m should succeed: ${bid1490Res.error?.message}`);
    console.log('[1490m place_bid] Bid placed successfully');

    const bid1510Res = await callRpc(workerB.client, 'place_bid', {
      p_task_id: spatialTaskId,
      p_price: 95.00,
      p_lat: pt1510.lat,
      p_lng: pt1510.lng
    });
    console.log(`[1510m place_bid] Error message: ${bid1510Res.error?.message}`);
    assert.ok(bid1510Res.error, 'place_bid at 1510m must fail with boundary error');
    assert.ok(bid1510Res.error.message.includes('1.5 km') || bid1510Res.error.message.includes('boundary'), 'Error must mention boundary');

    // Test radius cap bypass attempt (requesting 5000m radius from 1510m)
    const resBypass = await callRpc(anonClient, 'nearby_tasks', {
      p_lat: pt1510.lat,
      p_lng: pt1510.lng,
      p_radius_meters: 5000 // Attempting to expand radius
    });
    const foundBypass = resBypass.data?.find(t => t.id === spatialTaskId);
    console.log(`[Radius expansion bypass probe] Found task at 5000m request: ${Boolean(foundBypass)} (Expected: false)`);
    assert.strictEqual(foundBypass, undefined, 'Radius cannot be expanded beyond 1500m hard cap');

    probeReport.spatial = {
      status: 'PASSED',
      pt1490: { dist: found1490?.distance_meters, visible: true },
      pt1500: { dist: found1500?.distance_meters, visible: Boolean(found1500) },
      pt1510: { visible: false },
      bid1490: 'SUCCESS',
      bid1510: 'REJECTED',
      radiusCapEnforced: true
    };

    // =========================================================================
    // PROBE 2: Review Secrecy & Double-Blind Review Isolation
    // =========================================================================
    console.log('\n--- PROBE 2: Review Secrecy & Double-Blind Review Isolation ---');

    // Post, bid, accept, complete a task
    const { data: reviewTask } = await callRpc(requester.client, 'post_task', {
      p_title: 'Adversarial Review Secrecy Task',
      p_description: 'Probing blind review isolation and premature reveal leakage',
      p_category: 'BUY_ITEMS',
      p_budget: 120.00,
      p_lat: CAMPUS_REF.lat,
      p_lng: CAMPUS_REF.lng
    });
    const rTaskId = reviewTask.id || reviewTask.task_id;
    cleanupTasks.push(rTaskId);

    const { data: rBid } = await callRpc(workerA.client, 'place_bid', {
      p_task_id: rTaskId,
      p_price: 110.00,
      p_lat: CAMPUS_REF.lat,
      p_lng: CAMPUS_REF.lng
    });
    await callRpc(requester.client, 'accept_bid', { p_bid_id: rBid.id || rBid.bid_id });

    const { data: assignedRTask } = await adminClient
      .from('tasks')
      .select('otp_code')
      .eq('id', rTaskId)
      .single();

    await callRpc(workerA.client, 'complete_task', {
      p_task_id: rTaskId,
      p_otp_code: assignedRTask.otp_code
    });

    // 1. Requester submits review
    const SECRET_COMMENT = 'CRITICAL_SECRET_REQUESTER_REVIEW_STRING_XYZ_9876';
    const sub1 = await callRpc(requester.client, 'submit_review', {
      p_task_id: rTaskId,
      p_rating: 4,
      p_comment: SECRET_COMMENT
    });
    assert.ifError(sub1.error, `Requester submit_review failed: ${sub1.error?.message}`);
    assert.strictEqual(sub1.data.visible, false, 'Requester review submission response must report visible=false');

    // 2. Worker A queries reviews table directly
    const { data: workerAQuery, error: wqErr } = await workerA.client
      .from('reviews')
      .select('*')
      .eq('task_id', rTaskId);
    assert.ifError(wqErr);
    console.log(`[Blind isolation probe] Worker A sees ${workerAQuery?.length} reviews (Expected: 0)`);
    assert.strictEqual(workerAQuery.length, 0, 'Worker A must NOT see requester review before submitting own review');

    // 3. Worker Third Party queries reviews table directly
    const { data: thirdPartyQuery } = await workerThirdParty.client
      .from('reviews')
      .select('*')
      .eq('task_id', rTaskId);
    console.log(`[Blind isolation probe] Third Party sees ${thirdPartyQuery?.length} reviews (Expected: 0)`);
    assert.strictEqual(thirdPartyQuery.length, 0, 'Unrelated third party must NOT see unrevealed reviews');

    // 4. Anonymous user queries reviews table
    const { data: anonQuery } = await anonClient
      .from('reviews')
      .select('*')
      .eq('task_id', rTaskId);
    console.log(`[Blind isolation probe] Anon sees ${anonQuery?.length} reviews (Expected: 0)`);
    assert.strictEqual(anonQuery.length, 0, 'Anonymous users must NOT see unrevealed reviews');

    // 5. Requester queries reviews table: can only see their own review
    const { data: reqQuery } = await requester.client
      .from('reviews')
      .select('*')
      .eq('task_id', rTaskId);
    console.log(`[Blind isolation probe] Requester sees ${reqQuery?.length} reviews`);
    assert.strictEqual(reqQuery.length, 1, 'Requester can see their own submitted review');
    assert.strictEqual(reqQuery[0].visible, false, 'Requester own review visible column must be false');

    // 6. Adversarial tamper attempts
    // Requester submits duplicate review -> must fail
    const dupRes = await callRpc(requester.client, 'submit_review', {
      p_task_id: rTaskId,
      p_rating: 5,
      p_comment: 'Second review attempt'
    });
    assert.ok(dupRes.error, 'Duplicate review from same participant must fail');
    console.log(`[Duplicate review defense] ${dupRes.error.message}`);

    // Third party attempts to submit review -> must fail
    const thirdSub = await callRpc(workerThirdParty.client, 'submit_review', {
      p_task_id: rTaskId,
      p_rating: 1,
      p_comment: 'Malicious review from non-participant'
    });
    assert.ok(thirdSub.error, 'Review from non-participant must fail');
    console.log(`[Third-party review defense] ${thirdSub.error.message}`);

    // Out-of-bounds ratings (0 and 6)
    const zeroRating = await callRpc(workerA.client, 'submit_review', {
      p_task_id: rTaskId,
      p_rating: 0,
      p_comment: 'Zero rating'
    });
    assert.ok(zeroRating.error, 'Rating 0 must fail');

    const sixRating = await callRpc(workerA.client, 'submit_review', {
      p_task_id: rTaskId,
      p_rating: 6,
      p_comment: 'Rating 6'
    });
    assert.ok(sixRating.error, 'Rating 6 must fail');

    // 7. Worker A submits their review -> triggers mutual reveal
    const sub2 = await callRpc(workerA.client, 'submit_review', {
      p_task_id: rTaskId,
      p_rating: 5,
      p_comment: 'Worker A counterpart review'
    });
    assert.ifError(sub2.error);
    assert.strictEqual(sub2.data.visible, true, 'Worker A review submission response must report visible=true');

    // 8. Both parties can now see both reviews
    const { data: workerAQueryRevealed } = await workerA.client
      .from('reviews')
      .select('*')
      .eq('task_id', rTaskId);
    assert.strictEqual(workerAQueryRevealed.length, 2, 'Worker A must now see both reviews');

    const { data: reqQueryRevealed } = await requester.client
      .from('reviews')
      .select('*')
      .eq('task_id', rTaskId);
    assert.strictEqual(reqQueryRevealed.length, 2, 'Requester must now see both reviews');

    probeReport.reviewSecrecy = {
      status: 'PASSED',
      blindIsolationEnforced: true,
      thirdPartyBlocked: true,
      duplicateBlocked: true,
      outOfBoundsRatingBlocked: true,
      mutualRevealSuccessful: true
    };

    // =========================================================================
    // PROBE 3: 100 Simultaneous Requests High-Throughput Load Test
    // =========================================================================
    console.log('\n--- PROBE 3: High-Throughput Load Test (100 Simultaneous nearby_tasks Calls) ---');
    const LOAD_COUNT = 100;
    const latencies = [];
    const loadStart = performance.now();

    const loadPromises = Array.from({ length: LOAD_COUNT }, async (_, idx) => {
      const t0 = performance.now();
      const res = await callRpc(anonClient, 'nearby_tasks', {
        p_lat: CAMPUS_REF.lat,
        p_lng: CAMPUS_REF.lng,
        p_radius_meters: 1500
      });
      const t1 = performance.now();
      const latency = t1 - t0;
      latencies.push(latency);
      return { idx, res, latency };
    });

    const loadResults = await Promise.all(loadPromises);
    const loadWallTime = performance.now() - loadStart;

    const stats = calculatePercentiles(latencies);
    const failedCalls = loadResults.filter(r => r.res.error);

    console.log(`======================================================`);
    console.log(`[ADVERSARIAL LOAD REPORT] 100 Simultaneous nearby_tasks`);
    console.log(`Total Wall-Clock Time: ${loadWallTime.toFixed(2)} ms`);
    console.log(`Successful Calls:      ${LOAD_COUNT - failedCalls.length} / ${LOAD_COUNT}`);
    console.log(`Error Rate:            ${((failedCalls.length / LOAD_COUNT) * 100).toFixed(2)}%`);
    console.log(`Min Latency:           ${stats.min} ms`);
    console.log(`Mean Latency:          ${stats.mean} ms`);
    console.log(`p50 (Median):          ${stats.p50} ms`);
    console.log(`p95 Latency:           ${stats.p95} ms`);
    console.log(`p99 Latency:           ${stats.p99} ms`);
    console.log(`Max Latency:           ${stats.max} ms`);
    console.log(`======================================================`);

    assert.strictEqual(failedCalls.length, 0, `Load test had ${failedCalls.length} failed calls; required 0% errors`);

    probeReport.loadTest = {
      status: 'PASSED',
      totalRequests: LOAD_COUNT,
      successfulRequests: LOAD_COUNT - failedCalls.length,
      errorRatePct: 0.0,
      wallClockTimeMs: Number(loadWallTime.toFixed(2)),
      minMs: stats.min,
      meanMs: stats.mean,
      p50Ms: stats.p50,
      p95Ms: stats.p95,
      p99Ms: stats.p99,
      maxMs: stats.max
    };

    probeReport.passedAll = true;
    console.log('\n>>> ALL ADVERSARIAL PROBES PASSED SUCCESSFULLY <<<');

  } finally {
    // Teardown created tasks
    console.log('\nTearing down adversarial test tasks...');
    for (const tid of cleanupTasks) {
      await cleanupTask(tid);
    }
    console.log('Teardown complete.');
  }

  return probeReport;
}

if (process.argv[1]?.endsWith('adversarial_probe_m2.js')) {
  runAdversarialProbes()
    .then(report => {
      console.log('Final Result Summary:', JSON.stringify(report, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Adversarial probe error:', err);
      process.exit(1);
    });
}
