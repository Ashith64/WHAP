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
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const projectRef = envConfig.SUPABASE_PROJECT_REF;
const dbPassword = envConfig.SUPABASE_DB_PASSWORD;

const hosts = [
  `aws-0-ap-southeast-1.pooler.supabase.com`,
  `aws-0-ap-south-1.pooler.supabase.com`,
  `db.${projectRef}.supabase.co`
];

async function testConnection() {
  for (const host of hosts) {
    const isPooler = host.includes('pooler');
    const port = isPooler ? 6543 : 5432;
    const user = isPooler ? `postgres.${projectRef}` : 'postgres';
    console.log(`Attempting connection to ${host}:${port}...`);
    const client = new Client({
      host,
      port,
      user,
      password: dbPassword,
      database: 'postgres',
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      const res = await client.query('SELECT version(), current_database(), current_user;');
      console.log('Connection successful!');
      console.log('DB Version:', res.rows[0].version.split(' ')[0] + ' ' + res.rows[0].version.split(' ')[1]);
      console.log('Database:', res.rows[0].current_database);
      console.log('User:', res.rows[0].current_user);
      await client.end();
      return { host, port, user };
    } catch (err) {
      console.log(`Failed connecting to ${host}:${port}:`, err.message);
      try { await client.end(); } catch (e) {}
    }
  }
  throw new Error('All database connection attempts failed');
}

testConnection()
  .then(() => console.log('DB Connection Test Passed.'))
  .catch((err) => {
    console.error('DB Connection Test Failed:', err.message);
    process.exit(1);
  });
