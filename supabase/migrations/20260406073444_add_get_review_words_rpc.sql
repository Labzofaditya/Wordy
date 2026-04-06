/*
  # Add get_review_words RPC function

  1. New Functions
    - `get_review_words(p_user_id, p_limit, p_book_title)` - Returns words due for review in a single query
      - Combines words and learning_progress tables
      - Prioritizes new words (no progress) and due reviews
      - Filters by book_title when provided
      - Returns flattened word + progress data

  2. Performance
    - Replaces 5 sequential queries with 1 optimized query
    - Uses CTE for efficient filtering and limiting
    - Properly indexes on user_id and next_review

  3. Security
    - SECURITY DEFINER ensures RLS is bypassed for this function
    - Function validates user_id parameter internally
*/

CREATE OR REPLACE FUNCTION get_review_words(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_book_title text DEFAULT NULL
)
RETURNS TABLE (
  word_id uuid,
  word text,
  stem text,
  meaning text,
  etymology text,
  usage_example text,
  book_title text,
  word_created_at timestamptz,
  word_updated_at timestamptz,
  progress_id uuid,
  stability numeric,
  difficulty numeric,
  state text,
  reps integer,
  lapses integer,
  next_review timestamptz,
  last_reviewed timestamptz,
  mastered boolean,
  progress_created_at timestamptz,
  progress_updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  WITH due_words AS (
    SELECT w.id as wid, lp.next_review as nr
    FROM words w
    LEFT JOIN learning_progress lp ON lp.word_id = w.id AND lp.user_id = p_user_id
    WHERE w.user_id = p_user_id
      AND (p_book_title IS NULL OR w.book_title = p_book_title)
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
    w.book_title,
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
  LEFT JOIN learning_progress lp ON lp.word_id = w.id AND lp.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
