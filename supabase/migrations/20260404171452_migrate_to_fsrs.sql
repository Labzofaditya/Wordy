/*
  # Migrate from SM-2 to FSRS Algorithm

  1. Changes to learning_progress table
    - Add `stability` (numeric) - FSRS stability parameter (days until 90% retention)
    - Add `difficulty` (numeric) - FSRS difficulty parameter (1-10 scale)
    - Add `state` (text) - FSRS state: new, learning, review, relearning
    - Add `reps` (integer) - Successful review count
    - Add `lapses` (integer) - Number of times card was forgotten

  2. Data Migration
    - Convert existing SM-2 data to approximate FSRS values
    - stability: derived from interval (interval represents days to next review)
    - difficulty: derived from ease_factor (higher ease = lower difficulty)
    - state: cards with reviews go to 'review', new cards stay 'new'
    - reps: copied from repetitions
    - lapses: default 0 (no historical data available)

  3. Column Removal
    - Remove `ease_factor` column (replaced by difficulty)
    - Remove `interval` column (calculated from stability)
    - Remove `repetitions` column (replaced by reps)

  4. Notes
    - mastered column is kept for easy filtering
    - Existing review schedules (next_review) are preserved
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_progress' AND column_name = 'stability'
  ) THEN
    ALTER TABLE learning_progress ADD COLUMN stability numeric DEFAULT 1.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_progress' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE learning_progress ADD COLUMN difficulty numeric DEFAULT 5.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_progress' AND column_name = 'state'
  ) THEN
    ALTER TABLE learning_progress ADD COLUMN state text DEFAULT 'new';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_progress' AND column_name = 'reps'
  ) THEN
    ALTER TABLE learning_progress ADD COLUMN reps integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'learning_progress' AND column_name = 'lapses'
  ) THEN
    ALTER TABLE learning_progress ADD COLUMN lapses integer DEFAULT 0;
  END IF;
END $$;

UPDATE learning_progress
SET 
  stability = GREATEST(COALESCE(interval, 1), 0.1),
  difficulty = GREATEST(1, LEAST(10, 10 - (COALESCE(ease_factor, 2.5) - 1.3) * 5)),
  state = CASE 
    WHEN COALESCE(repetitions, 0) > 0 THEN 'review'
    ELSE 'new'
  END,
  reps = COALESCE(repetitions, 0),
  lapses = 0
WHERE stability IS NULL OR state = 'new';

ALTER TABLE learning_progress 
  ALTER COLUMN stability SET DEFAULT 1.0,
  ALTER COLUMN difficulty SET DEFAULT 5.0,
  ALTER COLUMN state SET DEFAULT 'new',
  ALTER COLUMN reps SET DEFAULT 0,
  ALTER COLUMN lapses SET DEFAULT 0;

ALTER TABLE learning_progress 
  DROP COLUMN IF EXISTS ease_factor,
  DROP COLUMN IF EXISTS interval,
  DROP COLUMN IF EXISTS repetitions;
