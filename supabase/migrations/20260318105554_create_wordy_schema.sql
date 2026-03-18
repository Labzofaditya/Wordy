/*
  # Wordy Vocabulary Learning App Schema

  1. New Tables
    - `words`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `word` (text, the vocabulary word)
      - `stem` (text, word stem from Kindle)
      - `meaning` (text, definition from OED)
      - `etymology` (text, word origin from OED)
      - `usage_example` (text, example sentence)
      - `book_title` (text, source book from Kindle)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `learning_progress`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `word_id` (uuid, references words)
      - `ease_factor` (numeric, SM-2 algorithm factor)
      - `interval` (integer, days until next review)
      - `repetitions` (integer, successful review count)
      - `next_review` (timestamptz, next review date)
      - `last_reviewed` (timestamptz)
      - `mastered` (boolean, word fully learned)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `user_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, unique)
      - `oed_api_key` (text, encrypted OED API key)
      - `openai_api_key` (text, encrypted OpenAI API key)
      - `google_api_key` (text, encrypted Google API key)
      - `pronunciation_provider` (text, openai or google)
      - `pronunciation_accent` (text, american/british/indian)
      - `ai_feedback_provider` (text, openai or google)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own data
*/

-- Words table
CREATE TABLE IF NOT EXISTS words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word text NOT NULL,
  stem text,
  meaning text,
  etymology text,
  usage_example text,
  book_title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, word)
);

ALTER TABLE words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own words"
  ON words FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own words"
  ON words FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own words"
  ON words FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own words"
  ON words FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Learning progress table
CREATE TABLE IF NOT EXISTS learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  ease_factor numeric DEFAULT 2.5,
  interval integer DEFAULT 0,
  repetitions integer DEFAULT 0,
  next_review timestamptz DEFAULT now(),
  last_reviewed timestamptz,
  mastered boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, word_id)
);

ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress"
  ON learning_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON learning_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON learning_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON learning_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  oed_api_key text,
  openai_api_key text,
  google_api_key text,
  pronunciation_provider text DEFAULT 'openai',
  pronunciation_accent text DEFAULT 'american',
  ai_feedback_provider text DEFAULT 'openai',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_words_user_id ON words(user_id);
CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_next_review ON learning_progress(next_review);
CREATE INDEX IF NOT EXISTS idx_learning_progress_mastered ON learning_progress(mastered);