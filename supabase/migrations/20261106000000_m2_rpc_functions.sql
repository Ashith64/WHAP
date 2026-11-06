-- ============================================================================
-- WHAP Milestone 2: Backend Business Logic & RPC Functions Migration
-- Features: post_task, nearby_tasks, place_bid, accept_bid, complete_task,
--           cancel_task, resolve_dispute, submit_review, expire_tasks
-- Security: SECURITY DEFINER, search_path = public, extensions
-- Concurrency: Row locking (FOR UPDATE), deadlock prevention, double-entry ledger
-- ============================================================================

SET search_path TO public, extensions;

-- ============================================================================
-- 1. post_task (F09)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.post_task(
  p_title TEXT,
  p_category TEXT,
  p_budget NUMERIC,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_min_budget NUMERIC := 50.00;
  v_max_budget NUMERIC := 300.00;
  v_task public.tasks;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_lat := COALESCE(p_lat, p_latitude);
  v_lng := COALESCE(p_lng, p_longitude);

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Location coordinates (latitude and longitude) are required';
  END IF;

  -- Load operational parameters from config
  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'min_task_budget'), 50.00) INTO v_min_budget;
  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'max_task_budget'), 300.00) INTO v_max_budget;

  IF p_budget < v_min_budget OR p_budget > v_max_budget THEN
    RAISE EXCEPTION 'Task budget must be between Rs % and Rs %', v_min_budget, v_max_budget;
  END IF;

  IF p_category NOT IN ('XEROX_PICKUP', 'BUY_ITEMS', 'CARRY_THINGS', 'QUEUE', 'OTHER') THEN
    RAISE EXCEPTION 'Invalid category: %', p_category;
  END IF;

  INSERT INTO public.tasks (
    requester_id,
    title,
    description,
    category,
    budget,
    location,
    address,
    status,
    version,
    otp_attempts
  ) VALUES (
    v_uid,
    p_title,
    p_description,
    p_category,
    p_budget,
    ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography,
    p_address,
    'OPEN',
    1,
    0
  ) RETURNING * INTO v_task;

  RETURN jsonb_build_object(
    'id', v_task.id,
    'task_id', v_task.id,
    'title', v_task.title,
    'description', v_task.description,
    'category', v_task.category,
    'budget', v_task.budget,
    'status', v_task.status,
    'requester_id', v_task.requester_id,
    'created_at', v_task.created_at
  );
END;
$$;

