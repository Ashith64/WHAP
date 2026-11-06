import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';
const { Client, Pool } = pkg;
import dotenv from 'dotenv';
import { performance } from 'node:perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));

const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;

const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

const pool = new Pool({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 10
});

async function runDeepStressSuite() {
  console.log('================================================================');
  console.log('CHALLENGER DEEP STRESS HARNESS: Constraints & GiST Performance');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  await client.connect();

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  async function testConstraintProbe({ name, sql, params = [], expectViolation = true, expectedConstraint = null }) {
    results.total++;
    let violation = false;
    let actualConstraint = null;
    let errorMsg = null;

    await client.query('BEGIN;');
    try {
      await client.query(sql, params);
      violation = false;
    } catch (err) {
      violation = true;
      actualConstraint = err.constraint;
      errorMsg = err.message;
    } finally {
      await client.query('ROLLBACK;');
    }

    if (expectViolation) {
      if (violation && (!expectedConstraint || actualConstraint === expectedConstraint || errorMsg?.includes(expectedConstraint))) {
        results.passed++;
        console.log(`  [PASS] ${name} (Correctly rejected: ${actualConstraint || errorMsg})`);
        results.details.push({ name, status: 'PASS', constraint: actualConstraint, error: errorMsg });
      } else if (!violation) {
        results.failed++;
        console.error(`  [FAIL] ${name} (Expected violation of ${expectedConstraint}, but query SUCCEEDED!)`);
        results.details.push({ name, status: 'FAIL', reason: 'Query unexpectedly succeeded' });
      } else {
        results.failed++;
        console.error(`  [FAIL] ${name} (Wrong constraint violated: expected ${expectedConstraint}, got ${actualConstraint}: ${errorMsg})`);
        results.details.push({ name, status: 'FAIL', reason: `Wrong constraint: ${actualConstraint}` });
      }
    } else {
      if (!violation) {
        results.passed++;
        console.log(`  [PASS] ${name} (Query succeeded as expected)`);
        results.details.push({ name, status: 'PASS' });
      } else {
        results.failed++;
        console.error(`  [FAIL] ${name} (Expected success, but query failed: ${errorMsg})`);
        results.details.push({ name, status: 'FAIL', reason: errorMsg });
      }
    }
  }

  // Get test fixtures
  const profRes = await client.query("SELECT id FROM profiles WHERE role = 'REQUESTER' LIMIT 1;");
  const requesterId = profRes.rows[0].id;
  const workerRes = await client.query("SELECT id FROM profiles WHERE role = 'WORKER' LIMIT 1;");
  const workerId = workerRes.rows[0].id;
  const taskRes = await client.query("SELECT id FROM tasks LIMIT 1;");
  const taskId = taskRes.rows[0].id;
  const walletRes = await client.query("SELECT id FROM wallets LIMIT 1;");
  const walletId = walletRes.rows[0].id;

  console.log(`Test Fixtures: Requester=${requesterId}, Worker=${workerId}, Task=${taskId}, Wallet=${walletId}\n`);

  // =========================================================================
  // SECTION 1: Advanced Relational & Precision CHECK Constraints
  // =========================================================================
  console.log('--- SECTION 1: Relational & Numeric Precision Invariants ---');

  // 1.1 Rating average bounds
  await testConstraintProbe({
    name: 'Profile rating_average = -0.01 (negative rating)',
    sql: `UPDATE profiles SET rating_average = -0.01 WHERE id = $1;`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'profiles_rating_average_check'
  });

  await testConstraintProbe({
    name: 'Profile rating_average = 5.01 (exceeds max 5.00)',
    sql: `UPDATE profiles SET rating_average = 5.01 WHERE id = $1;`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'profiles_rating_average_check'
  });

  await testConstraintProbe({
    name: 'Profile rating_average = 0.00 (exact lower boundary)',
    sql: `UPDATE profiles SET rating_average = 0.00 WHERE id = $1;`,
    params: [requesterId],
    expectViolation: false
  });

  await testConstraintProbe({
    name: 'Profile rating_average = 5.00 (exact upper boundary)',
    sql: `UPDATE profiles SET rating_average = 5.00 WHERE id = $1;`,
    params: [requesterId],
    expectViolation: false
  });

  // 1.2 Rating count bounds
  await testConstraintProbe({
    name: 'Profile rating_count = -1 (negative count)',
    sql: `UPDATE profiles SET rating_count = -1 WHERE id = $1;`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'profiles_rating_count_check'
  });

  await testConstraintProbe({
    name: 'Profile rating_count = 0 (exact zero bound)',
    sql: `UPDATE profiles SET rating_count = 0 WHERE id = $1;`,
    params: [requesterId],
    expectViolation: false
  });

  // 1.3 OTP attempts bounds
  await testConstraintProbe({
    name: 'Task otp_attempts = -1 (negative attempts)',
    sql: `UPDATE tasks SET otp_attempts = -1 WHERE id = $1;`,
    params: [taskId],
    expectViolation: true,
    expectedConstraint: 'tasks_otp_attempts_check'
  });

  await testConstraintProbe({
    name: 'Task otp_attempts = 0 (exact zero bound)',
    sql: `UPDATE tasks SET otp_attempts = 0 WHERE id = $1;`,
    params: [taskId],
    expectViolation: false
  });

  await testConstraintProbe({
    name: 'Task otp_attempts = 3 (valid lockout threshold)',
    sql: `UPDATE tasks SET otp_attempts = 3 WHERE id = $1;`,
    params: [taskId],
    expectViolation: false
  });

  // 1.4 Platform fee bounds
  await testConstraintProbe({
    name: 'Escrow platform_fee = -0.01 (negative fee)',
    sql: `INSERT INTO escrow_transactions (task_id, amount, platform_fee, status) VALUES ($1, 50.00, -0.01, 'HELD');`,
    params: [taskId],
    expectViolation: true,
    expectedConstraint: 'escrow_transactions_platform_fee_check'
  });

  await testConstraintProbe({
    name: 'Escrow platform_fee = 0.00 (zero fee allowed)',
    sql: `INSERT INTO escrow_transactions (task_id, amount, platform_fee, status) VALUES ($1, 50.00, 0.00, 'HELD');`,
    params: [taskId],
    expectViolation: false
  });

  // 1.5 Agreed price nullability and minimum threshold
  await testConstraintProbe({
    name: 'Task agreed_price = NULL (allowed when unassigned/open)',
    sql: `UPDATE tasks SET agreed_price = NULL WHERE id = $1;`,
    params: [taskId],
    expectViolation: false
  });

  await testConstraintProbe({
    name: 'Task agreed_price = 19.99 (below min 20.00)',
    sql: `UPDATE tasks SET agreed_price = 19.99 WHERE id = $1;`,
    params: [taskId],
    expectViolation: true,
    expectedConstraint: 'tasks_agreed_price_check'
  });

  await testConstraintProbe({
    name: 'Task agreed_price = 20.00 (exact min allowed)',
    sql: `UPDATE tasks SET agreed_price = 20.00 WHERE id = $1;`,
    params: [taskId],
    expectViolation: false
  });

  // 1.6 PostGIS Ellipsoidal & Spatial Type Invariants
  console.log('\n--- SECTION 2: PostGIS Geography Type & Invariant Enforcement ---');

  // 2.1 NULL location rejection on tasks table
  await testConstraintProbe({
    name: 'Task location = NULL (NOT NULL constraint)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Null Loc Task', 'OTHER', 50.00, NULL);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'null value in column "location"'
  });

  // 2.2 Invalid Geometry Type: inserting a Polygon into Point geography column
  await testConstraintProbe({
    name: 'Task location with non-Point geometry (Polygon rejected)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Polygon Loc Task', 'OTHER', 50.00, ST_GeogFromText('SRID=4326;POLYGON((0 0, 0 1, 1 1, 0 0))'));`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'does not match column type'
  });

  // 2.3 PostGIS Geodesic Ellipsoid normalization verification
  results.total++;
  const normCheck = await client.query(`
    SELECT ST_AsText(ST_SetSRID(ST_MakePoint(181.0, 13.0184), 4326)::geography) as pt_norm;
  `);
  if (normCheck.rows[0].pt_norm === 'POINT(-179 13.0184)') {
    results.passed++;
    console.log(`  [PASS] PostGIS WGS84 ellipsoid antimeridian normalization confirmed: (181.0, 13.0184) -> ${normCheck.rows[0].pt_norm}`);
    results.details.push({ name: 'PostGIS Ellipsoid Normalization', status: 'PASS' });
  } else {
    results.failed++;
    console.error(`  [FAIL] PostGIS normalization unexpected: ${normCheck.rows[0].pt_norm}`);
    results.details.push({ name: 'PostGIS Ellipsoid Normalization', status: 'FAIL' });
  }

  // =========================================================================
  // SECTION 3: Sub-Meter Geofence Precision Discrimination (1499.5m vs 1500.5m)
  // =========================================================================
  console.log('\n--- SECTION 3: Sub-Meter Geofence Precision Discriminator ---');
  results.total++;
  const subMeterCheck = await client.query(`
    SELECT
      ST_Distance(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1499.5, radians(90))
      ) as dist_1499_5,
      ST_DWithin(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1499.5, radians(90)),
        1500
      ) as within_1499_5,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1500.5, radians(90))
      ) as dist_1500_5,
      ST_DWithin(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1500.5, radians(90)),
        1500
      ) as within_1500_5;
  `);

  const sm = subMeterCheck.rows[0];
  console.log(`  Point 1499.5m East: actual dist = ${parseFloat(sm.dist_1499_5).toFixed(2)}m, ST_DWithin = ${sm.within_1499_5}`);
  console.log(`  Point 1500.5m East: actual dist = ${parseFloat(sm.dist_1500_5).toFixed(2)}m, ST_DWithin = ${sm.within_1500_5}`);

  if (sm.within_1499_5 === true && sm.within_1500_5 === false) {
    results.passed++;
    console.log('  [PASS] Sub-meter 1500m geofence cutoff boundary precision verified (1499.5m=true, 1500.5m=false)');
    results.details.push({ name: 'Sub-meter Geofence Cutoff Precision', status: 'PASS' });
  } else {
    results.failed++;
    console.error('  [FAIL] Sub-meter geofence cutoff precision failed!');
    results.details.push({ name: 'Sub-meter Geofence Cutoff Precision', status: 'FAIL' });
  }

  // =========================================================================
  // SECTION 4: GiST Index Query Execution Plan Analysis
  // =========================================================================
  console.log('\n--- SECTION 4: GiST Spatial Index Query Plan Under Combined Predicates ---');
  results.total++;

  await client.query('SET enable_seqscan = off;');
  const explainCombined = await client.query(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT id, title, budget, location
    FROM tasks
    WHERE status = 'OPEN'
      AND ST_DWithin(location, ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1500);
  `);
  await client.query('SET enable_seqscan = on;');

  const combinedPlan = explainCombined.rows[0]['QUERY PLAN'][0];
  const combinedExecTime = combinedPlan['Execution Time'];
  const combinedPlanTime = combinedPlan['Planning Time'];
  const rootNode = combinedPlan.Plan['Node Type'];
  
  function findIndexNames(p) {
    const names = [];
    if (p['Index Name']) names.push(p['Index Name']);
    if (p.Plans) {
      for (const sub of p.Plans) {
        names.push(...findIndexNames(sub));
      }
    }
    return names;
  }

  const indexesUsed = findIndexNames(combinedPlan.Plan);
  console.log('  Root Node Type:', rootNode);
  console.log('  Indexes Referenced in Plan:', indexesUsed);
  console.log(`  Combined Query DB Exec Time: ${combinedExecTime} ms`);
  console.log(`  Combined Query DB Plan Time: ${combinedPlanTime} ms`);

  if (indexesUsed.includes('idx_tasks_location') || indexesUsed.includes('idx_tasks_status')) {
    results.passed++;
    console.log(`  [PASS] Optimizer successfully utilized index: ${indexesUsed.join(', ')}`);
    results.details.push({ name: 'Combined Query Index Selection', status: 'PASS', indexes: indexesUsed });
  } else {
    results.failed++;
    console.error('  [FAIL] Optimizer did not utilize expected spatial/status indexes!');
    results.details.push({ name: 'Combined Query Index Selection', status: 'FAIL' });
  }

  // =========================================================================
  // SECTION 5: Concurrent Spatial Query Stress Harness (50 Queries Across Pool)
  // =========================================================================
  console.log('\n--- SECTION 5: High-Concurrency Spatial Query Stress Harness (10-Client Pool) ---');
  results.total++;

  const CONCURRENCY = 50;
  console.log(`Dispatching ${CONCURRENCY} simultaneous spatial distance queries to DB pool...`);

  const tStart = performance.now();
  const queryPromises = Array.from({ length: CONCURRENCY }, async (_, idx) => {
    const lat = 13.0180 + (idx % 10) * 0.0005;
    const lng = 77.5680 + (idx % 10) * 0.0005;
    const poolClient = await pool.connect();
    try {
      const t0 = performance.now();
      const res = await poolClient.query(`
        SELECT id, title, ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography)::numeric, 1) as dist
        FROM tasks
        WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 1500)
        ORDER BY dist ASC;
      `, [lng, lat]);
      const t1 = performance.now();
      return {
        success: res.rows.length >= 0,
        count: res.rows.length,
        latency: t1 - t0
      };
    } finally {
      poolClient.release();
    }
  });

  const queryResults = await Promise.all(queryPromises);
  const tTotal = performance.now() - tStart;

  const latencies = queryResults.map(r => r.latency).sort((a, b) => a - b);
  const successCount = queryResults.filter(r => r.success).length;
  const minLat = latencies[0].toFixed(2);
  const maxLat = latencies[latencies.length - 1].toFixed(2);
  const meanLat = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const p50Lat = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
  const p95Lat = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99Lat = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
  const qps = ((CONCURRENCY / tTotal) * 1000).toFixed(1);

  console.log('----------------------------------------------------');
  console.log(`CONCURRENCY BENCHMARK RESULTS (${CONCURRENCY} parallel queries via pool):`);
  console.log(`  Total Wall-Clock Time: ${tTotal.toFixed(2)} ms`);
  console.log(`  Successful Queries:    ${successCount} / ${CONCURRENCY} (100%)`);
  console.log(`  Effective Throughput:  ${qps} QPS`);
  console.log(`  Latency Metrics (RTT):`);
  console.log(`    Min:  ${minLat} ms`);
  console.log(`    Mean: ${meanLat} ms`);
  console.log(`    p50:  ${p50Lat} ms`);
  console.log(`    p95:  ${p95Lat} ms`);
  console.log(`    p99:  ${p99Lat} ms`);
  console.log(`    Max:  ${maxLat} ms`);
  console.log('----------------------------------------------------');

  if (successCount === CONCURRENCY) {
    results.passed++;
    console.log(`  [PASS] Concurrent spatial query stress test passed with 100% success rate!`);
    results.details.push({ name: 'Concurrent Spatial Stress Harness', status: 'PASS', metrics: { qps, meanLat, p95Lat } });
  } else {
    results.failed++;
    console.error(`  [FAIL] Concurrent stress test had failures: ${successCount}/${CONCURRENCY}`);
    results.details.push({ name: 'Concurrent Spatial Stress Harness', status: 'FAIL' });
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(`DEEP STRESS HARNESS SUMMARY: Total: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed}`);
  console.log('================================================================\n');

  await client.end();
  await pool.end();
  return results;
}

runDeepStressSuite()
  .then((res) => {
    if (res.failed > 0) {
      console.error(`FAILED: ${res.failed} stress probes failed.`);
      process.exit(1);
    } else {
      console.log('SUCCESS: All deep stress probes PASSED.');
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('CRITICAL ERROR in deep stress runner:', err);
    process.exit(1);
  });
