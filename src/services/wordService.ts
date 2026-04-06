import { supabase } from '../lib/supabase';
import type { Word, WordWithProgress, LearningProgress, KindleWord } from '../types';

export async function fetchAllWords(userId: string): Promise<WordWithProgress[]> {
  const allWords: Word[] = [];
  const pageSize = 1000;
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allWords.push(...data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  const allProgress: LearningProgress[] = [];
  page = 0;
  hasMore = true;

  while (hasMore) {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('learning_progress')
      .select('*')
      .eq('user_id', userId)
      .range(from, to);

    if (error) throw error;

    if (data && data.length > 0) {
      allProgress.push(...data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  const progressMap = new Map<string, LearningProgress>();
  for (const p of allProgress) {
    progressMap.set(p.word_id, p);
  }

  return allWords.map((w: Word) => ({
    ...w,
    progress: progressMap.get(w.id),
  }));
}

export async function importKindleWords(userId: string, kindleWords: KindleWord[]): Promise<number> {
  let imported = 0;
  const batchSize = 50;

  for (let i = 0; i < kindleWords.length; i += batchSize) {
    const batch = kindleWords.slice(i, i + batchSize);
    const wordsToInsert = batch.map((kw) => ({
      user_id: userId,
      word: kw.word,
      stem: kw.stem,
      usage_example: kw.usage,
      book_title: kw.book_title,
    }));

    const { data, error } = await supabase
      .from('words')
      .upsert(wordsToInsert, { onConflict: 'user_id,word', ignoreDuplicates: true })
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
