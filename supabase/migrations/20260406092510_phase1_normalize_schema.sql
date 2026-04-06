/*
  # Phase 1: Database Normalization

  ## Summary
  Normalizes the schema by extracting book data into a dedicated table,
  adding case-insensitive word deduplication, and adding performance indexes.

  ## New Tables
  - `books`
    - id (uuid, pk)
    - user_id (uuid, fk → auth.users)
    - title (text, stored lowercase for case-insensitive dedup)
    - created_at
    - UNIQUE(user_id, title)

  ## Modified Tables
  - `words`
    - ADD book_id (uuid, fk → books, nullable) — replaces book_title
    - ADD normalized_word (generated: lower(trim(word))) — enforces case-insensitive uniqueness
    - REMOVE book_title column
    - REPLACE unique(user_id, word) with unique(user_id, normalized_word)

  ## Data Migration
  1. Backfills books from distinct (user_id, lower(book_title)) in words
  2. Populates book_id for all existing words via join
  3. Removes case-insensitive duplicate words, keeping the earliest created_at row
  4. Drops old case-sensitive unique constraint

  ## Security
  - RLS enabled on books with standard user-level policies

  ## New Indexes
  - words(book_id)
  - books(user_id)
  - learning_progress(user_id, word_id) composite
  - learning_progress(next_review)
*/

-- ============================================================
-- 1. Create books table (titles stored lowercase-normalized)
-- ============================================================
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT books_user_id_title_key UNIQUE (user_id, title)
);

ALTER TABLE books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own books"
  ON books FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own books"
  ON books FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own books"
  ON books FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own books"
  ON books FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);

-- ============================================================
-- 2. Backfill books from words.book_title (lowercase-normalized)
-- ============================================================
INSERT INTO books (user_id, title)
SELECT DISTINCT user_id, lower(trim(book_title))
FROM words
WHERE book_title IS NOT NULL AND trim(book_title) <> ''
ON CONFLICT (user_id, title) DO NOTHING;

-- ============================================================
-- 3. Add book_id column to words
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'words' AND column_name = 'book_id'
  ) THEN
    ALTER TABLE words
      ADD COLUMN book_id uuid REFERENCES books(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 4. Populate book_id via join on normalized title
-- ============================================================
UPDATE words w
SET book_id = b.id
FROM books b
WHERE w.user_id = b.user_id
  AND lower(trim(w.book_title)) = b.title
  AND w.book_id IS NULL;

-- ============================================================
-- 5. Add normalized_word generated column
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'words' AND column_name = 'normalized_word'
  ) THEN
    ALTER TABLE words
      ADD COLUMN normalized_word text GENERATED ALWAYS AS (lower(trim(word))) STORED;
  END IF;
END $$;

-- ============================================================
-- 6. Remove case-insensitive duplicates — keep earliest row
-- ============================================================
DELETE FROM words
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, lower(trim(word))
             ORDER BY created_at ASC
           ) AS rn
    FROM words
  ) ranked
  WHERE rn > 1
);

-- ============================================================
-- 7. Replace case-sensitive unique constraint with normalized one
-- ============================================================
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_user_id_word_key;

ALTER TABLE words
  ADD CONSTRAINT words_user_id_normalized_word_key UNIQUE (user_id, normalized_word);

-- ============================================================
-- 8. Drop legacy book_title column
-- ============================================================
ALTER TABLE words DROP COLUMN IF EXISTS book_title;

-- ============================================================
-- 9. Add performance indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_words_book_id ON words(book_id);
CREATE INDEX IF NOT EXISTS idx_words_user_id ON words(user_id);

-- Composite index on learning_progress for join + filter queries
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_word
  ON learning_progress(user_id, word_id);

-- Index used by due-review queries
CREATE INDEX IF NOT EXISTS idx_learning_progress_next_review
  ON learning_progress(next_review);