-- ============================================================================
-- 2. nearby_tasks (F10)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.nearby_tasks(
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_radius_meters DOUBLE PRECISION DEFAULT 1500,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  requester_id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  budget NUMERIC,
  address TEXT,
  distance_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_worker_point GEOGRAPHY;
  v_max_radius DOUBLE PRECISION := 1500.0;
  v_effective_radius DOUBLE PRECISION;
BEGIN
  v_lat := COALESCE(p_lat, p_latitude);
  v_lng := COALESCE(p_lng, p_longitude);

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RAISE EXCEPTION 'Latitude and longitude coordinates are required';
  END IF;

  SELECT COALESCE((SELECT value::double precision FROM public.config WHERE key = 'search_radius_meters'), 1500.0)
    INTO v_max_radius;

  v_effective_radius := LEAST(COALESCE(p_radius_meters, v_max_radius), v_max_radius);
  IF v_effective_radius <= 0 THEN
    v_effective_radius := v_max_radius;
  END IF;

  v_worker_point := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography;

  RETURN QUERY
  SELECT
    t.id,
    t.requester_id,
    t.title,
    t.description,
    t.category,
    t.budget,
    t.address,
    ROUND(ST_Distance(t.location, v_worker_point)::numeric, 2)::double precision AS distance_meters,
    t.created_at
  FROM public.tasks t
  WHERE t.status = 'OPEN'
    AND ST_DWithin(t.location, v_worker_point, v_effective_radius)
  ORDER BY distance_meters ASC;
END;
$$;

-- Partial GiST index on OPEN tasks for optimal spatial pruning
CREATE INDEX IF NOT EXISTS idx_tasks_open_location
  ON public.tasks USING GIST (location)
  WHERE status = 'OPEN';

-- ============================================================================
-- 3. place_bid (F11)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.place_bid(
  p_task_id UUID,
  p_price NUMERIC DEFAULT NULL,
  p_amount NUMERIC DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_message TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_price NUMERIC;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_task public.tasks;
  v_worker_loc GEOGRAPHY;
  v_bid public.bids;
  v_min_bid NUMERIC := 20.00;
  v_max_ratio NUMERIC := 2.0;
  v_radius DOUBLE PRECISION := 1500.0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_price := COALESCE(p_price, p_amount);
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Bid price is required';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status != 'OPEN' THEN
    RAISE EXCEPTION 'Task is not open for bidding';
  END IF;

  IF v_task.requester_id = v_uid THEN
    RAISE EXCEPTION 'Requesters cannot bid on their own tasks';
  END IF;

  v_lat := COALESCE(p_lat, p_latitude);
  v_lng := COALESCE(p_lng, p_longitude);

  IF v_lat IS NOT NULL AND v_lng IS NOT NULL THEN
    v_worker_loc := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography;
  ELSE
    SELECT location INTO v_worker_loc FROM public.profiles WHERE id = v_uid;
  END IF;

  SELECT COALESCE((SELECT value::double precision FROM public.config WHERE key = 'search_radius_meters'), 1500.0) INTO v_radius;
  IF v_worker_loc IS NULL OR NOT ST_DWithin(v_task.location, v_worker_loc, v_radius) THEN
    RAISE EXCEPTION 'Worker is outside the 1.5 km task boundary';
  END IF;

  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'min_bid_price'), 20.00) INTO v_min_bid;
  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'max_bid_ratio'), 2.0) INTO v_max_ratio;

  IF v_price < v_min_bid THEN
    RAISE EXCEPTION 'Bid price must be at least Rs %', v_min_bid;
  END IF;

  IF v_price > (v_task.budget * v_max_ratio) THEN
    RAISE EXCEPTION 'Bid price cannot exceed 2x task budget (max Rs %)', (v_task.budget * v_max_ratio);
  END IF;

  -- Upsert single pending bid per worker per task
  INSERT INTO public.bids (task_id, worker_id, price, status)
  VALUES (p_task_id, v_uid, v_price, 'PENDING')
  ON CONFLICT (task_id, worker_id)
  DO UPDATE SET price = EXCLUDED.price, status = 'PENDING', updated_at = now()
  RETURNING * INTO v_bid;

  RETURN jsonb_build_object(
    'id', v_bid.id,
    'bid_id', v_bid.id,
    'task_id', v_bid.task_id,
    'worker_id', v_bid.worker_id,
    'price', v_bid.price,
    'amount', v_bid.price,
    'status', v_bid.status,
    'created_at', v_bid.created_at
  );
END;
$$;

