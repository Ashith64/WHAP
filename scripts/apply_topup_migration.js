import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const projectRef = envConfig.SUPABASE_PROJECT_REF;
const dbPassword = envConfig.SUPABASE_DB_PASSWORD;

async function getConnectedClient() {
  const host = `aws-0-ap-southeast-1.pooler.supabase.com`;
  const port = 6543;
  const user = `postgres.${projectRef}`;

  console.log(`Connecting to ${host}:${port}...`);
  const client = new Client({
    host,
    port,
    user,
    password: dbPassword,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  await client.connect();
  console.log(`Connected via ${host}:${port}`);
  return client;
}

async function main() {
  const migrationPath = path.resolve(__dirname, '../supabase/migrations/20261106000001_simulate_topup.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = await getConnectedClient();
  try {
    console.log('Deploying simulate_topup function...');
    await client.query(sql);
    console.log('simulate_topup deployed successfully.');
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log('PostgREST schema cache reloaded.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Error applying topup migration:', err);
  process.exit(1);
});
