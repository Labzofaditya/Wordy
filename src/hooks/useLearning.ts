import { useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { calculateFSRS, type FSRSCard } from '../lib/spacedRepetition';
import { getReviewWords, saveReviewResult, getLearningStats } from '../services/learningService';
import type { WordWithProgress, FSRSRating, FSRSState } from '../types';

export function useLearning() {
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState(false);

  const getWordsForReview = useCallback(
    async (limit: number = 20, bookTitle?: string): Promise<WordWithProgress[]> => {
      if (!user) return [];
      return getReviewWords(user.id, limit, bookTitle);
    },
    [user]
  );

  const recordReview = async (wordId: string, rating: FSRSRating, existingProgress?: {
    id: string;
    stability: number;
    difficulty: number;
    state: FSRSState;
    reps: number;
    lapses: number;
    last_reviewed: string | null;
  }) => {
    if (!user) throw new Error('Not authenticated');

    setReviewing(true);
    try {
      const card: FSRSCard = {
        stability: existingProgress?.stability || 1.0,
        difficulty: existingProgress?.difficulty || 5.0,
        state: existingProgress?.state || 'new',
        reps: existingProgress?.reps || 0,
        lapses: existingProgress?.lapses || 0,
        lastReview: existingProgress?.last_reviewed ? new Date(existingProgress.last_reviewed) : null,
      };

      const result = calculateFSRS(rating, card);
      const mastered = result.state === 'review' && result.reps >= 5 && result.stability >= 30;

      await saveReviewResult(
        {
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
        },
        existingProgress?.id
      );
    } finally {
      setReviewing(false);
    }
  };

  const getStats = async () => {
    if (!user) return null;
    return getLearningStats(user.id);
  };

  return {
    getWordsForReview,
    recordReview,
    getStats,
    reviewing,
  };
}