-- ============================================================================
-- 4. accept_bid (F12) - Concurrency-Safe Pessimistic Row Locking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_bid(
  p_bid_id UUID,
  p_task_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_target_task_id UUID;
  v_task public.tasks;
  v_bid public.bids;
  v_wallet public.wallets;
  v_fee_pct NUMERIC := 0.10;
  v_min_fee NUMERIC := 5.00;
  v_platform_fee NUMERIC;
  v_otp VARCHAR(4);
  v_escrow_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Step 1: Identify target task ID
  IF p_task_id IS NOT NULL THEN
    v_target_task_id := p_task_id;
  ELSE
    SELECT task_id INTO v_target_task_id FROM public.bids WHERE id = p_bid_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Bid not found';
    END IF;
  END IF;

  -- Step 2: Lock Task Row (Level 1 Lock - Global Serializer)
  SELECT * INTO v_task FROM public.tasks WHERE id = v_target_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.requester_id != v_uid THEN
    RAISE EXCEPTION 'Only the task requester can accept bids';
  END IF;

  IF v_task.status != 'OPEN' THEN
    RAISE EXCEPTION 'Task is no longer open (current status: %)', v_task.status;
  END IF;

  -- Step 3: Lock Bid Row (Level 2 Lock)
  SELECT * INTO v_bid FROM public.bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bid not found';
  END IF;

  IF v_bid.task_id != v_target_task_id THEN
    RAISE EXCEPTION 'Bid does not belong to specified task';
  END IF;

  IF v_bid.status != 'PENDING' THEN
    RAISE EXCEPTION 'Bid is not in PENDING status (current: %)', v_bid.status;
  END IF;

  -- Step 4: Lock Requester Wallet Row (Level 3 Lock)
  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Requester wallet not found';
  END IF;

  IF v_wallet.balance < v_bid.price THEN
    RAISE EXCEPTION 'Insufficient wallet balance: current balance is Rs %, but bid is Rs %', v_wallet.balance, v_bid.price;
  END IF;

  -- Step 5: Fee Calculation
  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'platform_fee_percent'), 0.10) INTO v_fee_pct;
  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'min_platform_fee'), 5.00) INTO v_min_fee;
  v_platform_fee := GREATEST(v_min_fee, ROUND(v_bid.price * v_fee_pct, 2));

  -- Step 6: Deduct Requester Wallet
  UPDATE public.wallets
  SET balance = balance - v_bid.price,
      updated_at = now()
  WHERE id = v_wallet.id;

  -- Step 7: Record Audit Ledger Entry
  INSERT INTO public.ledger_entries (wallet_id, type, amount, task_id)
  VALUES (v_wallet.id, 'ESCROW_LOCK', v_bid.price, v_task.id);

  -- Step 8: Create Escrow Transaction
  INSERT INTO public.escrow_transactions (task_id, amount, platform_fee, status)
  VALUES (v_task.id, v_bid.price, v_platform_fee, 'HELD')
  RETURNING id INTO v_escrow_id;

  -- Step 9: Generate 4-digit numeric OTP (1000..9999)
  v_otp := (1000 + floor(random() * 9000))::text;

  -- Step 10: Update Task to ASSIGNED
  UPDATE public.tasks
  SET status = 'ASSIGNED',
      assigned_worker_id = v_bid.worker_id,
      agreed_price = v_bid.price,
      otp_code = v_otp,
      otp_attempts = 0,
      otp_expiry = now() + INTERVAL '2 hours',
      version = version + 1,
      updated_at = now()
  WHERE id = v_task.id;

  -- Step 11: Mark Bid ACCEPTED and reject competing bids
  UPDATE public.bids SET status = 'ACCEPTED', updated_at = now() WHERE id = v_bid.id;
  UPDATE public.bids SET status = 'REJECTED', updated_at = now() WHERE task_id = v_task.id AND id != v_bid.id AND status = 'PENDING';

  -- Step 12: Notify Worker
  INSERT INTO public.notifications (user_id, message)
  VALUES (v_bid.worker_id, 'Your bid of Rs ' || v_bid.price || ' for "' || v_task.title || '" has been accepted!');

  RETURN jsonb_build_object(
    'success', true,
    'status', 'ASSIGNED',
    'task_id', v_task.id,
    'escrow_id', v_escrow_id,
    'agreed_price', v_bid.price,
    'otp_code', v_otp
  );
END;
$$;

