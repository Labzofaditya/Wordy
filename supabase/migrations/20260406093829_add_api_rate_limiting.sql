/*
  # API Rate Limiting

  ## Summary
  Adds per-user API usage tracking and a rate-limiting RPC used by Edge Functions.

  ## New Tables
  - `api_usage`
    - user_id (uuid, fk → auth.users)
    - endpoint (text) — identifies which edge function was called
    - created_at (timestamptz) — used for sliding-window rate checks

  ## New Functions
  - `check_and_log_api_usage(p_endpoint, p_minute_limit, p_day_limit)`
    - Counts requests in the last 60 seconds and last 24 hours for the authenticated user
    - If under both limits: inserts a usage row and returns {allowed: true}
    - If over either limit: returns {allowed: false, retry_after: N}
    - Called by Edge Functions after JWT validation
    - SECURITY DEFINER — bypasses RLS to read/write api_usage for auth.uid()

  ## Security
  - RLS enabled on api_usage
  - No direct-access policies — only the SECURITY DEFINER RPC can touch the table
  - Execute revoked from PUBLIC, granted to authenticated

  ## Notes
  - Sliding-window approach; small race window exists at very high concurrency (acceptable for beta)
  - Records older than 25 hours are not queried; scheduled cleanup can be added via pg_cron
*/

-- ============================================================
-- api_usage table
-- ============================================================
CREATE TABLE IF NOT EXISTS api_usage (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- No direct-access policies: only the SECURITY DEFINER function may read/write
CREATE INDEX IF NOT EXISTS idx_api_usage_user_endpoint_time
  ON api_usage(user_id, endpoint, created_at DESC);

-- ============================================================
-- check_and_log_api_usage RPC
-- ============================================================
CREATE OR REPLACE FUNCTION check_and_log_api_usage(
  p_endpoint     text,
  p_minute_limit integer DEFAULT 20,
  p_day_limit    integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid         uuid;
  v_minute_count integer;
  v_day_count    integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COUNT(*) INTO v_minute_count
  FROM api_usage
  WHERE user_id  = v_uid
    AND endpoint = p_endpoint
    AND created_at > now() - interval '1 minute';

  IF v_minute_count >= p_minute_limit THEN
    RETURN jsonb_build_object(
      'allowed',      false,
      'reason',       'per_minute_limit',
      'retry_after',  60
    );
  END IF;

  SELECT COUNT(*) INTO v_day_count
  FROM api_usage
  WHERE user_id  = v_uid
    AND endpoint = p_endpoint
    AND created_at > now() - interval '24 hours';

  IF v_day_count >= p_day_limit THEN
    RETURN jsonb_build_object(
      'allowed',      false,
      'reason',       'per_day_limit',
      'retry_after',  86400
    );
  END IF;

  INSERT INTO api_usage (user_id, endpoint)
  VALUES (v_uid, p_endpoint);

  RETURN jsonb_build_object(
    'allowed',      true,
    'minute_count', v_minute_count + 1,
    'day_count',    v_day_count + 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION check_and_log_api_usage(text, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_and_log_api_usage(text, integer, integer) TO authenticated;
