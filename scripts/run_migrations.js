import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
const env = dotenv.parse(fs.readFileSync(envPath));

const projectRef = env.SUPABASE_PROJECT_REF;
const dbPassword = env.SUPABASE_DB_PASSWORD;
const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!projectRef || !dbPassword || !supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const pgClient = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

// Seed Users Definition
const SEED_USERS = [
  {
    email: 'requester_1@whap.local',
    password: 'whap_demo_password_123',
    name: 'Rahul Requester (Eng Dept)',
    role: 'REQUESTER',
    balance: 500.00,
    lat: 13.0184,
    lng: 77.5684
  },
  {
    email: 'requester_2@whap.local',
    password: 'whap_demo_password_123',
    name: 'Priya Requester (Bio Dept)',
    role: 'REQUESTER',
    balance: 500.00,
    lat: 13.0190,
    lng: 77.5690
  },
  {
    email: 'worker_1@whap.local',
    password: 'whap_demo_password_123',
    name: 'Amit Worker (Main Gate)',
    role: 'WORKER',
    balance: 0.00,
    lat: 13.0185,
    lng: 77.5685 // ~15m from campus center
  },
  {
    email: 'worker_2@whap.local',
    password: 'whap_demo_password_123',
    name: 'Sneha Worker (Library)',
    role: 'WORKER',
    balance: 0.00,
    lat: 13.0210,
    lng: 77.5700 // ~350m
  },
  {
    email: 'worker_3@whap.local',
    password: 'whap_demo_password_123',
    name: 'Karthik Worker (Hostel Block)',
    role: 'WORKER',
    balance: 0.00,
    lat: 13.0240,
    lng: 77.5750 // ~950m
  },
  {
    email: 'worker_4@whap.local',
    password: 'whap_demo_password_123',
    name: 'Deepa Worker (Sports Ground)',
    role: 'WORKER',
    balance: 0.00,
    lat: 13.0120,
    lng: 77.5600 // ~1200m
  },
  {
    email: 'admin@whap.local',
    password: 'whap_admin_password_123',
    name: 'WHAP Campus Administrator',
    role: 'ADMIN',
    balance: 0.00,
    lat: 13.0184,
    lng: 77.5684
  }
];

// Seed Tasks Definition (6 within 1.5 km, 2 outside > 1.5 km)
const SEED_TASKS = [
  {
    requesterEmail: 'requester_1@whap.local',
    title: 'Xerox Pickup - 5 copies lecture notes',
    description: 'Pick up 5 bound copies of Machine Learning lecture notes from Nesara Xerox and deliver to CSA Department Room 102.',
    category: 'XEROX_PICKUP',
    budget: 60.00,
    lat: 13.0190,
    lng: 77.5680,
    address: 'Nesara Xerox, Near Campus Gate 2',
    isInside: true
  },
  {
    requesterEmail: 'requester_1@whap.local',
    title: 'Buy Stationery - Record notebook & pens',
    description: 'Buy 2 blue lab record books and 3 black gel pens from Campus General Store.',
    category: 'BUY_ITEMS',
    budget: 120.00,
    lat: 13.0200,
    lng: 77.5690,
    address: 'Campus General Store, Main Canteen Complex',
    isInside: true
  },
  {
    requesterEmail: 'requester_1@whap.local',
    title: 'Carry Reference Books to Dept Library',
    description: 'Help carry 4 heavy reference books from Physics Faculty Office to the Central Library reading room.',
    category: 'CARRY_THINGS',
    budget: 100.00,
    lat: 13.0215,
    lng: 77.5710,
    address: 'Department of Physics, Faculty Wing',
    isInside: true
  },
  {
    requesterEmail: 'requester_2@whap.local',
    title: 'Queue for Mess Token Registration',
    description: 'Stand in line at Dining Hall B to collect the special dinner registration token between 12:00 and 12:30 PM.',
    category: 'QUEUE',
    budget: 150.00,
    lat: 13.0230,
    lng: 77.5730,
    address: 'Dining Hall B, Hostel Complex',
    isInside: true
  },
  {
    requesterEmail: 'requester_2@whap.local',
    title: 'Hardware Component Pickup from Lab',
    description: 'Collect Arduino sensors packet from ECE Lab 3 and hand over at Mechanical Workshop entrance.',
    category: 'BUY_ITEMS',
    budget: 80.00,
    lat: 13.0250,
    lng: 77.5750,
    address: 'ECE Department Lab 3',
    isInside: true
  },
  {
    requesterEmail: 'requester_2@whap.local',
    title: 'Canteen Food Delivery to Hostel Block C',
    description: 'Pick up 2 dosas and 1 coffee from Prakruthi Canteen and deliver to Hostel Block C security desk.',
    category: 'OTHER',
    budget: 75.00,
    lat: 13.0130,
    lng: 77.5620,
    address: 'Prakruthi Vegetarian Canteen',
    isInside: true
  },
  {
    requesterEmail: 'requester_1@whap.local',
    title: 'Collect Express Parcel from City Post Office',
    description: 'Collect speed post parcel with tracking number from the City Head Post Office outside campus boundary.',
    category: 'BUY_ITEMS',
    budget: 200.00,
    lat: 13.0000,
    lng: 77.5500, // ~2.8 km away
    address: 'City Head Post Office, Malleshwaram',
    isInside: false
  },
  {
    requesterEmail: 'requester_2@whap.local',
    title: 'Purchase Metro Smart Card at Majestic Station',
    description: 'Buy a pre-loaded Metro Namma card from the customer counter at Majestic interchange station.',
    category: 'OTHER',
    budget: 90.00,
    lat: 13.0380,
    lng: 77.5900, // ~3.2 km away
    address: 'Majestic Metro Interchange Station',
    isInside: false
  }
];