-- ============================================================================
-- 5. complete_task (F13) - OTP Verification & Payout Release
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_task(
  p_task_id UUID,
  p_otp_code VARCHAR
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task public.tasks;
  v_escrow public.escrow_transactions;
  v_worker_wallet public.wallets;
  v_payout NUMERIC;
  v_new_attempts INT;
  v_max_attempts INT := 3;
  v_is_admin BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'ADMIN') INTO v_is_admin;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status != 'ASSIGNED' THEN
    RAISE EXCEPTION 'Task cannot be completed in status %', v_task.status;
  END IF;

  IF v_task.assigned_worker_id != v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: only the assigned worker can submit completion OTP';
  END IF;

  IF v_task.otp_expiry IS NOT NULL AND now() > v_task.otp_expiry THEN
    RAISE EXCEPTION 'OTP has expired';
  END IF;

  -- OTP Verification
  IF v_task.otp_code != p_otp_code THEN
    v_new_attempts := v_task.otp_attempts + 1;
    SELECT COALESCE((SELECT value::int FROM public.config WHERE key = 'max_otp_attempts'), 3) INTO v_max_attempts;

    IF v_new_attempts >= v_max_attempts THEN
      UPDATE public.tasks
      SET status = 'DISPUTED',
          otp_attempts = v_new_attempts,
          updated_at = now()
      WHERE id = p_task_id;

      INSERT INTO public.notifications (user_id, message)
      VALUES (v_task.requester_id, 'Task "' || v_task.title || '" has entered DISPUTED status due to 3 failed OTP attempts.');

      INSERT INTO public.notifications (user_id, message)
      VALUES (v_task.assigned_worker_id, 'Task "' || v_task.title || '" has entered DISPUTED status due to 3 failed OTP attempts.');

      PERFORM set_config('response.status', '400', true);
      RETURN jsonb_build_object(
        'error', 'Invalid OTP. 3 failed attempts exceeded. Task is now DISPUTED',
        'message', 'Invalid OTP. 3 failed attempts exceeded. Task is now DISPUTED',
        'status', 'DISPUTED',
        'otp_attempts', v_new_attempts
      );
    ELSE
      UPDATE public.tasks
      SET otp_attempts = v_new_attempts,
          updated_at = now()
      WHERE id = p_task_id;

      PERFORM set_config('response.status', '400', true);
      RETURN jsonb_build_object(
        'error', 'Invalid OTP. Attempt ' || v_new_attempts || ' of ' || v_max_attempts,
        'message', 'Invalid OTP. Attempt ' || v_new_attempts || ' of ' || v_max_attempts,
        'status', 'ASSIGNED',
        'otp_attempts', v_new_attempts
      );
    END IF;
  END IF;

  -- Valid OTP: Lock Escrow and Credit Worker
  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE task_id = p_task_id AND status = 'HELD' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active escrow transaction not found';
  END IF;

  v_payout := v_escrow.amount - v_escrow.platform_fee;

  SELECT * INTO v_worker_wallet FROM public.wallets WHERE user_id = v_task.assigned_worker_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_task.assigned_worker_id, 0.00) RETURNING * INTO v_worker_wallet;
  END IF;

  UPDATE public.wallets
  SET balance = balance + v_payout,
      updated_at = now()
  WHERE id = v_worker_wallet.id;

  INSERT INTO public.ledger_entries (wallet_id, type, amount, task_id)
  VALUES (v_worker_wallet.id, 'PAYOUT', v_payout, p_task_id);

  INSERT INTO public.ledger_entries (wallet_id, type, amount, task_id)
  VALUES (v_worker_wallet.id, 'FEE', v_escrow.platform_fee, p_task_id);

  UPDATE public.escrow_transactions
  SET status = 'RELEASED',
      released_at = now(),
      updated_at = now()
  WHERE id = v_escrow.id;

  UPDATE public.tasks
  SET status = 'COMPLETED',
      completed_at = now(),
      version = version + 1,
      updated_at = now()
  WHERE id = p_task_id;

  INSERT INTO public.notifications (user_id, message)
  VALUES (v_task.requester_id, 'Task "' || v_task.title || '" completed. Escrow released.');

  INSERT INTO public.notifications (user_id, message)
  VALUES (v_task.assigned_worker_id, 'Task "' || v_task.title || '" completed! Rs ' || v_payout || ' credited to your wallet.');

  RETURN jsonb_build_object(
    'success', true,
    'status', 'COMPLETED',
    'payout_amount', v_payout,
    'payout', v_payout,
    'fee_amount', v_escrow.platform_fee,
    'fee', v_escrow.platform_fee
  );
END;
$$;

-- ============================================================================
-- 6. cancel_task (F14) - Cancellation & Escrow Refund
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_task(
  p_task_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task public.tasks;
  v_escrow public.escrow_transactions;
  v_wallet public.wallets;
  v_is_admin BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'ADMIN') INTO v_is_admin;
  IF v_task.requester_id != v_uid AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only the task requester can cancel this task';
  END IF;

  IF v_task.status = 'OPEN' THEN
    UPDATE public.tasks SET status = 'CANCELLED', updated_at = now() WHERE id = p_task_id;
    UPDATE public.bids SET status = 'WITHDRAWN', updated_at = now() WHERE task_id = p_task_id AND status = 'PENDING';

    RETURN jsonb_build_object(
      'success', true,
      'status', 'CANCELLED',
      'refund_amount', 0.00,
      'task_id', p_task_id
    );

  ELSIF v_task.status = 'ASSIGNED' THEN
    SELECT * INTO v_escrow FROM public.escrow_transactions WHERE task_id = p_task_id AND status = 'HELD' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active escrow transaction not found';
    END IF;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_task.requester_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Requester wallet not found';
    END IF;

    UPDATE public.wallets SET balance = balance + v_escrow.amount, updated_at = now() WHERE id = v_wallet.id;

    INSERT INTO public.ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_wallet.id, 'ESCROW_REFUND', v_escrow.amount, p_task_id);

    UPDATE public.escrow_transactions SET status = 'REFUNDED', released_at = now(), updated_at = now() WHERE id = v_escrow.id;
    UPDATE public.tasks SET status = 'CANCELLED', updated_at = now() WHERE id = p_task_id;
    UPDATE public.bids SET status = 'WITHDRAWN', updated_at = now() WHERE task_id = p_task_id AND status = 'PENDING';

    IF v_task.assigned_worker_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, message)
      VALUES (v_task.assigned_worker_id, 'Task "' || v_task.title || '" was cancelled by requester. Full refund issued.');
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'CANCELLED',
      'refund_amount', v_escrow.amount,
      'task_id', p_task_id
    );
  ELSE
    RAISE EXCEPTION 'Task cannot be cancelled in status: %', v_task.status;
  END IF;
