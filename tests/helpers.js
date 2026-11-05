import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env.local is loaded
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // ignore
    }
  }
  if (!process.env.VITE_SUPABASE_URL) {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase configuration in .env.local');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function getAnonClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase anon configuration in .env.local');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * Creates or retrieves a test user with confirmed email and profile/wallet
 */
export async function getOrCreateTestUser({
  email,
  password = 'TestPassword123!',
  name = 'Test User',
  role = 'WORKER',
  lat = null,
  lng = null,
  initialBalance = 0
}) {
  const admin = getAdminClient();
  let userId;

  const { data: usersData, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`listUsers error: ${listError.message}`);

  const existing = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    userId = existing.id;
    // ensure password is in sync
    await admin.auth.admin.updateUserById(userId, { password });
  } else {
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role }
    });
    if (createError) throw new Error(`Failed to create test user ${email}: ${createError.message}`);
    userId = createData.user.id;
  }

  // Profile upsert
  const locationWkt = (lat !== null && lng !== null) ? `SRID=4326;POINT(${lng} ${lat})` : null;
  const profilePayload = {
    id: userId,
    name,
    role,
    ...(locationWkt ? { location: locationWkt } : {})
  };

  try {
    await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' });
  } catch (err) {
    // Non-fatal if schema is being refreshed
  }

  // Wallet upsert
  if (initialBalance !== undefined && initialBalance !== null) {
    try {
      const { data: walletData } = await admin.from('wallets').select('*').eq('user_id', userId).maybeSingle();
      if (walletData) {
        await admin.from('wallets').update({ balance: initialBalance }).eq('id', walletData.id);
      } else {
        await admin.from('wallets').insert({ user_id: userId, balance: initialBalance });
      }
    } catch (err) {
      // Non-fatal
    }
  }

  // Client sign in
  const client = getAnonClient();
  const { data: authData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password
  });
  if (signInError) {
    throw new Error(`Failed to sign in as ${email}: ${signInError.message}`);
  }

  return {
    userId,
    email,
    client,
    session: authData?.session
  };
}

/**
 * Cleanup database artifacts created during tests
 */
export async function cleanupTask(taskId) {
  if (!taskId) return;
  const admin = getAdminClient();
  try {
    await admin.from('reviews').delete().eq('task_id', taskId);
    await admin.from('ledger_entries').delete().eq('task_id', taskId);
    await admin.from('escrow_transactions').delete().eq('task_id', taskId);
    await admin.from('bids').delete().eq('task_id', taskId);
    await admin.from('tasks').delete().eq('id', taskId);
  } catch {
    // ignore
  }
}

/**
 * Smart RPC caller that handles argument name differences between specs
 */
export async function callRpc(client, fnName, primaryParams, fallbackParams = null) {
  let res = await client.rpc(fnName, primaryParams);
  if (res.error && res.error.code === 'PGRST202' && fallbackParams) {
    res = await client.rpc(fnName, fallbackParams);
  }
  return res;
}

/**
 * High-precision percentile latency calculation
 */
export function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) {
    return { min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0, count: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
  const p99 = sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)];
  return {
    min: Number(sorted[0].toFixed(2)),
    mean: Number(mean.toFixed(2)),
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    count: sorted.length
  };
}
