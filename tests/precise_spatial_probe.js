import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import assert from 'node:assert/strict';
import {
  getAdminClient,
  getAnonClient,
  getOrCreateTestUser,
  cleanupTask,
  callRpc
} from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
const projectRef = envConfig.SUPABASE_PROJECT_REF;
const dbPassword = envConfig.SUPABASE_DB_PASSWORD;

async function getPgClient() {
  const client = new Client({
    host: `db.${projectRef}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  await client.connect();
  return client;
}

async function runPreciseSpatialProbes() {
  console.log('=== Precise PostGIS Geodesic Spatial Probing ===');
  const pg = await getPgClient();
  const adminClient = getAdminClient();
  const anonClient = getAnonClient();

  const refLat = 13.0184;
  const refLng = 77.5684;

  // Ask PostGIS to compute exact ST_Project coordinates on WGS-84 ellipsoid at 1490m, 1500m, 1510m
  const query = `
    WITH origin AS (
      SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS geog
    )
    SELECT
      d.dist,
      ST_Y(ST_Project(origin.geog, d.dist, radians(0))::geometry) AS lat,
      ST_X(ST_Project(origin.geog, d.dist, radians(0))::geometry) AS lng,
      ROUND(ST_Distance(origin.geog, ST_Project(origin.geog, d.dist, radians(0)))::numeric, 2) AS exact_dist
    FROM origin,
    (VALUES (1490.0), (1499.0), (1500.0), (1501.0), (1510.0)) AS d(dist);
  `;

  const res = await pg.query(query, [refLng, refLat]);
  console.log('PostGIS Exact Projected Coordinates:');
  console.table(res.rows);

  const points = res.rows;

  // Post a test task at refLat, refLng
  const requester = await getOrCreateTestUser({
    email: 'adv_spatial_req@whap.local',
    name: 'Spatial Requester',
    role: 'REQUESTER',
    lat: refLat,
    lng: refLng,
    initialBalance: 1000.00
  });

  const worker = await getOrCreateTestUser({
    email: 'adv_spatial_wkr@whap.local',
    name: 'Spatial Worker',
    role: 'WORKER',
    lat: refLat,
    lng: refLng,
    initialBalance: 100.00
  });

  const { data: task, error: postErr } = await callRpc(requester.client, 'post_task', {
    p_title: 'PostGIS Geodesic Boundary Task',
    p_description: 'Testing exact 1490m, 1500m, 1510m PostGIS cutoff',
    p_category: 'OTHER',
    p_budget: 100.00,
    p_lat: refLat,
    p_lng: refLng
  });
  assert.ifError(postErr);
  const taskId = task.id || task.task_id;

  try {
    console.log('\n--- Evaluating nearby_tasks at each exact distance ---');
    for (const pt of points) {
      const lat = parseFloat(pt.lat);
      const lng = parseFloat(pt.lng);
      const dist = parseFloat(pt.dist);

      const rpcRes = await callRpc(anonClient, 'nearby_tasks', {
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: 1500
      });
      assert.ifError(rpcRes.error);

      const found = rpcRes.data?.find(t => t.id === taskId);
      const returnedDist = found ? found.distance_meters : null;
      const expectedInside = dist <= 1500.0;

      console.log(`Dist ${dist}m -> Found: ${Boolean(found)}, Reported Distance: ${returnedDist}m, Expected: ${expectedInside}`);
      if (expectedInside) {
        assert.ok(found, `Task at ${dist}m MUST be returned by nearby_tasks`);
        assert.ok(found.distance_meters <= 1500.0, `Reported distance ${found.distance_meters} must be <= 1500m`);
      } else {
        assert.strictEqual(found, undefined, `Task at ${dist}m MUST NOT be returned by nearby_tasks`);
      }

      // Test place_bid behavior at this distance
      const bidRes = await callRpc(worker.client, 'place_bid', {
        p_task_id: taskId,
        p_price: 80.00,
        p_lat: lat,
        p_lng: lng
      });

      if (expectedInside) {
        assert.ifError(bidRes.error, `place_bid at ${dist}m must succeed`);
        console.log(`  -> place_bid at ${dist}m: SUCCESS`);
      } else {
        assert.ok(bidRes.error, `place_bid at ${dist}m must fail`);
        console.log(`  -> place_bid at ${dist}m: REJECTED (${bidRes.error.message})`);
      }
    }
    console.log('\n>>> All PostGIS exact boundary checks passed with 100% mathematical precision! <<<');
  } finally {
    await cleanupTask(taskId);
    await pg.end();
  }
}

runPreciseSpatialProbes()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Precise spatial probe failed:', err);
    process.exit(1);
  });
