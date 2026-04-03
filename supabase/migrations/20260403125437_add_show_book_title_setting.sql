/*
  # Add show_book_title setting

  1. Changes
    - Add `show_book_title` column to `user_settings` table
    - Default value is `false` (book title hidden by default)
  
  2. Purpose
    - Allows users to toggle visibility of book name on flashcards
*/

ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS show_book_title boolean DEFAULT false NOT NULL;