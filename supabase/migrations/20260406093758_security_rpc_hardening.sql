/*
  # Security: RPC Hardening

  ## Summary
  Hardens all RPC functions to prevent cross-user data access and privilege escalation.

  ## Changes

  ### get_review_words
  - REMOVES p_user_id parameter — caller can no longer impersonate another user
  - Uses auth.uid() exclusively for all user filtering
  - Raises exception if called without a valid authenticated session
  - Drops the old overload that accepted p_user_id (uuid)

  ### get_words_with_progress
  - Adds auth.uid() IS NULL guard — unauthenticated callers receive an exception
  - No functional change otherwise (already used auth.uid())

  ### get_dashboard_stats
  - Adds auth.uid() IS NULL guard

  ### get_or_create_settings
  - Adds auth.uid() IS NULL guard

  ## Permission Model
  All functions:
  - REVOKE EXECUTE FROM PUBLIC (blocks anon + unauthenticated callers at DB level)
  - GRANT EXECUTE TO authenticated (Supabase authenticated role only)

  This adds defense-in-depth on top of RLS: even if RLS is misconfigured,
  unauthenticated callers cannot invoke these functions.

  ## Security Notes
  1. auth.uid() reads JWT claims injected by Supabase/PostgREST — safe in SECURITY DEFINER
  2. SECURITY DEFINER is kept so the function owner's permissions are used for joins,
     but the caller identity is still validated via auth.uid()
  3. All user-scoped WHERE clauses use auth.uid() — no client-supplied user_id accepted
*/

-- ============================================================
-- Drop old get_review_words overload that accepted p_user_id
-- (signature: uuid, integer, text)
-- ============================================================
DROP FUNCTION IF EXISTS get_review_words(uuid, integer, text);

-- ============================================================
-- get_review_words: auth.uid() only, no p_user_id
-- ============================================================
CREATE OR REPLACE FUNCTION get_review_words(
  p_limit      integer DEFAULT 20,
  p_book_title text    DEFAULT NULL
)
RETURNS TABLE (
  word_id             uuid,
  word                text,
  stem                text,
  meaning             text,
  etymology           text,
  usage_example       text,
  book_title          text,
  word_created_at     timestamptz,
  word_updated_at     timestamptz,
  progress_id         uuid,
  stability           numeric,
  difficulty          numeric,
  state               text,
  reps                integer,
  lapses              integer,
  next_review         timestamptz,
  last_reviewed       timestamptz,
  mastered            boolean,
  progress_created_at timestamptz,
  progress_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH due_words AS (
    SELECT w.id AS wid
    FROM words w
    LEFT JOIN books b  ON b.id = w.book_id
    LEFT JOIN learning_progress lp ON lp.word_id = w.id AND lp.user_id = v_uid
    WHERE w.user_id = v_uid
      AND (p_book_title IS NULL OR b.title = lower(p_book_title))
      AND (lp.id IS NULL OR (lp.next_review <= now() AND lp.mastered = false))
    ORDER BY
      CASE WHEN lp.id IS NULL THEN 0 ELSE 1 END,
      lp.next_review ASC NULLS LAST
    LIMIT p_limit
  )
  SELECT
    w.id,
    w.word,
    w.stem,
    w.meaning,
    w.etymology,
    w.usage_example,
    b.title         AS book_title,
    w.created_at,
    w.updated_at,
    lp.id,
    lp.stability,
    lp.difficulty,
    lp.state,
    lp.reps,
    lp.lapses,
    lp.next_review,
    lp.last_reviewed,
    lp.mastered,
    lp.created_at,
    lp.updated_at
  FROM due_words dw
  JOIN words w ON w.id = dw.wid
  LEFT JOIN books b  ON b.id = w.book_id
  LEFT JOIN learning_progress lp ON lp.word_id = w.id AND lp.user_id = v_uid;
END;
$$;

-- ============================================================
-- get_words_with_progress: add auth guard
-- ============================================================
CREATE OR REPLACE FUNCTION get_words_with_progress(
  p_limit  integer DEFAULT 5000,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id                  uuid,
  user_id             uuid,
  word                text,
  stem                text,
  meaning             text,
  etymology           text,
  usage_example       text,
  book_title          text,
  created_at          timestamptz,
  updated_at          timestamptz,
  progress_id         uuid,
  stability           numeric,
  difficulty          numeric,
  state               text,
  reps                integer,
  lapses              integer,
  next_review         timestamptz,
  last_reviewed       timestamptz,
  mastered            boolean,
  progress_created_at timestamptz,
  progress_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.user_id,
    w.word,
    w.stem,
    w.meaning,
    w.etymology,
    w.usage_example,
    b.title          AS book_title,
    w.created_at,
    w.updated_at,
    lp.id            AS progress_id,
    lp.stability,
    lp.difficulty,
    lp.state,
    lp.reps,
    lp.lapses,
    lp.next_review,
    lp.last_reviewed,
    lp.mastered,
    lp.created_at    AS progress_created_at,
    lp.updated_at    AS progress_updated_at
  FROM words w
  LEFT JOIN books b  ON b.id = w.book_id
  LEFT JOIN learning_progress lp ON lp.word_id = w.id AND lp.user_id = v_uid
  WHERE w.user_id = v_uid
  ORDER BY w.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================
-- get_dashboard_stats: add auth guard
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_words       bigint,
  mastered_words    bigint,
  in_progress_words bigint,
  new_words         bigint,
  due_for_review    bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(w.id)                                                                  AS total_words,
    COUNT(CASE WHEN lp.mastered = true                                THEN 1 END) AS mastered_words,
    COUNT(CASE WHEN lp.id IS NOT NULL AND lp.mastered = false         THEN 1 END) AS in_progress_words,
    COUNT(CASE WHEN lp.id IS NULL                                     THEN 1 END) AS new_words,
    COUNT(CASE WHEN lp.id IS NULL
               OR  (lp.mastered = false AND lp.next_review <= now())  THEN 1 END) AS due_for_review
  FROM words w
  LEFT JOIN learning_progress lp ON lp.word_id = w.id AND lp.user_id = v_uid
  WHERE w.user_id = v_uid;
END;
$$;

-- ============================================================
-- get_or_create_settings: add auth guard
-- ============================================================
CREATE OR REPLACE FUNCTION get_or_create_settings()
RETURNS SETOF user_settings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO user_settings (user_id, pronunciation_accent, show_book_title)
  VALUES (v_uid, 'american', false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT * FROM user_settings WHERE user_id = v_uid;
END;
$$;

-- ============================================================
-- Lock down execute permissions on all RPCs
-- Revoke from PUBLIC (includes anon role), grant to authenticated only
-- ============================================================
REVOKE EXECUTE ON FUNCTION get_review_words(integer, text)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_words_with_progress(integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_dashboard_stats()                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_or_create_settings()                FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_review_words(integer, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION get_words_with_progress(integer, integer)  TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats()                     TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_settings()                  TO authenticated;
