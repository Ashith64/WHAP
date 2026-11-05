-- ============================================================================
-- WHAP Milestone 1: Campus Seed Data
-- 2 Requesters, 4 Workers, 1 Admin, Funded Wallets, 8 Tasks (6 inside 1.5km, 2 outside)
-- Reference Campus: IISc Bangalore (13.0184 N, 77.5684 E)
-- ============================================================================

-- Ensure extensions and config are present
SET search_path TO public, extensions;

-- Seed Default Config Values
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

-- Note: User identities are managed by Supabase GoTrue Auth (auth.users).
-- The script scripts/run_migrations.js creates the users via the Supabase Admin API
-- and populates public.profiles and public.wallets with the exact campus coordinates.
