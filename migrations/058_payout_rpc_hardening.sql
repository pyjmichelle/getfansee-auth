-- Migration 058: Harden 056 payout RPCs
-- 1) increment_wallet_available must only credit (reject <= 0)
-- 2) Explicit REVOKE from anon/authenticated — REVOKE FROM PUBLIC does not
--    drop default-ACL grants that Supabase still gives those roles.

CREATE OR REPLACE FUNCTION public.increment_wallet_available(
  p_user_id UUID,
  p_cents   BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  IF p_cents IS NULL OR p_cents <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  INSERT INTO public.wallet_accounts (user_id, available_balance_cents, pending_balance_cents)
  VALUES (p_user_id, p_cents, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET available_balance_cents = public.wallet_accounts.available_balance_cents + EXCLUDED.available_balance_cents,
        updated_at = timezone('utc', now())
  RETURNING available_balance_cents INTO v_balance;

  RETURN json_build_object('success', true, 'balance_cents', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_wallet_available(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_wallet_available(UUID, BIGINT) TO service_role;

REVOKE ALL ON FUNCTION public.request_withdrawal(UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, UUID, BIGINT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.decide_withdrawal(UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_withdrawal(UUID, TEXT, TEXT, TEXT, UUID) TO service_role;
