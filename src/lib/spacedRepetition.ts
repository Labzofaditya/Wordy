import type { FSRSRating, FSRSState } from '../types';

const FSRS_PARAMS = {
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
  requestRetention: 0.9,
  maximumInterval: 36500,
  easyBonus: 1.3,
  hardInterval: 1.2,
};

export interface FSRSCard {
  stability: number;
  difficulty: number;
  state: FSRSState;
  reps: number;
  lapses: number;
  lastReview: Date | null;
}

export interface FSRSResult {
  stability: number;
  difficulty: number;
  state: FSRSState;
  reps: number;
  lapses: number;
  interval: number;
  nextReview: Date;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function initDifficulty(rating: FSRSRating): number {
  const w = FSRS_PARAMS.w;
  return clamp(w[4] - (rating - 3) * w[5], 1, 10);
}

function initStability(rating: FSRSRating): number {
  const w = FSRS_PARAMS.w;
  return Math.max(w[rating - 1], 0.1);
}

function nextDifficulty(d: number, rating: FSRSRating): number {
  const w = FSRS_PARAMS.w;
  const delta = -(w[6] * (rating - 3));
  const newD = d + delta * ((10 - d) / 9);
  return clamp(w[4] * (1 - w[7]) + w[7] * newD, 1, 10);
}

function recallStability(d: number, s: number, r: number, rating: FSRSRating): number {
  const w = FSRS_PARAMS.w;
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
}

function forgetStability(d: number, s: number, r: number): number {
  const w = FSRS_PARAMS.w;
  return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
}

function retrievability(s: number, elapsedDays: number): number {
  if (elapsedDays <= 0) return 1;
  return Math.pow(1 + elapsedDays / (9 * s), -1);
}

function nextInterval(s: number): number {
  const r = FSRS_PARAMS.requestRetention;
  const interval = 9 * s * (Math.pow(r, -1) - 1);
  return clamp(Math.round(interval), 1, FSRS_PARAMS.maximumInterval);
}

export function calculateFSRS(
  rating: FSRSRating,
  card: FSRSCard
): FSRSResult {
  const now = new Date();
  let elapsedDays = 0;
  if (card.lastReview) {
    elapsedDays = Math.max(0, (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24));
  }

  let stability = card.stability;
  let difficulty = card.difficulty;
  let state = card.state;
  let reps = card.reps;
  let lapses = card.lapses;

  if (state === 'new') {
    difficulty = initDifficulty(rating);
    stability = initStability(rating);

    if (rating === 1) {
      state = 'learning';
    } else {
      state = 'review';
      reps = 1;
    }
  } else {
    const r = retrievability(stability, elapsedDays);
    difficulty = nextDifficulty(difficulty, rating);

    if (rating === 1) {
      stability = forgetStability(difficulty, stability, r);
      state = 'relearning';
      lapses += 1;
    } else {
      stability = recallStability(difficulty, stability, r, rating);
      state = 'review';
      reps += 1;
    }
  }

  let interval: number;
  if (state === 'learning' || state === 'relearning') {
    if (rating === 1) {
      interval = 0;
    } else if (rating === 2) {
      interval = 0;
    } else {
      interval = 1;
    }
  } else {
    interval = nextInterval(stability);
    if (rating === 2) {
      interval = Math.max(1, Math.round(interval * 0.8));
    } else if (rating === 4) {
      interval = Math.round(interval * FSRS_PARAMS.easyBonus);
    }
  }

  interval = clamp(interval, state === 'learning' || state === 'relearning' ? 0 : 1, FSRS_PARAMS.maximumInterval);

  const nextReview = new Date(now);
  if (interval === 0) {
    nextReview.setMinutes(nextReview.getMinutes() + 10);
  } else {
    nextReview.setDate(nextReview.getDate() + interval);
  }

  return {
    stability,
    difficulty,
    state,
    reps,
    lapses,
    interval,
    nextReview,
  };
}

export function getRatingLabel(rating: FSRSRating): string {
  const labels: Record<FSRSRating, string> = {
    1: 'Again',
    2: 'Hard',
    3: 'Good',
    4: 'Easy',
  };
  return labels[rating];
}

export function getRatingColor(rating: FSRSRating): string {
  const colors: Record<FSRSRating, string> = {
    1: 'bg-red-500 hover:bg-red-600',
    2: 'bg-amber-500 hover:bg-amber-600',
    3: 'bg-emerald-500 hover:bg-emerald-600',
    4: 'bg-blue-500 hover:bg-blue-600',
  };
  return colors[rating];
}

export function getNextIntervalPreview(rating: FSRSRating, card: FSRSCard): string {
  const result = calculateFSRS(rating, card);
  if (result.interval === 0) {
    return '10m';
  } else if (result.interval === 1) {
    return '1d';
  } else if (result.interval < 30) {
    return `${result.interval}d`;
  } else if (result.interval < 365) {
    return `${Math.round(result.interval / 30)}mo`;
  } else {
    return `${(result.interval / 365).toFixed(1)}y`;
  }
}
