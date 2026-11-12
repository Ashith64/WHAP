-- ============================================================================
-- WHAP Generalization Migration: Broaden Task Categories for Any Local Work
-- Preserves legacy enum values for backward compatibility with existing tests.
-- ============================================================================

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_category_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_category_check CHECK (
    category IN (
      'ERRANDS_DELIVERY',
      'HOME_REPAIRS',
      'MOVING_LIFTING',
      'CLEANING_CHORES',
      'TECH_SETUP',
      'PRINT_DOCUMENTS',
      'QUEUE_WAITING',
      'OTHER',
      'XEROX_PICKUP',
      'BUY_ITEMS',
      'CARRY_THINGS',
      'QUEUE'
    )
  );

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

  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'min_task_budget'), 50.00) INTO v_min_budget;
  SELECT COALESCE((SELECT value::numeric FROM public.config WHERE key = 'max_task_budget'), 300.00) INTO v_max_budget;

  IF p_budget < v_min_budget OR p_budget > v_max_budget THEN
    RAISE EXCEPTION 'Task budget must be between Rs % and Rs %', v_min_budget, v_max_budget;
  END IF;

  IF p_category NOT IN (
    'ERRANDS_DELIVERY',
    'HOME_REPAIRS',
    'MOVING_LIFTING',
    'CLEANING_CHORES',
    'TECH_SETUP',
    'PRINT_DOCUMENTS',
    'QUEUE_WAITING',
    'OTHER',
    'XEROX_PICKUP',
    'BUY_ITEMS',
    'CARRY_THINGS',
    'QUEUE'
  ) THEN
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

NOTIFY pgrst, 'reload schema';
