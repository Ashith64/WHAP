import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local file not found at:', envPath);
  process.exit(1);
}
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const projectRef = envConfig.SUPABASE_PROJECT_REF;
const dbPassword = envConfig.SUPABASE_DB_PASSWORD;

if (!projectRef || !dbPassword) {
  console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_DB_PASSWORD in .env.local');
  process.exit(1);
}

async function getConnectedClient() {
  const configs = [
    {
      host: `aws-0-ap-south-1.pooler.supabase.com`,
      port: 6543,
      user: `postgres.${projectRef}`
    },
    {
      host: `db.${projectRef}.supabase.co`,
      port: 5432,
      user: 'postgres'
    }
  ];

  for (const c of configs) {
    try {
      console.log(`Attempting connection to ${c.host}:${c.port}...`);
      const client = new Client({
        host: c.host,
        port: c.port,
        user: c.user,
        password: dbPassword,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000
      });
      await client.connect();
      console.log(`Successfully connected to PostgreSQL via ${c.host}:${c.port}`);
      return client;
    } catch (e) {
      console.log(`Failed connecting via ${c.host}:${c.port}: ${e.message}`);
    }
  }
  throw new Error('Could not connect to PostgreSQL via any configured endpoint');
}

async function main() {
  console.log('--- WHAP Milestone 2 Migration Runner ---');
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261106000000_m2_rpc_functions.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration SQL file not found at: ${migrationPath}`);
  }

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Read migration SQL (${migrationSql.length} bytes) from ${migrationPath}`);

  const client = await getConnectedClient();

  try {
    console.log('Executing Milestone 2 RPC migration SQL...');
    await client.query(migrationSql);
    console.log('Migration SQL executed successfully.');

    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("PostgREST reload signal sent: NOTIFY pgrst, 'reload schema';");

    // Wait a brief moment for PostgREST to reload its schema cache
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Schema reload wait complete.');
  } finally {
    await client.end();
    console.log('PostgreSQL connection closed.');
  }

  console.log('Milestone 2 migration deployment complete!');
}

main().catch(err => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
