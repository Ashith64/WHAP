-- ============================================================================
-- WHAP Milestone 1: Initial Schema Migration
-- Database: PostgreSQL with PostGIS Extension
-- Features: 9 Tables, CHECK Constraints, Spatial GiST & FK Indexes, RLS, Config Constants
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Ensure public schema can use postgis operators and functions
SET search_path TO public, extensions;

-- 2. Drop Existing Objects (Clean Re-runnable Migration)
DROP VIEW IF EXISTS public.tasks_view CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.ledger_entries CASCADE;
DROP TABLE IF EXISTS public.escrow_transactions CASCADE;
DROP TABLE IF EXISTS public.bids CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.wallets CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.config CASCADE;

-- ----------------------------------------------------------------------------
-- Table 1: profiles
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('REQUESTER', 'WORKER', 'ADMIN')),
  location GEOGRAPHY(Point, 4326) NULL,
  rating_average NUMERIC(3, 2) NOT NULL DEFAULT 0.00 CHECK (rating_average >= 0.00 AND rating_average <= 5.00),
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- Table 2: wallets
-- ----------------------------------------------------------------------------
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0.00),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- Table 3: tasks
-- ----------------------------------------------------------------------------
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('XEROX_PICKUP', 'BUY_ITEMS', 'CARRY_THINGS', 'QUEUE', 'OTHER')),
  budget NUMERIC(10, 2) NOT NULL CHECK (budget >= 50.00 AND budget <= 300.00),
  location GEOGRAPHY(Point, 4326) NOT NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED')),
  assigned_worker_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  agreed_price NUMERIC(10, 2) NULL CHECK (agreed_price IS NULL OR agreed_price >= 20.00),
  otp_code VARCHAR(4) NULL,
  otp_attempts INTEGER NOT NULL DEFAULT 0 CHECK (otp_attempts >= 0),
  otp_expiry TIMESTAMPTZ NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- Table 4: bids
-- ----------------------------------------------------------------------------
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 20.00),
  amount NUMERIC(10, 2) GENERATED ALWAYS AS (price) STORED,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_bids_task_worker UNIQUE(task_id, worker_id)
);

-- ----------------------------------------------------------------------------
-- Table 5: escrow_transactions
-- ----------------------------------------------------------------------------
CREATE TABLE public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0.00),
  platform_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (platform_fee >= 0.00),
  status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'RELEASED', 'REFUNDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  released_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- Table 6: ledger_entries
-- ----------------------------------------------------------------------------
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('TOPUP', 'ESCROW_LOCK', 'ESCROW_REFUND', 'PAYOUT', 'FEE')),
  amount NUMERIC(10, 2) NOT NULL,
  task_id UUID NULL REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- Table 7: reviews
-- ----------------------------------------------------------------------------
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_reviews_task_reviewer UNIQUE(task_id, reviewer_id)
);

-- ----------------------------------------------------------------------------
-- Table 8: notifications
-- ----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ----------------------------------------------------------------------------
-- Table 9: config
-- ----------------------------------------------------------------------------
CREATE TABLE public.config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. Indexes (Spatial GiST, Foreign Keys, Status Columns)
-- ============================================================================

-- Spatial GiST Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_location ON public.tasks USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles USING GIST (location);

-- Foreign Key Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_requester_id ON public.tasks(requester_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_worker_id ON public.tasks(assigned_worker_id);
CREATE INDEX IF NOT EXISTS idx_bids_task_id ON public.bids(task_id);
CREATE INDEX IF NOT EXISTS idx_bids_worker_id ON public.bids(worker_id);
CREATE INDEX IF NOT EXISTS idx_escrow_task_id ON public.escrow_transactions(task_id);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id ON public.ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_task_id ON public.ledger_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_reviews_task_id ON public.reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Status Column Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_bids_status ON public.bids(status);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON public.escrow_transactions(status);

-- ============================================================================
-- 4. Default Operational Constants in config
-- ============================================================================
INSERT INTO public.config (key, value, description) VALUES
  ('search_radius_meters', '1500', 'Maximum visibility and bidding radius in meters (1.5 km)'),
  ('min_task_budget', '50.00', 'Minimum task budget allowed in Rupees'),
  ('max_task_budget', '300.00', 'Maximum task budget allowed in Rupees'),
  ('min_bid_price', '20.00', 'Minimum worker bid price in Rupees'),
  ('max_bid_ratio', '2.0', 'Maximum allowed multiplier on task budget for a bid'),
  ('platform_fee_percent', '0.10', 'Platform commission percentage (10%) deducted from worker payout'),
  ('min_platform_fee', '5.00', 'Minimum platform fee in Rupees'),
  ('bidding_window_minutes', '3', 'Active bidding window duration'),
  ('task_expiration_minutes', '30', 'Inactivity duration before an open task expires'),
  ('otp_validity_hours', '2', 'Duration for which completion OTP remains valid'),
  ('max_otp_attempts', '3', 'Failed OTP attempts threshold triggering DISPUTED status'),
  ('max_open_tasks_per_requester', '3', 'Maximum simultaneous open tasks per requester'),
  ('max_active_jobs_per_worker', '1', 'Maximum simultaneous active jobs per worker'),
  ('initial_requester_balance', '500.00', 'Demo initial balance granted to new requester wallets'),
  ('review_auto_reveal_days', '7', 'Days before a pending double-blind review is automatically revealed')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();

-- ============================================================================
-- 5. Helper Functions & Triggers
-- ============================================================================

-- Auto-provision profile and wallet on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
  v_balance NUMERIC(12, 2);
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'REQUESTER');
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  
  IF v_role = 'REQUESTER' THEN
    v_balance := 500.00;
  ELSE
    v_balance := 0.00;
  END IF;

  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, v_name, v_role)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, v_balance)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_balance > 0.00 THEN
    INSERT INTO public.ledger_entries (wallet_id, type, amount)
    SELECT id, 'TOPUP', v_balance FROM public.wallets WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Secure OTP retrieval function: ONLY the task's requester or Admin can read OTP