END;
$$;

-- ============================================================================
-- 7. resolve_dispute (F15) - Administrator Dispute Resolution
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_task_id UUID,
  p_decision TEXT DEFAULT NULL,
  p_resolution TEXT DEFAULT NULL,
  p_worker_share NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_decision TEXT;
  v_task public.tasks;
  v_escrow public.escrow_transactions;
  v_wallet public.wallets;
  v_payout NUMERIC;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Unauthorized: Administrator access required';
  END IF;

  v_decision := UPPER(COALESCE(p_decision, p_resolution));
  IF v_decision IS NULL THEN
    RAISE EXCEPTION 'Dispute decision is required (REFUND_REQUESTER or PAY_WORKER)';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status != 'DISPUTED' THEN
    RAISE EXCEPTION 'Task is not in DISPUTED status (current: %)', v_task.status;
  END IF;

  SELECT * INTO v_escrow FROM public.escrow_transactions WHERE task_id = p_task_id AND status = 'HELD' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active escrow transaction not found';
  END IF;

  IF v_decision = 'REFUND_REQUESTER' THEN
    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_task.requester_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Requester wallet not found';
    END IF;

    UPDATE public.wallets SET balance = balance + v_escrow.amount, updated_at = now() WHERE id = v_wallet.id;

    INSERT INTO public.ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_wallet.id, 'ESCROW_REFUND', v_escrow.amount, p_task_id);

    UPDATE public.escrow_transactions SET status = 'REFUNDED', released_at = now(), updated_at = now() WHERE id = v_escrow.id;
    UPDATE public.tasks SET status = 'CANCELLED', updated_at = now() WHERE id = p_task_id;

    INSERT INTO public.notifications (user_id, message)
    VALUES (v_task.requester_id, 'Dispute resolved: Rs ' || v_escrow.amount || ' refunded to your wallet.');

    IF v_task.assigned_worker_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, message)
      VALUES (v_task.assigned_worker_id, 'Dispute resolved in favor of requester.');
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'decision', v_decision,
      'status', 'CANCELLED',
      'escrow_status', 'REFUNDED'
    );

  ELSIF v_decision = 'PAY_WORKER' THEN
    v_payout := v_escrow.amount - v_escrow.platform_fee;

    SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_task.assigned_worker_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.wallets (user_id, balance) VALUES (v_task.assigned_worker_id, 0.00) RETURNING * INTO v_wallet;
    END IF;

    UPDATE public.wallets SET balance = balance + v_payout, updated_at = now() WHERE id = v_wallet.id;

    INSERT INTO public.ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_wallet.id, 'PAYOUT', v_payout, p_task_id);

    INSERT INTO public.ledger_entries (wallet_id, type, amount, task_id)
    VALUES (v_wallet.id, 'FEE', v_escrow.platform_fee, p_task_id);

    UPDATE public.escrow_transactions SET status = 'RELEASED', released_at = now(), updated_at = now() WHERE id = v_escrow.id;
    UPDATE public.tasks SET status = 'COMPLETED', completed_at = now(), updated_at = now() WHERE id = p_task_id;

    IF v_task.assigned_worker_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, message)
      VALUES (v_task.assigned_worker_id, 'Dispute resolved: Rs ' || v_payout || ' payout released.');
    END IF;

    INSERT INTO public.notifications (user_id, message)
    VALUES (v_task.requester_id, 'Dispute resolved in favor of worker.');

    RETURN jsonb_build_object(
      'success', true,
      'decision', v_decision,
      'status', 'COMPLETED',
      'escrow_status', 'RELEASED',
      'payout', v_payout
    );
  ELSE
    RAISE EXCEPTION 'Invalid dispute decision: %', v_decision;
  END IF;
END;
$$;

