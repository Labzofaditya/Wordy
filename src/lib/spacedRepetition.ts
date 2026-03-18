import type { ReviewQuality } from '../types';

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: Date;
}

export function calculateSM2(
  quality: ReviewQuality,
  currentEaseFactor: number,
  currentInterval: number,
  currentRepetitions: number
): SM2Result {
  let easeFactor = currentEaseFactor;
  let interval = currentInterval;
  let repetitions = currentRepetitions;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(currentInterval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReview,
  };
}

export function getQualityLabel(quality: ReviewQuality): string {
  const labels: Record<ReviewQuality, string> = {
    0: 'Complete blackout',
    1: 'Incorrect, remembered on seeing',
    2: 'Incorrect, easily remembered',
    3: 'Correct with difficulty',
    4: 'Correct with hesitation',
    5: 'Perfect response',
  };
  return labels[quality];
}

export function getQualityColor(quality: ReviewQuality): string {
  const colors: Record<ReviewQuality, string> = {
    0: 'bg-red-600',
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-yellow-500',
    4: 'bg-green-500',
    5: 'bg-emerald-600',
  };
  return colors[quality];
}
