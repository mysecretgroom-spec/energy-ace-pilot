
CREATE TABLE public.ai_credit_topups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount_eur NUMERIC(10,2) NOT NULL CHECK (amount_eur IN (5, 10)),
  amount_remaining_eur NUMERIC(10,4) NOT NULL,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_credit_topups_user_status ON public.ai_credit_topups(user_id, status);
CREATE INDEX idx_ai_credit_topups_stripe_session ON public.ai_credit_topups(stripe_session_id);

ALTER TABLE public.ai_credit_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own topups"
  ON public.ai_credit_topups FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts/updates only (no user-level write policy)

-- Get balance in EUR
CREATE OR REPLACE FUNCTION public.get_user_topup_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount_remaining_eur), 0)::NUMERIC
  FROM public.ai_credit_topups
  WHERE user_id = p_user_id
    AND status = 'paid'
    AND amount_remaining_eur > 0;
$$;

-- Consume balance (FIFO). Amount in EUR. Returns amount actually consumed.
CREATE OR REPLACE FUNCTION public.consume_topup_balance(p_user_id UUID, p_amount_eur NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining NUMERIC := p_amount_eur;
  v_row RECORD;
  v_take NUMERIC;
  v_consumed NUMERIC := 0;
BEGIN
  IF p_amount_eur IS NULL OR p_amount_eur <= 0 THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT id, amount_remaining_eur
    FROM public.ai_credit_topups
    WHERE user_id = p_user_id
      AND status = 'paid'
      AND amount_remaining_eur > 0
    ORDER BY paid_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_row.amount_remaining_eur, v_remaining);
    UPDATE public.ai_credit_topups
      SET amount_remaining_eur = amount_remaining_eur - v_take
      WHERE id = v_row.id;
    v_remaining := v_remaining - v_take;
    v_consumed := v_consumed + v_take;
  END LOOP;

  RETURN v_consumed;
END;
$$;
