import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Volume2,
  Mic,
  ChevronRight,
  Loader2,
  BookOpen,
  Brain,
  Trophy,
  Filter,
} from 'lucide-react';
import { useLearning } from '../hooks/useLearning';
import { useSettings } from '../hooks/useSettings';
import { useWords } from '../hooks/useWords';
import type { WordWithProgress, FSRSRating, FSRSState } from '../types';
import { getRatingLabel, getRatingColor, getNextIntervalPreview, type FSRSCard } from '../lib/spacedRepetition';

interface FlashcardProps {
  onFetchMeaning: (word: string) => Promise<{ meaning: string; etymology: string } | null>;
  onPlayPronunciation: (word: string) => Promise<void>;
  onSpeechFeedback: (word: string, spoken: string, mode: 'pronunciation' | 'sentence') => Promise<string>;
}

export function Flashcards({ onFetchMeaning, onPlayPronunciation, onSpeechFeedback }: FlashcardProps) {
  const { getWordsForReview, recordReview, reviewing } = useLearning();
  const { settings } = useSettings();
  const { getUniqueBooks, loading: wordsLoading } = useWords();
  const [words, setWords] = useState<WordWithProgress[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMeaning, setLoadingMeaning] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<'pronunciation' | 'sentence'>('pronunciation');
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [books, setBooks] = useState<string[]>([]);

  useEffect(() => {
    if (!wordsLoading) {
      setBooks(getUniqueBooks());
    }
  }, [wordsLoading, getUniqueBooks]);

  const loadWords = useCallback(async (bookTitle?: string) => {
    setLoading(true);
    try {
      const reviewWords = await getWordsForReview(20, bookTitle || undefined);
      setWords(reviewWords);
      setCurrentIndex(0);
      setShowAnswer(false);
      setSessionComplete(reviewWords.length === 0);
      setSessionStats({ reviewed: 0, correct: 0 });
    } finally {
      setLoading(false);
    }
  }, [getWordsForReview]);

  useEffect(() => {
    loadWords(selectedBook || undefined);
  }, [selectedBook]);

  const currentWord = words[currentIndex];

  const handleShowAnswer = async () => {
    setShowAnswer(true);
    if (currentWord && !currentWord.meaning) {
      setLoadingMeaning(true);
      try {
        const result = await onFetchMeaning(currentWord.word);
        if (result && result.meaning) {
          setWords(prev => prev.map((w, idx) =>
            idx === currentIndex
              ? { ...w, meaning: result.meaning, etymology: result.etymology }
              : w
          ));
        } else {
          console.log('No meaning returned for:', currentWord.word, result);
        }
      } catch (err) {
        console.error('Failed to fetch meaning:', err);
      } finally {
        setLoadingMeaning(false);
      }
    }
  };

  const handleRate = async (rating: FSRSRating) => {
    if (!currentWord) return;

    await recordReview(currentWord.id, rating);

    setSessionStats((prev) => ({
      reviewed: prev.reviewed + 1,
      correct: rating >= 3 ? prev.correct + 1 : prev.correct,
    }));

    if (currentIndex < words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setShowAnswer(false);
      setFeedback(null);
    } else {
      setSessionComplete(true);
    }
  };

  const currentCard: FSRSCard = useMemo(() => {
    const progress = currentWord?.progress;
    return {
      stability: progress?.stability || 1.0,
      difficulty: progress?.difficulty || 5.0,
      state: (progress?.state as FSRSState) || 'new',
      reps: progress?.reps || 0,
      lapses: progress?.lapses || 0,
      lastReview: progress?.last_reviewed ? new Date(progress.last_reviewed) : null,
    };
  }, [currentWord]);

  const handlePlayPronunciation = async () => {
    if (!currentWord) return;
    setPlayingAudio(true);
    setFeedback(null);
    try {
      await onPlayPronunciation(currentWord.word);
    } catch (error) {
      console.error('Pronunciation error:', error);
      setFeedback('Could not play pronunciation. Please try again.');
    } finally {
      setPlayingAudio(false);
    }
  };

  const handleStartRecording = async () => {
    if (!currentWord) return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      setFeedback('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    setRecording(true);
    setFeedback(null);

    let hasResult = false;

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = settings?.pronunciation_accent === 'british' ? 'en-GB' :
                         settings?.pronunciation_accent === 'indian' ? 'en-IN' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = async (event: SpeechRecognitionEvent) => {
        hasResult = true;
        const spoken = event.results[0][0].transcript;
        setRecording(false);

        try {
          const result = await onSpeechFeedback(currentWord.word, spoken, feedbackMode);
          setFeedback(result);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setFeedback(`You said: "${spoken}". AI feedback error: ${errorMsg}`);
        }
      };

      recognition.onerror = (event) => {
        setRecording(false);
        if (event.error === 'no-speech') {
          setFeedback('No speech detected. Please try again and speak clearly.');
        } else if (event.error === 'not-allowed') {
          setFeedback('Microphone access denied. Please allow microphone access and try again.');
        } else {
          setFeedback(`Could not recognize speech (${event.error}). Please try again.`);
        }
      };

      recognition.onend = () => {
        setRecording(false);
        if (!hasResult) {
          setFeedback('No speech detected. Click Speak and say the word clearly.');
        }
      };

      recognition.start();

      setTimeout(() => {
        if (recording) {
          recognition.stop();
        }
      }, feedbackMode === 'sentence' ? 10000 : 5000);
    } catch (err) {
      setRecording(false);
      setFeedback('Speech recognition failed to start. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trophy className="h-10 w-10 text-teal-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {words.length === 0 ? 'No Words to Review' : 'Session Complete!'}
        </h2>
        <p className="text-slate-600 mb-4">
          {words.length === 0
            ? selectedBook
              ? `No words from "${selectedBook}" are due for review.`
              : 'Import some words or check back later when words are due for review.'
            : `You reviewed ${sessionStats.reviewed} words with ${sessionStats.correct} correct answers.`}
        </p>
        {selectedBook && (
          <p className="text-sm text-slate-500 mb-4">
            Reviewing: {selectedBook}
          </p>
        )}
        {sessionStats.reviewed > 0 && (
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <div className="text-4xl font-bold text-teal-600">
              {Math.round((sessionStats.correct / sessionStats.reviewed) * 100)}%
            </div>
            <p className="text-slate-600 text-sm">Accuracy</p>
          </div>
        )}
        <div className="flex flex-col gap-3 items-center">
          {books.length > 0 && (
            <select
              value={selectedBook}
              onChange={(e) => handleBookChange(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
            >
              <option value="">All Books</option>
              {books.map((book) => (
                <option key={book} value={book}>{book}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => loadWords(selectedBook || undefined)}
            className="px-6 py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  const handleBookChange = (book: string) => {
    setSelectedBook(book);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Practice</h1>
          <p className="text-slate-600">
            Card {currentIndex + 1} of {words.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {books.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={selectedBook}
                onChange={(e) => handleBookChange(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none max-w-[200px]"
              >
                <option value="">All Books</option>
                {books.map((book) => (
                  <option key={book} value={book}>{book}</option>
                ))}
              </select>
            </div>
          )}
          <div className="h-2 w-32 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-600 transition-all"
              style={{ width: `${((currentIndex + 1) / words.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="p-8 text-center border-b border-slate-100">
          <h2 className="text-4xl font-bold text-slate-900 mb-2">{currentWord?.word}</h2>
          {settings?.show_book_title && currentWord?.book_title && (
            <p className="text-sm text-slate-500 flex items-center justify-center gap-1">
              <BookOpen className="h-4 w-4" />
              {currentWord.book_title}
            </p>
          )}
        </div>

        <div className="p-6 flex justify-center gap-3">
          <button
            onClick={handlePlayPronunciation}
            disabled={playingAudio}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {playingAudio ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
            Listen
          </button>

          <div className="relative">
            <button
              onClick={handleStartRecording}
              disabled={recording}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                recording
                  ? 'bg-red-100 text-red-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Mic className={`h-5 w-5 ${recording ? 'animate-pulse' : ''}`} />
              {recording ? 'Listening...' : 'Speak'}
            </button>
          </div>

          <select
            value={feedbackMode}
            onChange={(e) => setFeedbackMode(e.target.value as 'pronunciation' | 'sentence')}
            className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg border-0 text-sm"
          >
            <option value="pronunciation">Word</option>
            <option value="sentence">Sentence</option>
          </select>
        </div>

        {feedback && (
          <div className="mx-6 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm flex items-start gap-2">
              <Brain className="h-5 w-5 flex-shrink-0 mt-0.5" />
              {feedback}
            </p>
          </div>
        )}

        {!showAnswer ? (
          <div className="p-6 pt-0">
            <button
              onClick={handleShowAnswer}
              className="w-full py-4 bg-teal-600 text-white font-medium rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
            >
              Show Answer
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="p-6 pt-0 space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              {loadingMeaning ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 text-teal-600 animate-spin" />
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-slate-900 mb-2">Meaning</h3>
                  <div className="text-slate-700 whitespace-pre-line">
                    {currentWord?.meaning || 'Could not fetch definition. The word may not be in the dictionary.'}
                  </div>
                  {currentWord?.etymology && (
                    <>
                      <h3 className="font-semibold text-slate-900 mt-4 mb-2">Etymology</h3>
                      <p className="text-slate-600 text-sm">{currentWord.etymology}</p>
                    </>
                  )}
                  {currentWord?.usage_example && (
                    <>
                      <h3 className="font-semibold text-slate-900 mt-4 mb-2">Usage</h3>
                      <p className="text-slate-600 text-sm italic">"{currentWord.usage_example}"</p>
                    </>
                  )}
                </>
              )}
            </div>

            <div>
              <p className="text-sm text-slate-600 mb-3 text-center">How well did you know this?</p>
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as FSRSRating[]).map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleRate(rating)}
                    disabled={reviewing}
                    className={`py-3 px-2 rounded-lg text-white font-medium transition-all hover:scale-105 disabled:opacity-50 ${getRatingColor(rating)}`}
                  >
                    <div className="text-sm">{getRatingLabel(rating)}</div>
                    <div className="text-xs opacity-80 mt-0.5">{getNextIntervalPreview(rating, currentCard)}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
