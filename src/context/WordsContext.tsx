import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchAllWords,
  importKindleWords,
  updateMeaning,
  deleteWord as deleteWordFromService,
  updateSpelling,
} from '../services/wordService';
import type { WordWithProgress, KindleWord } from '../types';

interface WordsContextType {
  words: WordWithProgress[];
  loading: boolean;
  error: string | null;
  fetchWords: () => Promise<void>;
  importWords: (kindleWords: KindleWord[]) => Promise<number>;
  updateWordMeaning: (wordId: string, meaning: string, etymology: string) => Promise<void>;
  deleteWord: (wordId: string) => Promise<void>;
  updateWordSpelling: (wordId: string, newSpelling: string) => Promise<void>;
  getUniqueBooks: () => string[];
}

const WordsContext = createContext<WordsContextType | null>(null);

export function WordsProvider({ children }: { children: ReactNode }) {
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
      const wordsWithProgress = await fetchAllWords(user.id);
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
    const imported = await importKindleWords(user.id, kindleWords);
    await fetchWords();
    return imported;
  };

  const updateWordMeaning = async (wordId: string, meaning: string, etymology: string) => {
    if (!user) throw new Error('Not authenticated');
    await updateMeaning(user.id, wordId, meaning, etymology);
    setWords((prev) =>
      prev.map((w) => (w.id === wordId ? { ...w, meaning, etymology } : w))
    );
  };

  const deleteWord = async (wordId: string) => {
    if (!user) throw new Error('Not authenticated');
    await deleteWordFromService(user.id, wordId);
    setWords((prev) => prev.filter((w) => w.id !== wordId));
  };

  const updateWordSpelling = async (wordId: string, newSpelling: string) => {
    if (!user) throw new Error('Not authenticated');
    await updateSpelling(user.id, wordId, newSpelling);
    const trimmed = newSpelling.trim();
    setWords((prev) =>
      prev.map((w) => (w.id === wordId ? { ...w, word: trimmed, meaning: null, etymology: null } : w))
    );
  };

  const getUniqueBooks = useCallback(() => {
    const books = new Set<string>();
    for (const w of words) {
      if (w.book_title) books.add(w.book_title);
    }
    return Array.from(books).sort();
  }, [words]);

  return (
    <WordsContext.Provider
      value={{
        words,
        loading,
        error,
        fetchWords,
        importWords,
        updateWordMeaning,
        deleteWord,
        updateWordSpelling,
        getUniqueBooks,
      }}
    >
      {children}
    </WordsContext.Provider>
  );
}

export function useWords() {
  const context = useContext(WordsContext);
  if (!context) {
    throw new Error('useWords must be used within a WordsProvider');
  }
  return context;
}
