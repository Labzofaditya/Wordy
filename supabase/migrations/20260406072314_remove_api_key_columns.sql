/*
  # Remove API key columns from user_settings

  This migration removes columns that stored sensitive API keys in the database.
  API keys are now securely managed as server-side environment variables.

  1. Columns Removed
    - `mw_api_key` - Merriam-Webster API key (now in MW_API_KEY env var)
    - `openai_api_key` - OpenAI API key (now in OPENAI_API_KEY env var)
    - `google_api_key` - Google API key (no longer used)
    - `pronunciation_provider` - No longer needed (server uses OpenAI)
    - `ai_feedback_provider` - No longer needed (server uses OpenAI)

  2. Columns Retained
    - `pronunciation_accent` - User preference for accent
    - `show_book_title` - User preference for display
*/

ALTER TABLE user_settings
DROP COLUMN IF EXISTS mw_api_key,
DROP COLUMN IF EXISTS openai_api_key,
DROP COLUMN IF EXISTS google_api_key,
DROP COLUMN IF EXISTS pronunciation_provider,
DROP COLUMN IF EXISTS ai_feedback_provider;
