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
      const client = new Client({
        host: c.host,
        port: c.port,
        user: c.user,
        password: dbPassword,
        database: 'postgres',
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      console.log(`Connected to PostgreSQL via ${c.host}:${c.port}`);
      return client;
    } catch (e) {
      console.log(`Failed connecting via ${c.host}:${c.port}: ${e.message}`);
    }
  }
  throw new Error('Could not connect to PostgreSQL');
}

async function main() {
  const client = await getConnectedClient();

  const remediationSql = `
    -- 1. Recreate public.tasks_view WITH (security_invoker = true)
    CREATE OR REPLACE VIEW public.tasks_view
    WITH (security_invoker = true) AS
    SELECT
      id,
      requester_id,
      title,
      description,
      category,
      budget,
      location,
      address,
      status,
      assigned_worker_id,
      agreed_price,
      CASE
        WHEN requester_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN otp_code
        ELSE NULL
      END AS otp_code,
      otp_attempts,
      otp_expiry,
      version,
      created_at,
      completed_at,
      updated_at
    FROM public.tasks;

    -- Grant permissions on tasks_view
    GRANT SELECT ON public.tasks_view TO anon, authenticated;

    -- 2. Update tasks_select_policy to include assigned_worker_id = auth.uid()
    DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
    CREATE POLICY "tasks_select_policy" ON public.tasks
      FOR SELECT TO authenticated
      USING (
        -- 1. Requester can see their own tasks anywhere
        requester_id = auth.uid()
        OR
        -- 2. Assigned worker can see their assigned task anywhere
        assigned_worker_id = auth.uid()
        OR
        -- 3. Admin can see all tasks
        EXISTS (
          SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'
        )
        OR
        -- 4. Workers can see OPEN tasks ONLY if within 1500 meters of their profile location
        (
          status = 'OPEN' AND
          EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.location IS NOT NULL
              AND ST_DWithin(tasks.location, profiles.location, 1500)
          )
        )
      );

    -- Reload PostgREST schema cache
    NOTIFY pgrst, 'reload schema';
  `;

  console.log('Applying Milestone 1 remediation SQL...');
  await client.query(remediationSql);
  console.log('Remediation SQL applied successfully.');

  await client.end();
}

main().catch(err => {
  console.error('Remediation failed:', err);
  process.exit(1);
});
