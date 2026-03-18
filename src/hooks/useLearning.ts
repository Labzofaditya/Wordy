import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { calculateSM2 } from '../lib/spacedRepetition';
import type { WordWithProgress, ReviewQuality } from '../types';

export function useLearning() {
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState(false);

  const getWordsForReview = useCallback(
    async (limit: number = 20): Promise<WordWithProgress[]> => {
      if (!user) return [];

      const now = new Date().toISOString();

      const { data: progressData } = await supabase
        .from('learning_progress')
        .select('word_id')
        .eq('user_id', user.id)
        .lte('next_review', now)
        .eq('mastered', false)
        .limit(limit);

      const reviewWordIds = progressData?.map((p) => p.word_id) || [];

      const { data: allProgressWordIds } = await supabase
        .from('learning_progress')
        .select('word_id')
        .eq('user_id', user.id);

      const progressWordIdSet = new Set(allProgressWordIds?.map((p) => p.word_id) || []);

      const { data: allUserWords } = await supabase
        .from('words')
        .select('id')
        .eq('user_id', user.id)
        .limit(1000);

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

  const recordReview = async (wordId: string, quality: ReviewQuality) => {
    if (!user) throw new Error('Not authenticated');

    setReviewing(true);
    try {
      const { data: existingProgress } = await supabase
        .from('learning_progress')
        .select('*')
        .eq('word_id', wordId)
        .eq('user_id', user.id)
        .maybeSingle();

      const currentEase = existingProgress?.ease_factor || 2.5;
      const currentInterval = existingProgress?.interval || 0;
      const currentReps = existingProgress?.repetitions || 0;

      const result = calculateSM2(quality, currentEase, currentInterval, currentReps);
      const mastered = result.repetitions >= 5 && result.easeFactor >= 2.5;

      const progressData = {
        user_id: user.id,
        word_id: wordId,
        ease_factor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
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

    const { data: total } = await supabase
      .from('words')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id);

    const { data: mastered } = await supabase
      .from('learning_progress')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('mastered', true);

    const now = new Date().toISOString();
    const { data: dueForReview } = await supabase
      .from('learning_progress')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .lte('next_review', now)
      .eq('mastered', false);

    return {
      total: total?.length || 0,
      mastered: mastered?.length || 0,
      dueForReview: dueForReview?.length || 0,
    };
  };

  return {
    getWordsForReview,
    recordReview,
    getStats,
    reviewing,
  };
}