-- ============================================================================
-- 8. submit_review (F16) - Double-Blind Mechanics & Profile Rating Aggregation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.submit_review(
  p_task_id UUID,
  p_rating INTEGER,
  p_comment TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_task public.tasks;
  v_reviewee_id UUID;
  v_review public.reviews;
  v_both_submitted BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be an integer between 1 and 5';
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  IF v_task.status != 'COMPLETED' THEN
    RAISE EXCEPTION 'Reviews can only be submitted after task completion';
  END IF;

  IF v_uid = v_task.requester_id THEN
    v_reviewee_id := v_task.assigned_worker_id;
  ELSIF v_uid = v_task.assigned_worker_id THEN
    v_reviewee_id := v_task.requester_id;
  ELSE
    RAISE EXCEPTION 'Unauthorized: only task participants can submit reviews';
  END IF;

  IF v_reviewee_id IS NULL THEN
    RAISE EXCEPTION 'Task counterpart not assigned';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reviews WHERE task_id = p_task_id AND reviewer_id = v_uid) THEN
    RAISE EXCEPTION 'You have already submitted a review for this task';
  END IF;

  -- Check if counterpart review already exists
  SELECT EXISTS (
    SELECT 1 FROM public.reviews WHERE task_id = p_task_id AND reviewer_id = v_reviewee_id
  ) INTO v_both_submitted;

  INSERT INTO public.reviews (
    task_id,
    reviewer_id,
    reviewee_id,
    rating,
    comment,
    visible
  ) VALUES (
    p_task_id,
    v_uid,
    v_reviewee_id,
    p_rating,
    p_comment,
    v_both_submitted
  ) RETURNING * INTO v_review;

  IF v_both_submitted THEN
    -- Reveal both reviews
    UPDATE public.reviews SET visible = true WHERE task_id = p_task_id;

    -- Update reviewee profile rating
    UPDATE public.profiles
    SET rating_count = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = v_reviewee_id AND visible = true),
        rating_average = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE reviewee_id = v_reviewee_id AND visible = true), 0.00)
    WHERE id = v_reviewee_id;

    -- Update reviewer profile rating
    UPDATE public.profiles
    SET rating_count = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_id = v_uid AND visible = true),
        rating_average = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.reviews WHERE reviewee_id = v_uid AND visible = true), 0.00)
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'id', v_review.id,
    'review_id', v_review.id,
    'task_id', v_review.task_id,
    'rating', v_review.rating,
    'comment', v_review.comment,
    'visible', v_both_submitted,
    'is_revealed', v_both_submitted
  );
END;
$$;

-- ============================================================================
-- 9. expire_tasks (F17) - Task Expiration & Review Auto-Reveal
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_tasks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_expired_count INT := 0;
  v_revealed_count INT := 0;
  v_exp_minutes INT := 30;
  v_reveal_days INT := 7;
BEGIN
  SELECT COALESCE((SELECT value::int FROM public.config WHERE key = 'task_expiration_minutes'), 30) INTO v_exp_minutes;
  SELECT COALESCE((SELECT value::int FROM public.config WHERE key = 'review_auto_reveal_days'), 7) INTO v_reveal_days;

  -- Step 1: Expire stale OPEN tasks
  WITH expired AS (
    UPDATE public.tasks
    SET status = 'EXPIRED',
        updated_at = now()
    WHERE status = 'OPEN'
      AND created_at < (now() - (v_exp_minutes || ' minutes')::INTERVAL)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired_count FROM expired;

  -- Step 2: Withdraw bids on expired tasks
  UPDATE public.bids
  SET status = 'WITHDRAWN',
      updated_at = now()
  WHERE status = 'PENDING'
    AND task_id IN (SELECT id FROM public.tasks WHERE status = 'EXPIRED');

  -- Step 3: Auto-reveal reviews older than 7 days
  WITH revealed AS (
    UPDATE public.reviews
    SET visible = true
    WHERE visible = false
      AND created_at < (now() - (v_reveal_days || ' days')::INTERVAL)
    RETURNING reviewee_id
  )
  SELECT COUNT(*) INTO v_revealed_count FROM revealed;

  -- Step 4: Recalculate profile ratings if reviews revealed
  IF v_revealed_count > 0 THEN
    UPDATE public.profiles p
    SET rating_count = r.cnt,
        rating_average = r.avg_rat
    FROM (
      SELECT reviewee_id, COUNT(*) AS cnt, ROUND(AVG(rating)::numeric, 2) AS avg_rat
      FROM public.reviews
      WHERE visible = true
      GROUP BY reviewee_id
    ) r
    WHERE p.id = r.reviewee_id;
  END IF;

  RETURN jsonb_build_object(
    'expired_count', v_expired_count,
    'expired_tasks', v_expired_count,
    'revealed_reviews', v_revealed_count
  );
END;
$$;

-- ============================================================================
-- Grant Permissions to authenticated and anon roles
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.post_task TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_tasks TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_bid TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_bid TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_task TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_task TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_tasks TO anon, authenticated, service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
