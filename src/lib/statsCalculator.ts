import type { WordWithProgress, VocabStats } from '../types';

export function calculateStats(words: WordWithProgress[]): VocabStats {
  const wordsByLength: Record<number, number> = {};
  const wordsByFirstLetter: Record<string, number> = {};
  const wordsByBook: Record<string, number> = {};

  let masteredCount = 0;
  let learningCount = 0;
  let newCount = 0;

  for (const w of words) {
    const len = w.word.length;
    wordsByLength[len] = (wordsByLength[len] || 0) + 1;

    const firstLetter = w.word[0]?.toUpperCase() || '?';
    wordsByFirstLetter[firstLetter] = (wordsByFirstLetter[firstLetter] || 0) + 1;

    const book = w.book_title || 'Unknown';
    wordsByBook[book] = (wordsByBook[book] || 0) + 1;

    if (w.progress) {
      if (w.progress.mastered) {
        masteredCount++;
      } else if (w.progress.repetitions > 0) {
        learningCount++;
      } else {
        newCount++;
      }
    } else {
      newCount++;
    }
  }

  return {
    totalWords: words.length,
    uniqueWords: words.length,
    duplicatesRemoved: 0,
    wordsByLength,
    wordsByFirstLetter,
    wordsByBook,
    masteredCount,
    learningCount,
    newCount,
  };
}
