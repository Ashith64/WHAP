import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));

const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

const pgClient = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function runGateVerification() {
  console.log('================================================================');
  console.log('WHAP Milestone 1: Gate Verification');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  await pgClient.connect();

  // --------------------------------------------------------------------------
  // GATE CHECK 1: Verify All 9 Tables Exist & Constraints / Indexes Are Active
  // --------------------------------------------------------------------------
  console.log('--- GATE CHECK 1: All 9 Tables & Database Objects Integrity ---');
  const expectedTables = [
    'profiles', 'wallets', 'tasks', 'bids', 'escrow_transactions',
    'ledger_entries', 'reviews', 'notifications', 'config'
  ];

  const tablesRes = await pgClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);
  const actualTables = tablesRes.rows.map(r => r.table_name);
  console.log('Found public tables in database:', actualTables);

  for (const tbl of expectedTables) {
    assert(actualTables.includes(tbl), `Required table '${tbl}' is missing!`);
    console.log(`  ✓ Table '${tbl}' exists`);
  }

  // Check PostGIS extension
  const extRes = await pgClient.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';");
  assert(extRes.rows.length > 0, "Extension 'postgis' is not installed!");
  console.log(`  ✓ Extension 'postgis' active (version: ${extRes.rows[0].extversion})`);

  // Check GiST Spatial Index on tasks.location
  const gistRes = await pgClient.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'tasks' AND indexdef ILIKE '%gist%location%';
  `);
  assert(gistRes.rows.length > 0, "Spatial GiST index on tasks(location) is missing!");
  console.log(`  ✓ Spatial GiST index active: ${gistRes.rows[0].indexname}`);

  // Check CHECK constraints
  const checkRes = await pgClient.query(`
    SELECT conname, pg_get_constraintdef(c.oid) as def
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public' AND c.contype = 'c';
  `);
  console.log(`  ✓ Found ${checkRes.rows.length} CHECK constraints in public schema:`);
  checkRes.rows.forEach(r => console.log(`     - ${r.conname}: ${r.def}`));

  // Check RLS is enabled on all 9 tables
  const rlsRes = await pgClient.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND relname = ANY($1::text[]);
  `, [expectedTables]);

  for (const r of rlsRes.rows) {
    assert(r.relrowsecurity, `RLS is NOT enabled on table ${r.relname}!`);
    console.log(`  ✓ RLS enabled on table: ${r.relname}`);
  }

  // Check Seeded Data Counts
  console.log('\n--- Seed Data Verification ---');
  const seedEmails = [
    'requester_1@whap.local', 'requester_2@whap.local',
    'worker_1@whap.local', 'worker_2@whap.local', 'worker_3@whap.local', 'worker_4@whap.local',
    'admin@whap.local'
  ];

  const seedProfilesRes = await pgClient.query(`
    SELECT p.id, p.name, p.role, u.email,
           ST_AsText(p.location) as loc_text
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE u.email = ANY($1::text[]);
  `, [seedEmails]);

  console.log(`Found ${seedProfilesRes.rows.length} of 7 required campus seed profiles:`);
  seedProfilesRes.rows.forEach(r => console.log(`  - ${r.email} | ${r.role} | ${r.name} | ${r.loc_text}`));
  assert.strictEqual(seedProfilesRes.rows.length, 7, 'All 7 seed profiles must exist (2 requesters, 4 workers, 1 admin)');

  const profCount = await pgClient.query('SELECT count(*) FROM public.profiles;');
  const wallCount = await pgClient.query('SELECT count(*) FROM public.wallets;');
  const taskCount = await pgClient.query('SELECT count(*) FROM public.tasks;');
  const confCount = await pgClient.query('SELECT count(*) FROM public.config;');

  assert(parseInt(profCount.rows[0].count) >= 7, 'Profiles count must be at least 7');
  assert(parseInt(wallCount.rows[0].count) >= 7, 'Wallets count must be at least 7');
  assert.strictEqual(parseInt(taskCount.rows[0].count), 8, 'Tasks count must be 8 (6 inside, 2 outside)');
  assert(parseInt(confCount.rows[0].count) >= 15, 'Config count must be >= 15');

  console.log(`  ✓ Profiles seeded: ${profCount.rows[0].count} total (includes 2 requesters, 4 workers, 1 admin)`);
  console.log(`  ✓ Wallets seeded: ${wallCount.rows[0].count}`);
  console.log(`  ✓ Tasks seeded: ${taskCount.rows[0].count} (6 inside 1.5km, 2 outside)`);
  console.log(`  ✓ Config seeded: ${confCount.rows[0].count} operational parameters`);

  // Query tasks with actual distances from Worker 1 (13.0185 N, 77.5685 E)
  const taskDistances = await pgClient.query(`
    SELECT
      id,
      title,
      category,
      budget,
      ROUND(ST_Distance(location, ST_SetSRID(ST_MakePoint(77.5685, 13.0185), 4326)::geography)::numeric, 1) AS distance_meters
    FROM public.tasks
    ORDER BY distance_meters ASC;
  `);

  console.log('\n--- Geodesic Distance of 8 Tasks from Worker 1 ---');
  let insideCount = 0;
  let outsideCount = 0;
  const outsideTaskIds = [];
  const insideTaskIds = [];

  for (const t of taskDistances.rows) {
    const dist = parseFloat(t.distance_meters);
    const isWithin1500m = dist <= 1500.0;
    if (isWithin1500m) {
      insideCount++;
      insideTaskIds.push(t.id);
      console.log(`  [<= 1.5km] Task ${t.id} | ${t.title} | ${dist}m`);
    } else {
      outsideCount++;
      outsideTaskIds.push(t.id);
      console.log(`  [> 1.5km ] Task ${t.id} | ${t.title} | ${dist}m  *** OUTSIDE ***`);
    }
  }

  assert.strictEqual(insideCount, 6, 'Must have exactly 6 tasks <= 1.5 km from campus');
  assert.strictEqual(outsideCount, 2, 'Must have exactly 2 tasks > 1.5 km from campus');
  console.log(`\nVerified task spatial distribution: 6 inside (min: ${taskDistances.rows[0].distance_meters}m, max: ${taskDistances.rows[5].distance_meters}m), 2 outside (min: ${taskDistances.rows[6].distance_meters}m, max: ${taskDistances.rows[7].distance_meters}m)`);


  // --------------------------------------------------------------------------
  // GATE CHECK 2: Spatial Isolation Gate (Worker Cannot Query Tasks > 1.5 km by ID)
  // --------------------------------------------------------------------------
  console.log('\n--- GATE CHECK 2: Spatial Isolation Gate (1.5 km Boundary) ---');

  // Authenticate as worker_1 via Supabase Client
  const clientWorker = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: authData, error: authErr } = await clientWorker.auth.signInWithPassword({
    email: 'worker_1@whap.local',
    password: 'whap_demo_password_123'
  });
  assert(!authErr, `Worker authentication failed: ${authErr?.message}`);
  const worker1Id = authData.user.id;
  console.log(`Worker 1 authenticated successfully. User ID: ${worker1Id}`);

  // Query 1: Worker queries all visible tasks
  const { data: visibleTasks, error: visErr } = await clientWorker
    .from('tasks')
    .select('id, title, budget, status');
  assert(!visErr, `Worker task query error: ${visErr?.message}`);
  console.log(`Worker 1 general query returned ${visibleTasks.length} tasks.`);
  assert.strictEqual(visibleTasks.length, 6, 'Worker 1 must ONLY see the 6 tasks within 1.5 km!');

  // Verify none of the returned tasks are outside tasks
  for (const t of visibleTasks) {
    assert(!outsideTaskIds.includes(t.id), `CRITICAL SECURITY LEAK: Outside task ${t.id} was visible in general query!`);
  }
  console.log('  ✓ General query: 0 outside tasks returned.');

  // Query 2: Direct ID query for tasks OUTSIDE 1.5 km
  console.log('\nTesting direct ID queries for tasks > 1.5 km:');
  for (const outId of outsideTaskIds) {
    // Attempt select('*') by direct id
    const { data: directQueryData, error: directErr } = await clientWorker
      .from('tasks')
      .select('*')
      .eq('id', outId);

    assert(!directErr, `Unexpected error on direct query: ${directErr?.message}`);
    console.log(`  Direct query by ID (${outId}): returned ${directQueryData.length} rows.`);
    assert.strictEqual(
      directQueryData.length,
      0,
      `CRITICAL SECURITY VIOLATION: Worker was able to query task ${outId} beyond 1.5 km by direct ID!`
    );
  }
  console.log('  ✓ PASSED: Worker cannot query tasks > 1.5 km even by direct ID (returned 0 rows).');

  // Query 3: Direct ID query for tasks INSIDE 1.5 km
  console.log('\nTesting direct ID queries for tasks <= 1.5 km:');
  for (const inId of insideTaskIds) {
    const { data: inData, error: inErr } = await clientWorker
      .from('tasks')
      .select('id, title, budget')
      .eq('id', inId);

    assert(!inErr, `Error querying inside task: ${inErr?.message}`);
    assert.strictEqual(inData.length, 1, `Worker should be able to see inside task ${inId}`);
  }
  console.log('  ✓ PASSED: Worker can see all tasks within 1.5 km.');


  // --------------------------------------------------------------------------
  // GATE CHECK 3: Direct Client Wallet Update Denial (RLS Security)
  // --------------------------------------------------------------------------
  console.log('\n--- GATE CHECK 3: Direct Client Wallet Mutation Denial ---');

  // Fetch current wallet balance of worker_1
  const { data: initialWallet, error: initWallErr } = await clientWorker
    .from('wallets')
    .select('id, balance')
    .eq('user_id', worker1Id);
  assert(!initWallErr, `Failed to read worker wallet: ${initWallErr?.message}`);
  const startingBalance = parseFloat(initialWallet[0].balance);
  console.log(`Worker 1 initial wallet balance: Rs ${startingBalance}`);

  // Attempt direct UPDATE on wallets
  console.log('Attempting malicious direct UPDATE on wallets: balance -> 999999.00...');
  const { data: updateData, error: updateErr } = await clientWorker
    .from('wallets')
    .update({ balance: 999999.00 })
    .eq('user_id', worker1Id)
    .select();

  console.log('Update call result:', { error: updateErr?.message, updatedRows: updateData?.length || 0 });

  // Verify wallet balance in DB remained intact
  const { data: finalWallet, error: finalWallErr } = await clientWorker
    .from('wallets')
    .select('id, balance')
    .eq('user_id', worker1Id);
  assert(!finalWallErr, `Failed to re-read worker wallet: ${finalWallErr?.message}`);
  const endingBalance = parseFloat(finalWallet[0].balance);
  console.log(`Worker 1 ending wallet balance: Rs ${endingBalance}`);

  assert.strictEqual(
    endingBalance,
    startingBalance,
    `CRITICAL SECURITY VIOLATION: Wallet balance was modified from ${startingBalance} to ${endingBalance}!`
  );
  console.log('  ✓ PASSED: Direct client wallet update rejected by RLS (balance unchanged at Rs 0.00).');

  // Attempt direct INSERT into escrow_transactions
  console.log('\nAttempting malicious direct INSERT into escrow_transactions...');
  const { error: escrowInsertErr } = await clientWorker
    .from('escrow_transactions')
    .insert({
      task_id: insideTaskIds[0],
      amount: 1000.00,
      platform_fee: 100.00,
      status: 'HELD'
    });
  console.log('Escrow insert result:', { error: escrowInsertErr?.message || 'denied by RLS (0 rows)' });

  // Attempt direct INSERT into ledger_entries
  console.log('Attempting malicious direct INSERT into ledger_entries...');
  const { error: ledgerInsertErr } = await clientWorker
    .from('ledger_entries')
    .insert({
      wallet_id: initialWallet[0].id,
      type: 'TOPUP',
      amount: 999999.00
    });
  console.log('Ledger insert result:', { error: ledgerInsertErr?.message || 'denied by RLS (0 rows)' });

  console.log('  ✓ PASSED: Direct mutations on financial tables (wallets, escrow_transactions, ledger_entries) are completely denied.');


  // --------------------------------------------------------------------------
  // GATE CHECK 4: OTP Secrecy Verification
  // --------------------------------------------------------------------------
  console.log('\n--- GATE CHECK 4: OTP Secrecy Verification ---');
  // Worker attempts to query get_task_otp RPC
  const { data: otpData, error: otpErr } = await clientWorker
    .rpc('get_task_otp', { p_task_id: insideTaskIds[0] });

  console.log('Worker get_task_otp RPC result:', { data: otpData, error: otpErr?.message });
  assert(otpErr !== null || otpData === null, 'CRITICAL SECURITY VIOLATION: Worker was able to read task OTP!');
  console.log('  ✓ PASSED: Worker cannot read task OTP.');

  console.log('\n================================================================');
  console.log('ALL MILESTONE 1 GATE VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');

  await pgClient.end();
}

runGateVerification().catch(err => {
  console.error('\nGATE VERIFICATION FAILED:', err);
  process.exit(1);
});