CREATE OR REPLACE FUNCTION public.get_task_otp(p_task_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_otp TEXT;
  v_requester UUID;
  v_caller UUID := auth.uid();
  v_is_admin BOOLEAN := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT requester_id, otp_code INTO v_requester, v_otp FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_caller AND role = 'ADMIN') INTO v_is_admin;

  IF v_requester = v_caller OR v_is_admin THEN
    RETURN v_otp;
  ELSE
    RAISE EXCEPTION 'Unauthorized: only the task requester can access the completion OTP';
  END IF;
END;
$$;

-- Secure View: tasks_view (masks otp_code to NULL for workers / non-requesters)
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

-- ============================================================================
-- 6. Row Level Security (RLS) on all 9 Tables
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS: profiles
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ----------------------------------------------------------------------------
-- RLS: wallets (Direct Client Write Denied)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- NO INSERT / UPDATE / DELETE policies for clients -> All direct mutations denied!

-- ----------------------------------------------------------------------------
-- RLS: ledger_entries (Direct Client Write Denied)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "ledger_select_own" ON public.ledger_entries;
CREATE POLICY "ledger_select_own" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- NO INSERT / UPDATE / DELETE policies for clients -> All direct mutations denied!

-- ----------------------------------------------------------------------------
-- RLS: escrow_transactions (Direct Client Write Denied)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "escrow_select_participants" ON public.escrow_transactions;
CREATE POLICY "escrow_select_participants" ON public.escrow_transactions
  FOR SELECT TO authenticated
  USING (
    task_id IN (SELECT id FROM public.tasks WHERE requester_id = auth.uid() OR assigned_worker_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

-- NO INSERT / UPDATE / DELETE policies for clients -> All direct mutations denied!

-- ----------------------------------------------------------------------------
-- RLS: tasks (Spatial Isolation 1.5km & OTP Secrecy)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    -- 1. Requester can see their own tasks anywhere
    requester_id = auth.uid()
    OR
    -- 2. Assigned worker can see their assigned tasks anywhere
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

DROP POLICY IF EXISTS "tasks_insert_requester" ON public.tasks;
CREATE POLICY "tasks_insert_requester" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "tasks_update_requester" ON public.tasks;
CREATE POLICY "tasks_update_requester" ON public.tasks
  FOR UPDATE TO authenticated
  USING (requester_id = auth.uid() AND status = 'OPEN')
  WITH CHECK (requester_id = auth.uid() AND status = 'OPEN');

DROP POLICY IF EXISTS "tasks_delete_requester" ON public.tasks;
CREATE POLICY "tasks_delete_requester" ON public.tasks
  FOR DELETE TO authenticated
  USING (requester_id = auth.uid() AND status = 'OPEN');

-- ----------------------------------------------------------------------------
-- RLS: bids
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "bids_select_policy" ON public.bids;
CREATE POLICY "bids_select_policy" ON public.bids
  FOR SELECT TO authenticated
  USING (
    worker_id = auth.uid()
    OR task_id IN (SELECT id FROM public.tasks WHERE requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

DROP POLICY IF EXISTS "bids_insert_worker" ON public.bids;
CREATE POLICY "bids_insert_worker" ON public.bids
  FOR INSERT TO authenticated
  WITH CHECK (worker_id = auth.uid());

DROP POLICY IF EXISTS "bids_update_worker" ON public.bids;
CREATE POLICY "bids_update_worker" ON public.bids
  FOR UPDATE TO authenticated
  USING (worker_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (worker_id = auth.uid() AND status = 'PENDING');

DROP POLICY IF EXISTS "bids_delete_worker" ON public.bids;
CREATE POLICY "bids_delete_worker" ON public.bids
  FOR DELETE TO authenticated
  USING (worker_id = auth.uid() AND status = 'PENDING');

-- ----------------------------------------------------------------------------
-- RLS: reviews (Double-Blind Mechanism)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "reviews_select_policy" ON public.reviews;
CREATE POLICY "reviews_select_policy" ON public.reviews
  FOR SELECT TO authenticated
  USING (
    visible = true
    OR reviewer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
  );

DROP POLICY IF EXISTS "reviews_insert_participant" ON public.reviews;
CREATE POLICY "reviews_insert_participant" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: notifications
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;
CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "notifications_update_recipient" ON public.notifications;
CREATE POLICY "notifications_update_recipient" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- RLS: config
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "config_select_all" ON public.config;
CREATE POLICY "config_select_all" ON public.config
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "config_admin_write" ON public.config;
CREATE POLICY "config_admin_write" ON public.config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- ============================================================================
-- 7. Grant Permissions to authenticated and anon roles
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
