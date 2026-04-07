/*
  # Add import_kindle_batch RPC

  ## Summary
  Adds a single-transaction RPC to handle Kindle word imports, replacing the
  multi-round-trip client approach (separate books upsert + words upsert per batch).

  ## New Functions

  ### import_kindle_batch(p_words jsonb)
  - Accepts a JSONB array of word objects: {word, stem, usage_example, book_title}
  - Upserts books from the batch (deduped by lowercase title) in one statement
  - Upserts words linked to their book IDs in one statement
  - Both operations run in the same transaction — no partial state possible
  - Filtered by auth.uid() — caller can never insert for another user
  - Returns count of newly inserted words (existing duplicates are skipped)

  ## Security
  - SECURITY DEFINER with explicit search_path = public
  - auth.uid() IS NULL guard raises exception for unauthenticated calls
  - REVOKE EXECUTE FROM PUBLIC, GRANT TO authenticated only

  ## Performance Notes
  - Replaces 2+ round-trips per batch (books upsert + book ID fetch + words upsert)
  - Single CTE chain: book upsert → word upsert → count
  - Caller can use batches of up to 200 words safely
*/

CREATE OR REPLACE FUNCTION import_kindle_batch(p_words jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid;
  v_imported integer := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 1. Upsert all unique book titles from the batch
  INSERT INTO books (user_id, title)
  SELECT DISTINCT v_uid, lower(trim(w->>'book_title'))
  FROM jsonb_array_elements(p_words) AS w
  WHERE (w->>'book_title') IS NOT NULL
    AND trim(w->>'book_title') <> ''
  ON CONFLICT (user_id, title) DO NOTHING;

  -- 2. Upsert words, joining to books for book_id
  WITH word_rows AS (
    SELECT
      (w->>'word')                          AS word,
      NULLIF(trim(w->>'stem'), '')          AS stem,
      NULLIF(trim(w->>'usage_example'), '') AS usage_example,
      lower(trim(w->>'book_title'))         AS book_key
    FROM jsonb_array_elements(p_words) AS w
    WHERE (w->>'word') IS NOT NULL
      AND trim(w->>'word') <> ''
  ),
  inserted AS (
    INSERT INTO words (user_id, word, stem, usage_example, book_id)
    SELECT
      v_uid,
      wr.word,
      wr.stem,
      wr.usage_example,
      b.id
    FROM word_rows wr
    LEFT JOIN books b
      ON b.user_id = v_uid AND b.title = wr.book_key
    ON CONFLICT (user_id, normalized_word) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_imported FROM inserted;

  RETURN v_imported;
END;
$$;

REVOKE EXECUTE ON FUNCTION import_kindle_batch(jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION import_kindle_batch(jsonb) TO authenticated;
