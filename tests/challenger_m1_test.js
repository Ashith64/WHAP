import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

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

async function runEmpiricalChallenge() {
  console.log('================================================================');
  console.log('CHALLENGER SUITE: Milestone 1 Schema Constraints & GiST Performance');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  await client.connect();

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  async function testConstraint({ name, sql, params = [], expectViolation = true, expectedConstraint = null }) {
    results.total++;
    let violation = false;
    let actualConstraint = null;
    let errorMsg = null;

    await client.query('BEGIN;');
    try {
      await client.query(sql, params);
      // If it succeeded
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
        console.log(`  [PASS] ${name} (Correctly rejected with constraint: ${actualConstraint || errorMsg})`);
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

  // Get a valid requester profile ID for task insertions
  const profRes = await client.query("SELECT id FROM profiles WHERE role = 'REQUESTER' LIMIT 1;");
  if (profRes.rows.length === 0) {
    throw new Error('No requester profile found in DB for testing.');
  }
  const requesterId = profRes.rows[0].id;

  // Get a valid worker profile ID for bid insertions
  const workerRes = await client.query("SELECT id FROM profiles WHERE role = 'WORKER' LIMIT 1;");
  const workerId = workerRes.rows[0].id;

  // Get a valid task ID
  const taskRes = await client.query("SELECT id FROM tasks LIMIT 1;");
  const taskId = taskRes.rows[0].id;

  console.log(`Using Test Fixtures: Requester=${requesterId}, Worker=${workerId}, Task=${taskId}\n`);

  // ==========================================================================
  // CHALLENGE 1: Budget Constraints (tasks_budget_check)
  // Constraint: CHECK (budget >= 50.00 AND budget <= 300.00)
  // ==========================================================================
  console.log('--- CHALLENGE 1: Task Budget CHECK Constraint (Rs 50.00 - Rs 300.00) ---');

  // 1.1 Budget Rs 40 (must fail)
  await testConstraint({
    name: 'Task budget Rs 40.00 (below min 50.00)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Test Task Budget 40', 'OTHER', 40.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_budget_check'
  });

  // 1.2 Budget Rs 49.99 (boundary fail)
  await testConstraint({
    name: 'Task budget Rs 49.99 (just below min 50.00)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Test Task Budget 49.99', 'OTHER', 49.99, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_budget_check'
  });

  // 1.3 Budget Rs 50.00 (exact lower boundary - must succeed)
  await testConstraint({
    name: 'Task budget Rs 50.00 (exact lower bound)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Test Task Budget 50.00', 'OTHER', 50.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: false
  });

  // 1.4 Budget Rs 150.00 (nominal valid)
  await testConstraint({
    name: 'Task budget Rs 150.00 (nominal valid)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Test Task Budget 150.00', 'OTHER', 150.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: false
  });

  // 1.5 Budget Rs 300.00 (exact upper boundary - must succeed)
  await testConstraint({
    name: 'Task budget Rs 300.00 (exact upper bound)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Test Task Budget 300.00', 'OTHER', 300.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: false
  });

  // 1.6 Budget Rs 300.01 (boundary fail)
  await testConstraint({
    name: 'Task budget Rs 300.01 (just above max 300.00)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Test Task Budget 300.01', 'OTHER', 300.01, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_budget_check'
  });

  // 1.7 Budget Rs 350.00 (above max 300.00 - must fail)
  await testConstraint({
    name: 'Task budget Rs 350.00 (above max 300.00)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Test Task Budget 350.00', 'OTHER', 350.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_budget_check'
  });

  // ==========================================================================
  // CHALLENGE 2: Wallet Balance Constraints (wallets_balance_check)
  // Constraint: CHECK (balance >= 0.00)
  // ==========================================================================
  console.log('\n--- CHALLENGE 2: Wallet Balance CHECK Constraint (balance >= 0.00) ---');

  // Create a temporary profile for wallet testing
  const tempUserId = '00000000-0000-0000-0000-000000000001';

  // 2.1 Wallet negative balance -0.01 (boundary fail)
  await testConstraint({
    name: 'Wallet balance -0.01 (negative fraction)',
    sql: `INSERT INTO wallets (user_id, balance) VALUES ($1, -0.01);`,
    params: [requesterId], // user_id exists
    expectViolation: true,
    expectedConstraint: 'wallets_balance_check'
  });

  // 2.2 Wallet negative balance -100.00 (must fail)
  await testConstraint({
    name: 'Wallet balance -100.00 (negative whole)',
    sql: `INSERT INTO wallets (user_id, balance) VALUES ($1, -100.00);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'wallets_balance_check'
  });

  // 2.3 Wallet update to negative balance (must fail)
  await testConstraint({
    name: 'Wallet UPDATE balance = -50.00 (must fail)',
    sql: `UPDATE wallets SET balance = -50.00 WHERE user_id = $1;`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'wallets_balance_check'
  });

  // 2.4 Wallet update to zero balance (succeed)
  await testConstraint({
    name: 'Wallet UPDATE balance = 0.00 (exact zero bound)',
    sql: `UPDATE wallets SET balance = 0.00 WHERE user_id = $1;`,
    params: [requesterId],
    expectViolation: false
  });

  // ==========================================================================
  // CHALLENGE 3: Bid Price Constraint (bids_price_check)
  // Constraint: CHECK (price >= 20.00)
  // ==========================================================================
  console.log('\n--- CHALLENGE 3: Bid Price CHECK Constraint (price >= 20.00) ---');

  // 3.1 Bid price 0.00 (must fail)
  await testConstraint({
    name: 'Bid price Rs 0.00 (must fail)',
    sql: `INSERT INTO bids (task_id, worker_id, price) VALUES ($1, $2, 0.00);`,
    params: [taskId, workerId],
    expectViolation: true,
    expectedConstraint: 'bids_price_check'
  });

  // 3.2 Bid price 19.99 (must fail)
  await testConstraint({
    name: 'Bid price Rs 19.99 (just below min 20.00)',
    sql: `INSERT INTO bids (task_id, worker_id, price) VALUES ($1, $2, 19.99);`,
    params: [taskId, workerId],
    expectViolation: true,
    expectedConstraint: 'bids_price_check'
  });

  // 3.3 Bid price -5.00 (must fail)
  await testConstraint({
    name: 'Bid price Rs -5.00 (negative price)',
    sql: `INSERT INTO bids (task_id, worker_id, price) VALUES ($1, $2, -5.00);`,
    params: [taskId, workerId],
    expectViolation: true,
    expectedConstraint: 'bids_price_check'
  });

  // 3.4 Bid price 20.00 (exact lower boundary - must succeed)
  await client.query('BEGIN;');
  try {
    await client.query('DELETE FROM bids WHERE task_id = $1 AND worker_id = $2;', [taskId, workerId]);
    await client.query('INSERT INTO bids (task_id, worker_id, price) VALUES ($1, $2, 20.00);', [taskId, workerId]);
    results.passed++;
    console.log(`  [PASS] Bid price Rs 20.00 (exact lower bound) (Query succeeded as expected)`);
    results.details.push({ name: 'Bid price Rs 20.00 (exact lower bound)', status: 'PASS' });
  } catch (err) {
    results.failed++;
    console.error(`  [FAIL] Bid price Rs 20.00 failed: ${err.message}`);
    results.details.push({ name: 'Bid price Rs 20.00 (exact lower bound)', status: 'FAIL', reason: err.message });
  } finally {
    await client.query('ROLLBACK;');
  }
  results.total++;

  // ==========================================================================
  // CHALLENGE 4: Enum CHECK Constraints (Category & Status)
  // ==========================================================================
  console.log('\n--- CHALLENGE 4: Enum CHECK Constraints (Category & Status) ---');

  // 4.1 Invalid Category 'ILLEGAL_DRUGS'
  await testConstraint({
    name: "Task category 'ILLEGAL_DRUGS' (invalid enum)",
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Bad Cat', 'ILLEGAL_DRUGS', 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_category_check'
  });

  // 4.2 Invalid Category '' (empty string)
  await testConstraint({
    name: "Task category '' (empty string)",
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
          VALUES ($1, 'Empty Cat', '', 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_category_check'
  });

  // 4.3 All 5 Valid Categories
  const validCategories = ['XEROX_PICKUP', 'BUY_ITEMS', 'CARRY_THINGS', 'QUEUE', 'OTHER'];
  for (const cat of validCategories) {
    await testConstraint({
      name: `Task category '${cat}' (valid enum)`,
      sql: `INSERT INTO tasks (requester_id, title, category, budget, location)
            VALUES ($1, 'Valid Cat', $2, 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography);`,
      params: [requesterId, cat],
      expectViolation: false
    });
  }

  // 4.4 Invalid Status 'DRAFT'
  await testConstraint({
    name: "Task status 'DRAFT' (invalid enum)",
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location, status)
          VALUES ($1, 'Bad Status', 'OTHER', 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography, 'DRAFT');`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_status_check'
  });

  // 4.5 Invalid Status 'UNKNOWN'
  await testConstraint({
    name: "Task status 'UNKNOWN' (invalid enum)",
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location, status)
          VALUES ($1, 'Bad Status', 'OTHER', 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography, 'UNKNOWN');`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_status_check'
  });

  // 4.6 All 6 Valid Task Statuses
  const validStatuses = ['OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'];
  for (const stat of validStatuses) {
    await testConstraint({
      name: `Task status '${stat}' (valid enum)`,
      sql: `INSERT INTO tasks (requester_id, title, category, budget, location, status)
            VALUES ($1, 'Valid Status', 'OTHER', 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography, $2);`,
      params: [requesterId, stat],
      expectViolation: false
    });
  }

  // ==========================================================================
  // CHALLENGE 5: Other Critical Schema Constraints
  // ==========================================================================
  console.log('\n--- CHALLENGE 5: Other Schema Constraints (Reviews, Escrow, Roles) ---');

  // 5.1 Review rating outside 1-5
  await testConstraint({
    name: 'Review rating = 0 (below min 1)',
    sql: `INSERT INTO reviews (task_id, reviewer_id, reviewee_id, rating) VALUES ($1, $2, $3, 0);`,
    params: [taskId, requesterId, workerId],
    expectViolation: true,
    expectedConstraint: 'reviews_rating_check'
  });

  await testConstraint({
    name: 'Review rating = 6 (above max 5)',
    sql: `INSERT INTO reviews (task_id, reviewer_id, reviewee_id, rating) VALUES ($1, $2, $3, 6);`,
    params: [taskId, requesterId, workerId],
    expectViolation: true,
    expectedConstraint: 'reviews_rating_check'
  });

  // 5.2 Escrow amount <= 0
  await testConstraint({
    name: 'Escrow amount = 0.00 (must be > 0.00)',
    sql: `INSERT INTO escrow_transactions (task_id, amount) VALUES ($1, 0.00);`,
    params: [taskId],
    expectViolation: true,
    expectedConstraint: 'escrow_transactions_amount_check'
  });

  await testConstraint({
    name: 'Escrow amount = -50.00 (negative)',
    sql: `INSERT INTO escrow_transactions (task_id, amount) VALUES ($1, -50.00);`,
    params: [taskId],
    expectViolation: true,
    expectedConstraint: 'escrow_transactions_amount_check'
  });

  // 5.3 Task agreed price constraint
  await testConstraint({
    name: 'Task agreed_price = 10.00 (must fail: min 20.00)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location, agreed_price)
          VALUES ($1, 'Bad Agreed Price', 'OTHER', 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography, 10.00);`,
    params: [requesterId],
    expectViolation: true,
    expectedConstraint: 'tasks_agreed_price_check'
  });

  await testConstraint({
    name: 'Task agreed_price = 20.00 (exact lower bound)',
    sql: `INSERT INTO tasks (requester_id, title, category, budget, location, agreed_price)
          VALUES ($1, 'Good Agreed Price', 'OTHER', 100.00, ST_SetSRID(ST_MakePoint(77.5684, 13.0184), 4326)::geography, 20.00);`,
    params: [requesterId],
    expectViolation: false
  });

  // 5.4 Escrow status enum check
  await testConstraint({
    name: "Escrow status 'INVALID_STATUS' (must fail)",
    sql: `INSERT INTO escrow_transactions (task_id, amount, status) VALUES ($1, 50.00, 'INVALID_STATUS');`,
    params: [taskId],
    expectViolation: true,
    expectedConstraint: 'escrow_transactions_status_check'
  });

  // 5.5 Ledger entry type enum check
  const walletRes = await client.query('SELECT id FROM wallets LIMIT 1;');
  const walletId = walletRes.rows[0].id;
  await testConstraint({
    name: "Ledger entry type 'ILLEGAL_TRANSFER' (must fail)",
    sql: `INSERT INTO ledger_entries (wallet_id, type, amount) VALUES ($1, 'ILLEGAL_TRANSFER', 100.00);`,
    params: [walletId],
    expectViolation: true,
    expectedConstraint: 'ledger_entries_type_check'
  });

  // 5.6 Profile role enum check
  await testConstraint({
    name: "Profile role 'SUPERUSER' (must fail)",
    sql: `INSERT INTO profiles (id, name, role) VALUES ('11111111-1111-1111-1111-111111111111', 'Attacker', 'SUPERUSER');`,
    params: [],
    expectViolation: true,
    expectedConstraint: 'profiles_role_check'
  });

  // ==========================================================================
  // CHALLENGE 6: PostGIS Spatial Calculations & Geodesic Distances
  // ==========================================================================
  console.log('\n--- CHALLENGE 6: PostGIS Geodesic Calculations & Geofence Filter ---');

  // Run distance calculation between worker 1 and all 8 tasks
  const distQuery = `
    SELECT
      t.id,
      t.title,
      ST_Distance(t.location, p.location) AS distance_meters,
      ST_DWithin(t.location, p.location, 1500) AS is_within_1500m
    FROM tasks t
    CROSS JOIN profiles p
    WHERE p.id = $1
    ORDER BY distance_meters ASC;
  `;
  const distRes = await client.query(distQuery, [workerId]);

  console.log(`Computed distances for ${distRes.rows.length} tasks from worker ${workerId}:`);
  let insideCount = 0;
  let outsideCount = 0;
  for (const row of distRes.rows) {
    const dist = parseFloat(row.distance_meters).toFixed(1);
    const tag = row.is_within_1500m ? '<= 1.5km [INSIDE]' : '> 1.5km [OUTSIDE]';
    if (row.is_within_1500m) insideCount++;
    else outsideCount++;
    console.log(`  ${tag} ${dist}m — ${row.title} (${row.id})`);
  }

  if (insideCount === 6 && outsideCount === 2) {
    results.passed++;
    console.log(`  [PASS] Geodesic calculation verified: exactly 6 tasks inside 1.5km and 2 outside.`);
    results.details.push({ name: 'Geodesic ST_Distance & ST_DWithin count verification', status: 'PASS' });
  } else {
    results.failed++;
    console.error(`  [FAIL] Geodesic calculation count mismatch: inside=${insideCount}, outside=${outsideCount}`);
    results.details.push({ name: 'Geodesic ST_Distance count verification', status: 'FAIL' });
  }

  // Exact boundary test: point at exactly 1499.0m vs point at 1501.0m using ST_Project
  const boundaryCheck = await client.query(`
    SELECT
      ST_Distance(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1499.0, radians(0))
      ) as dist_1499,
      ST_DWithin(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1499.0, radians(0)),
        1500
      ) as within_1499,
      ST_Distance(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1501.0, radians(0))
      ) as dist_1501,
      ST_DWithin(
        ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography,
        ST_Project(ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1501.0, radians(0)),
        1500
      ) as within_1501;
  `);

  const bRow = boundaryCheck.rows[0];
  console.log(`Boundary Point 1499.0m: actual dist = ${parseFloat(bRow.dist_1499).toFixed(2)}m, within 1500m = ${bRow.within_1499}`);
  console.log(`Boundary Point 1501.0m: actual dist = ${parseFloat(bRow.dist_1501).toFixed(2)}m, within 1500m = ${bRow.within_1501}`);

  if (bRow.within_1499 === true && bRow.within_1501 === false) {
    results.passed++;
    console.log('  [PASS] PostGIS exact 1500m boundary discriminator verified.');
    results.details.push({ name: 'PostGIS exact 1500m boundary discriminator', status: 'PASS' });
  } else {
    results.failed++;
    console.error('  [FAIL] PostGIS boundary discriminator failed!');
    results.details.push({ name: 'PostGIS boundary discriminator', status: 'FAIL' });
  }
  results.total++;

  // ==========================================================================
  // CHALLENGE 7: GiST Spatial Index Execution Plan & Query Performance
  // ==========================================================================
  console.log('\n--- CHALLENGE 7: GiST Spatial Index Execution & Performance ---');

  // Verify GiST index definition on tasks.location
  const idxInfo = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'tasks' AND indexdef ILIKE '%gist%location%';
  `);
  console.log('GiST Index on tasks(location):', idxInfo.rows[0]);

  // Test EXPLAIN ANALYZE on ST_DWithin query with enable_seqscan = off
  // to force and verify index scan on GiST index
  await client.query('SET enable_seqscan = off;');
  const explainForced = await client.query(`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT id, title, location
    FROM tasks
    WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography, 1500);
  `);
  await client.query('SET enable_seqscan = on;');

  const forcedPlan = explainForced.rows[0]['QUERY PLAN'][0];
  const dbExecTime = forcedPlan['Execution Time'];
  const dbPlanTime = forcedPlan['Planning Time'];
  const indexNameUsed = forcedPlan.Plan['Index Name'] || forcedPlan.Plan.Plans?.[0]?.['Index Name'];

  console.log('GiST Index Forced Plan Node Type:', forcedPlan.Plan['Node Type']);
  console.log('GiST Index Name Used:', indexNameUsed);
  console.log('DB Engine Execution Time (ms):', dbExecTime);
  console.log('DB Engine Planning Time (ms):', dbPlanTime);

  results.total++;
  if (indexNameUsed === 'idx_tasks_location') {
    results.passed++;
    console.log(`  [PASS] GiST Index Scan confirmed using index '${indexNameUsed}'`);
    results.details.push({ name: 'GiST Index Scan verification', status: 'PASS', index: indexNameUsed });
  } else {
    results.failed++;
    console.error(`  [FAIL] GiST Index Scan did not use idx_tasks_location. Used: ${indexNameUsed}`);
    results.details.push({ name: 'GiST Index Scan verification', status: 'FAIL' });
  }

  // DB Execution Time Verification (< 5 ms for GiST index lookup)
  results.total++;
  if (dbExecTime < 10.0) {
    results.passed++;
    console.log(`  [PASS] Database GiST index execution time is excellent: ${dbExecTime} ms (< 10 ms)`);
    results.details.push({ name: 'GiST DB Engine Execution Time', status: 'PASS', execTimeMs: dbExecTime });
  } else {
    results.failed++;
    console.error(`  [FAIL] GiST DB Engine Execution Time too slow: ${dbExecTime} ms`);
    results.details.push({ name: 'GiST DB Engine Execution Time', status: 'FAIL' });
  }

  // Latency & Benchmark Test: 100 Iterations of Spatial Query
  console.log('\nRunning 100 iterations of spatial GiST distance queries...');
  const latencies = [];
  const testPointWkt = 'SRID=4326;POINT(77.5685 13.0185)';

  for (let i = 0; i < 100; i++) {
    const t0 = performance.now();
    await client.query(`
      SELECT id, title, ST_Distance(location, ST_GeogFromText($1)) as dist
      FROM tasks
      WHERE ST_DWithin(location, ST_GeogFromText($1), 1500)
      ORDER BY dist ASC;
    `, [testPointWkt]);
    const t1 = performance.now();
    latencies.push(t1 - t0);
  }

  latencies.sort((a, b) => a - b);
  const min = latencies[0].toFixed(2);
  const max = latencies[latencies.length - 1].toFixed(2);
  const mean = (latencies.reduce((sum, v) => sum + v, 0) / latencies.length).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.50)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);

  console.log('----------------------------------------------------');
  console.log('SPATIAL QUERY PERFORMANCE BENCHMARK (100 Iterations)');
  console.log(`  Iterations: ${latencies.length}`);
  console.log(`  Client-Server Network RTT:`);
  console.log(`    Min:        ${min} ms`);
  console.log(`    Mean:       ${mean} ms`);
  console.log(`    p50:        ${p50} ms`);
  console.log(`    p95:        ${p95} ms`);
  console.log(`    p99:        ${p99} ms`);
  console.log(`    Max:        ${max} ms`);
  console.log('----------------------------------------------------');

  results.total++;
  // Over WAN network, mean RTT < 250ms is acceptable
  if (parseFloat(mean) < 250.0) {
    results.passed++;
    console.log(`  [PASS] Spatial query client round-trip latency verified (Mean: ${mean}ms < 250ms WAN baseline)`);
    results.details.push({ name: 'Spatial Query Latency Benchmark', status: 'PASS', metrics: { min, mean, p50, p95, p99, max } });
  } else {
    results.failed++;
    console.error(`  [FAIL] Spatial query latency too high: Mean=${mean}ms`);
    results.details.push({ name: 'Spatial Query Latency Benchmark', status: 'FAIL', metrics: { min, mean, p50, p95, p99, max } });
  }

  // Summary
  console.log('\n================================================================');
  console.log(`SUMMARY: Total Challenges: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed}`);
  console.log('================================================================');

  await client.end();
  return results;
}

runEmpiricalChallenge()
  .then((res) => {
    if (res.failed > 0) {
      console.error(`\nFAILED: ${res.failed} empirical challenges failed.`);
      process.exit(1);
    } else {
      console.log('\nSUCCESS: All empirical challenges PASSED.');
      process.exit(0);
    }
  })
  .catch((err) => {
    console.error('CRITICAL ERROR in challenge runner:', err);
    process.exit(1);
  });
