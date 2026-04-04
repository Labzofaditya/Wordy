import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateFSRS, type FSRSCard } from '../lib/spacedRepetition';
import type { WordWithProgress, FSRSRating, FSRSState } from '../types';

export function useLearning() {
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState(false);

  const getWordsForReview = useCallback(
    async (limit: number = 20, bookTitle?: string): Promise<WordWithProgress[]> => {
      if (!user) return [];

      const now = new Date().toISOString();

      let wordIdsInBook: Set<string> | null = null;
      if (bookTitle) {
        const { data: bookWords } = await supabase
          .from('words')
          .select('id')
          .eq('user_id', user.id)
          .eq('book_title', bookTitle);
        wordIdsInBook = new Set(bookWords?.map((w) => w.id) || []);
        if (wordIdsInBook.size === 0) return [];
      }

      const { data: progressData } = await supabase
        .from('learning_progress')
        .select('word_id')
        .eq('user_id', user.id)
        .lte('next_review', now)
        .eq('mastered', false)
        .limit(limit * 2);

      let reviewWordIds = progressData?.map((p) => p.word_id) || [];
      if (wordIdsInBook) {
        reviewWordIds = reviewWordIds.filter((id) => wordIdsInBook!.has(id));
      }
      reviewWordIds = reviewWordIds.slice(0, limit);

      const { data: allProgressWordIds } = await supabase
        .from('learning_progress')
        .select('word_id')
        .eq('user_id', user.id);

      const progressWordIdSet = new Set(allProgressWordIds?.map((p) => p.word_id) || []);

      let wordsQuery = supabase
        .from('words')
        .select('id')
        .eq('user_id', user.id)
        .limit(1000);

      if (bookTitle) {
        wordsQuery = wordsQuery.eq('book_title', bookTitle);
      }

      const { data: allUserWords } = await wordsQuery;

      const newWordIds = (allUserWords || [])
        .filter((w) => !progressWordIdSet.has(w.id))
        .map((w) => w.id)
        .slice(0, limit - reviewWordIds.length);

      const allWordIds = [...reviewWordIds, ...newWordIds].slice(0, limit);

      if (allWordIds.length === 0) return [];

      const { data: words } = await supabase
        .from('words')
        .select('*')
        .in('id', allWordIds);

      const { data: progress } = await supabase
        .from('learning_progress')
        .select('*')
        .in('word_id', allWordIds);

      const progressMap = new Map();
      for (const p of progress || []) {
        progressMap.set(p.word_id, p);
      }

      return (words || []).map((w) => ({
        ...w,
        progress: progressMap.get(w.id),
      }));
    },
    [user]
  );

  const recordReview = async (wordId: string, rating: FSRSRating) => {
    if (!user) throw new Error('Not authenticated');

    setReviewing(true);
    try {
      const { data: existingProgress } = await supabase
        .from('learning_progress')
        .select('*')
        .eq('word_id', wordId)
        .eq('user_id', user.id)
        .maybeSingle();

      const card: FSRSCard = {
        stability: existingProgress?.stability || 1.0,
        difficulty: existingProgress?.difficulty || 5.0,
        state: (existingProgress?.state as FSRSState) || 'new',
        reps: existingProgress?.reps || 0,
        lapses: existingProgress?.lapses || 0,
        lastReview: existingProgress?.last_reviewed ? new Date(existingProgress.last_reviewed) : null,
      };

      const result = calculateFSRS(rating, card);
      const mastered = result.state === 'review' && result.reps >= 5 && result.stability >= 30;

      const progressData = {
        user_id: user.id,
        word_id: wordId,
        stability: result.stability,
        difficulty: result.difficulty,
        state: result.state,
        reps: result.reps,
        lapses: result.lapses,
        next_review: result.nextReview.toISOString(),
        last_reviewed: new Date().toISOString(),
        mastered,
        updated_at: new Date().toISOString(),
      };

      if (existingProgress) {
        const { error } = await supabase
          .from('learning_progress')
          .update(progressData)
          .eq('id', existingProgress.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('learning_progress')
          .insert(progressData);

        if (error) throw error;
      }
    } finally {
      setReviewing(false);
    }
  };

  const getStats = async () => {
    if (!user) return null;

    const { count: totalCount } = await supabase
      .from('words')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: masteredCount } = await supabase
      .from('learning_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('mastered', true);

    const now = new Date().toISOString();
    const { count: dueCount } = await supabase
      .from('learning_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lte('next_review', now)
      .eq('mastered', false);

    const { count: inProgressCount } = await supabase
      .from('learning_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const total = totalCount || 0;
    const mastered = masteredCount || 0;
    const hasProgress = inProgressCount || 0;
    const due = dueCount || 0;
    const newWords = total - hasProgress;
    const inProgress = hasProgress - mastered;

    return {
      total,
      mastered,
      inProgress,
      newWords,
      dueForReview: due + newWords,
    };
  };

  return {
    getWordsForReview,
    recordReview,
    getStats,
    reviewing,
  };
}