async function main() {
  console.log('=== Step 1: Connecting to remote PostgreSQL ===');
  await pgClient.connect();
  console.log('Connected to PostgreSQL successfully.');

  console.log('=== Step 2: Executing Migration SQL File ===');
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261105000000_m1_initial_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  await pgClient.query(migrationSql);
  console.log('Migration SQL executed successfully.');

  console.log('=== Step 3: Seeding Auth Users & Profiles ===');
  const userMap = {};

  for (const u of SEED_USERS) {
    console.log(`Setting up user: ${u.email} (${u.role})...`);
    
    // Check if user already exists in auth.users
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    let existingUser = listData.users.find(usr => usr.email === u.email);

    let userId;
    if (!existingUser) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role }
      });
      if (createError) {
        throw new Error(`Failed creating user ${u.email}: ${createError.message}`);
      }
      userId = createData.user.id;
      console.log(`Created new auth user ${u.email} -> ${userId}`);
    } else {
      userId = existingUser.id;
      console.log(`User ${u.email} already exists -> ${userId}`);
      // Update password and metadata to ensure valid state
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: u.password,
        email_confirm: true,
        user_metadata: { name: u.name, role: u.role }
      });
    }

    userMap[u.email] = userId;

    // Ensure profile row exists and has correct location, name, and role
    await pgClient.query(`
      INSERT INTO public.profiles (id, name, role, location)
      VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        location = EXCLUDED.location,
        updated_at = now();
    `, [userId, u.name, u.role, u.lng, u.lat]);

    // Ensure wallet row exists and has correct balance
    await pgClient.query(`
      INSERT INTO public.wallets (user_id, balance)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        balance = EXCLUDED.balance,
        updated_at = now();
    `, [userId, u.balance]);

    // Record initial ledger entry if balance > 0
    if (u.balance > 0) {
      await pgClient.query(`
        INSERT INTO public.ledger_entries (wallet_id, type, amount)
        SELECT id, 'TOPUP', $2
        FROM public.wallets WHERE user_id = $1
        ON CONFLICT DO NOTHING;
      `, [userId, u.balance]);
    }
  }

  console.log('=== Step 4: Seeding 8 Campus Tasks ===');
  // Clear any existing demo tasks to allow clean re-run
  await pgClient.query('DELETE FROM public.tasks;');

  for (const t of SEED_TASKS) {
    const requesterId = userMap[t.requesterEmail];
    if (!requesterId) {
      throw new Error(`Requester ${t.requesterEmail} not found in userMap`);
    }

    const res = await pgClient.query(`
      INSERT INTO public.tasks (
        requester_id,
        title,
        description,
        category,
        budget,
        location,
        address,
        status
      ) VALUES (
        $1, $2, $3, $4, $5,
        ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
        $8, 'OPEN'
      ) RETURNING id;
    `, [requesterId, t.title, t.description, t.category, t.budget, t.lng, t.lat, t.address]);

    console.log(`Seeded task: "${t.title}" (${t.isInside ? '<= 1.5km' : '> 1.5km'}) -> ID: ${res.rows[0].id}`);
  }

  console.log('=== Step 5: Verification of Table Counts ===');
  const tables = [
    'profiles', 'wallets', 'tasks', 'bids', 'escrow_transactions',
    'ledger_entries', 'reviews', 'notifications', 'config'
  ];

  for (const tbl of tables) {
    const res = await pgClient.query(`SELECT count(*) FROM public.${tbl};`);
    console.log(`Table ${tbl}: ${res.rows[0].count} rows`);
  }

  // Reload PostgREST schema cache
  await pgClient.query("NOTIFY pgrst, 'reload schema';");

  await pgClient.end();
  console.log('=== Milestone 1 Migrations & Seeding Completed Successfully! ===');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
