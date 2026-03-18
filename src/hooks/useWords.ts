import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Word, WordWithProgress, LearningProgress, KindleWord } from '../types';

export function useWords() {
  const { user } = useAuth();
  const [words, setWords] = useState<WordWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWords = useCallback(async () => {
    if (!user) {
      setWords([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const allWords: Word[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error: wordsError } = await supabase
          .from('words')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (wordsError) throw wordsError;

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

        const { data, error: progressError } = await supabase
          .from('learning_progress')
          .select('*')
          .eq('user_id', user.id)
          .range(from, to);

        if (progressError) throw progressError;

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

      const wordsWithProgress: WordWithProgress[] = allWords.map((w: Word) => ({
        ...w,
        progress: progressMap.get(w.id),
      }));

      setWords(wordsWithProgress);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch words');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  const importWords = async (kindleWords: KindleWord[]): Promise<number> => {
    if (!user) throw new Error('Not authenticated');

    let imported = 0;
    const batchSize = 50;

    for (let i = 0; i < kindleWords.length; i += batchSize) {
      const batch = kindleWords.slice(i, i + batchSize);
      const wordsToInsert = batch.map((kw) => ({
        user_id: user.id,
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

    await fetchWords();
    return imported;
  };

  const updateWordMeaning = async (wordId: string, meaning: string, etymology: string) => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('words')
      .update({ meaning, etymology, updated_at: new Date().toISOString() })
      .eq('id', wordId)
      .eq('user_id', user.id);

    if (error) throw error;

    setWords((prev) =>
      prev.map((w) => (w.id === wordId ? { ...w, meaning, etymology } : w))
    );
  };

  const deleteWord = async (wordId: string) => {
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('words')
      .delete()
      .eq('id', wordId)
      .eq('user_id', user.id);

    if (error) throw error;

    setWords((prev) => prev.filter((w) => w.id !== wordId));
  };

  return {
    words,
    loading,
    error,
    fetchWords,
    importWords,
    updateWordMeaning,
    deleteWord,
  };
}
