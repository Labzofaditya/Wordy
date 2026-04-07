import { supabase } from '../lib/supabase';
import type { WordWithProgress, FSRSState } from '../types';

export interface ProgressData {
  user_id: string;
  word_id: string;
  stability: number;
  difficulty: number;
  state: FSRSState;
  reps: number;
  lapses: number;
  next_review: string;
  last_reviewed: string;
  mastered: boolean;
  updated_at: string;
}

export async function getReviewWords(
  limit: number = 20,
  bookTitle?: string
): Promise<WordWithProgress[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id ?? '';

  const { data, error } = await supabase.rpc('get_review_words', {
    p_limit: limit,
    p_book_title: bookTitle || null,
  });

  if (error) {
    console.error('Error fetching review words:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row: {
    word_id: string;
    word: string;
    stem: string | null;
    meaning: string | null;
    etymology: string | null;
    usage_example: string | null;
    book_title: string | null;
    word_created_at: string;
    word_updated_at: string;
    progress_id: string | null;
    stability: number | null;
    difficulty: number | null;
    state: string | null;
    reps: number | null;
    lapses: number | null;
    next_review: string | null;
    last_reviewed: string | null;
    mastered: boolean | null;
    progress_created_at: string | null;
    progress_updated_at: string | null;
  }) => ({
    id: row.word_id,
    user_id: userId,
    word: row.word,
    stem: row.stem,
    meaning: row.meaning,
    etymology: row.etymology,
    usage_example: row.usage_example,
    book_title: row.book_title,
    created_at: row.word_created_at,
    updated_at: row.word_updated_at,
    progress: row.progress_id
      ? {
          id: row.progress_id,
          user_id: userId,
          word_id: row.word_id,
          stability: row.stability!,
          difficulty: row.difficulty!,
          state: row.state as FSRSState,
          reps: row.reps!,
          lapses: row.lapses!,
          next_review: row.next_review!,
          last_reviewed: row.last_reviewed,
          mastered: row.mastered!,
          created_at: row.progress_created_at!,
          updated_at: row.progress_updated_at!,
        }
      : undefined,
  }));
}

export async function saveReviewResult(
  progressData: ProgressData,
  existingProgressId?: string
): Promise<void> {
  if (existingProgressId) {
    const { error } = await supabase
      .from('learning_progress')
      .update(progressData)
      .eq('id', existingProgressId);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('learning_progress')
      .insert(progressData);

    if (error) throw error;
  }
}

export interface LearningStats {
  total: number;
  mastered: number;
  inProgress: number;
  newWords: number;
  dueForReview: number;
}

export async function getLearningStats(): Promise<LearningStats | null> {
  const { data, error } = await supabase.rpc('get_dashboard_stats');

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    total: Number(row.total_words),
    mastered: Number(row.mastered_words),
    inProgress: Number(row.in_progress_words),
    newWords: Number(row.new_words),
    dueForReview: Number(row.due_for_review),
  };
}
