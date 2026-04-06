import { supabase } from '../lib/supabase';
import type { WordWithProgress, LearningProgress, KindleWord, FSRSState } from '../types';

export async function fetchAllWords(userId: string): Promise<WordWithProgress[]> {
  const pageSize = 1000;
  const allResults: WordWithProgress[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.rpc('get_words_with_progress', {
      p_limit: pageSize,
      p_offset: offset,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    for (const row of data) {
      const progress: LearningProgress | undefined = row.progress_id
        ? {
            id: row.progress_id,
            user_id: userId,
            word_id: row.id,
            stability: row.stability,
            difficulty: row.difficulty,
            state: row.state as FSRSState,
            reps: row.reps,
            lapses: row.lapses,
            next_review: row.next_review,
            last_reviewed: row.last_reviewed,
            mastered: row.mastered,
            created_at: row.progress_created_at,
            updated_at: row.progress_updated_at,
          }
        : undefined;

      allResults.push({
        id: row.id,
        user_id: row.user_id,
        word: row.word,
        stem: row.stem,
        meaning: row.meaning,
        etymology: row.etymology,
        usage_example: row.usage_example,
        book_title: row.book_title,
        created_at: row.created_at,
        updated_at: row.updated_at,
        progress,
      });
    }

    hasMore = data.length === pageSize;
    offset += pageSize;
  }

  return allResults;
}

export async function importKindleWords(userId: string, kindleWords: KindleWord[]): Promise<number> {
  const uniqueTitles = [
    ...new Set(
      kindleWords
        .map((kw) => kw.book_title?.toLowerCase().trim())
        .filter((t): t is string => !!t)
    ),
  ];

  const bookMap = new Map<string, string>();

  if (uniqueTitles.length > 0) {
    await supabase
      .from('books')
      .upsert(
        uniqueTitles.map((title) => ({ user_id: userId, title })),
        { onConflict: 'user_id,title', ignoreDuplicates: true }
      );

    const { data: books } = await supabase
      .from('books')
      .select('id, title')
      .eq('user_id', userId)
      .in('title', uniqueTitles);

    books?.forEach((b) => bookMap.set(b.title, b.id));
  }

  let imported = 0;
  const batchSize = 50;

  for (let i = 0; i < kindleWords.length; i += batchSize) {
    const batch = kindleWords.slice(i, i + batchSize);
    const wordsToInsert = batch.map((kw) => ({
      user_id: userId,
      word: kw.word,
      stem: kw.stem,
      usage_example: kw.usage,
      book_id: kw.book_title
        ? (bookMap.get(kw.book_title.toLowerCase().trim()) ?? null)
        : null,
    }));

    const { data, error } = await supabase
      .from('words')
      .upsert(wordsToInsert, { onConflict: 'user_id,normalized_word', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error('Import error:', error);
    } else {
      imported += data?.length || 0;
    }
  }

  return imported;
}

export async function updateMeaning(
  userId: string,
  wordId: string,
  meaning: string,
  etymology: string
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .update({ meaning, etymology, updated_at: new Date().toISOString() })
    .eq('id', wordId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function deleteWord(userId: string, wordId: string): Promise<void> {
  const { error } = await supabase
    .from('words')
    .delete()
    .eq('id', wordId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function updateSpelling(
  userId: string,
  wordId: string,
  newSpelling: string
): Promise<void> {
  const trimmed = newSpelling.trim();
  if (!trimmed) throw new Error('Word cannot be empty');

  const { error } = await supabase
    .from('words')
    .update({ word: trimmed, meaning: null, etymology: null, updated_at: new Date().toISOString() })
    .eq('id', wordId)
    .eq('user_id', userId);

  if (error) throw error;
}
