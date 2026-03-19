/*
  # Rename OED API Key to Merriam-Webster API Key

  1. Changes
    - Renames `oed_api_key` column to `mw_api_key` in `user_settings` table
    - This change reflects the switch from Oxford English Dictionary to Merriam-Webster Dictionary

  2. Notes
    - Existing API keys will be preserved but will no longer work since they were OED keys
    - Users will need to obtain a new Merriam-Webster API key from dictionaryapi.com
*/

ALTER TABLE user_settings 
RENAME COLUMN oed_api_key TO mw_api_key;
