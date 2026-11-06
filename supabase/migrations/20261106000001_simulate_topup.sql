-- Migration: 20261106000001_simulate_topup.sql
-- Enables simulated top-up and withdrawal for demo / prototype testing within RLS boundaries

CREATE OR REPLACE FUNCTION public.simulate_topup(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_wallet public.wallets;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 OR p_amount > 5000 THEN
    RAISE EXCEPTION 'Top-up amount must be between Rs 1 and Rs 5000';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance)
    VALUES (v_uid, p_amount)
    RETURNING * INTO v_wallet;
  ELSE
    UPDATE public.wallets
    SET balance = balance + p_amount,
        updated_at = now()
    WHERE id = v_wallet.id
    RETURNING * INTO v_wallet;
  END IF;

  INSERT INTO public.ledger_entries (wallet_id, type, amount)
  VALUES (v_wallet.id, 'TOPUP', p_amount);

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet.id,
    'balance', v_wallet.balance,
    'new_balance', v_wallet.balance,
    'topup_amount', p_amount
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.simulate_withdraw(p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_wallet public.wallets;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Withdrawal amount must be greater than zero';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for withdrawal';
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = v_wallet.id
  RETURNING * INTO v_wallet;

  INSERT INTO public.ledger_entries (wallet_id, type, amount)
  VALUES (v_wallet.id, 'FEE', -p_amount);

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet.id,
    'balance', v_wallet.balance,
    'new_balance', v_wallet.balance,
    'withdraw_amount', p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.simulate_topup(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_withdraw(NUMERIC) TO authenticated;
NOTIFY pgrst, 'reload schema';
