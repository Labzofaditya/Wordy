export interface Word {
  id: string;
  user_id: string;
  word: string;
  stem: string | null;
  meaning: string | null;
  etymology: string | null;
  usage_example: string | null;
  book_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearningProgress {
  id: string;
  user_id: string;
  word_id: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review: string;
  last_reviewed: string | null;
  mastered: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  mw_api_key: string | null;
  openai_api_key: string | null;
  google_api_key: string | null;
  pronunciation_provider: 'openai' | 'google';
  pronunciation_accent: 'american' | 'british' | 'indian';
  ai_feedback_provider: 'openai' | 'google';
  created_at: string;
  updated_at: string;
}

export interface WordWithProgress extends Word {
  progress?: LearningProgress;
}

export interface KindleWord {
  word: string;
  stem: string;
  usage: string;
  book_title: string;
}

export interface VocabStats {
  totalWords: number;
  uniqueWords: number;
  duplicatesRemoved: number;
  wordsByLength: Record<number, number>;
  wordsByFirstLetter: Record<string, number>;
  wordsByBook: Record<string, number>;
  masteredCount: number;
  learningCount: number;
  newCount: number;
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;
