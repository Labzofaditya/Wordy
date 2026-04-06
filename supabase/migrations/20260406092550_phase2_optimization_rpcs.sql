/*
  # Phase 2: Query Optimization RPCs

  ## Summary
  Adds server-side RPC functions that collapse multiple round-trips into single calls.

  ## New Functions

  ### get_words_with_progress(p_limit, p_offset)
  - Replaces the 2-loop client approach (words query + progress query)
  - Returns words joined with learning_progress and books in ONE query
  - Returns book_title from the books join for backward compatibility
  - Filtered by auth.uid() — no user_id parameter needed

  ### get_dashboard_stats()
  - Replaces 4 separate COUNT queries on dashboard load
  - Returns total_words, mastered_words, in_progress_words, new_words, due_for_review
  - Single aggregated query using conditional COUNT

  ### get_or_create_settings()
  - Replaces the select → if null → insert pattern in useSettings hook
  - INSERT ... ON CONFLICT DO NOTHING then SELECT — 1 round-trip
  - Filtered by auth.uid()

  ### get_review_words (UPDATED)
  - Updated to JOIN books table instead of reading dropped book_title column
  - p_book_title filter now compares against books.title (lowercase)

  ## Query Count Reduction
  | Operation            | Before | After |
  |----------------------|--------|-------|
  | Load word library    | 2+     | 1     |
  | Dashboard stats      | 4      | 1     |
  | Load settings        | 1-2    | 1     |
  | Load flashcard words | 1      | 1     |
  | TOTAL typical load   | 8-10+  | 4     |
*/

-- ============================================================
-- 1. get_words_with_progress: replaces 2-query fetchAllWords
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
BEGIN
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
  LEFT JOIN learning_progress lp
    ON lp.word_id = w.id AND lp.user_id = auth.uid()
  WHERE w.user_id = auth.uid()
  ORDER BY w.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================
-- 2. get_dashboard_stats: replaces 4 COUNT queries
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
BEGIN
  RETURN QUERY
  SELECT
    COUNT(w.id)                                                                AS total_words,
    COUNT(CASE WHEN lp.mastered = true                              THEN 1 END) AS mastered_words,
    COUNT(CASE WHEN lp.id IS NOT NULL AND lp.mastered = false       THEN 1 END) AS in_progress_words,
    COUNT(CASE WHEN lp.id IS NULL                                   THEN 1 END) AS new_words,
    COUNT(CASE WHEN lp.id IS NULL
                 OR  (lp.mastered = false AND lp.next_review <= now())
                                                                    THEN 1 END) AS due_for_review
  FROM words w
  LEFT JOIN learning_progress lp
    ON lp.word_id = w.id AND lp.user_id = auth.uid()
  WHERE w.user_id = auth.uid();
END;
$$;

-- ============================================================
-- 3. get_or_create_settings: replaces select + insert pattern
-- ============================================================
CREATE OR REPLACE FUNCTION get_or_create_settings()
RETURNS SETOF user_settings
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_settings (user_id, pronunciation_accent, show_book_title)
  VALUES (auth.uid(), 'american', false)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT *
  FROM user_settings
  WHERE user_id = auth.uid();
END;
$$;

-- ============================================================
-- 4. get_review_words: updated to JOIN books (book_title column removed)
-- ============================================================
CREATE OR REPLACE FUNCTION get_review_words(
  p_user_id   uuid,
  p_limit     integer DEFAULT 20,
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
BEGIN
  RETURN QUERY
  WITH due_words AS (
    SELECT w.id AS wid
    FROM words w
    LEFT JOIN books b
      ON b.id = w.book_id
    LEFT JOIN learning_progress lp
      ON lp.word_id = w.id AND lp.user_id = p_user_id
    WHERE w.user_id = p_user_id
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
  LEFT JOIN learning_progress lp
    ON lp.word_id = w.id AND lp.user_id = p_user_id;
END;
$$;
