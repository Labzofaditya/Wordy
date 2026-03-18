import { useState, useEffect } from 'react';
import {
  BookOpen,
  Trophy,
  Target,
  TrendingUp,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { useLearning } from '../hooks/useLearning';
import { useWords } from '../hooks/useWords';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { getStats } = useLearning();
  const { words } = useWords();
  const [stats, setStats] = useState<{ total: number; mastered: number; dueForReview: number } | null>(null);

  useEffect(() => {
    getStats().then(setStats);
  }, [getStats, words]);

  const progressPercent = stats && stats.total > 0
    ? Math.round((stats.mastered / stats.total) * 100)
    : 0;

  const recentWords = words.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Track your vocabulary learning progress</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-sm text-slate-600">Total Words</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{stats?.total || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Trophy className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="text-sm text-slate-600">Mastered</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats?.mastered || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Target className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm text-slate-600">Due for Review</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{stats?.dueForReview || 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-slate-600">Progress</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{progressPercent}%</p>
        </div>
      </div>

      {stats && stats.dueForReview > 0 && (
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-1">Time to Practice!</h2>
              <p className="text-teal-100">
                You have {stats.dueForReview} words due for review
              </p>
            </div>
            <button
              onClick={() => onNavigate('flashcards')}
              className="px-6 py-3 bg-white text-teal-600 font-medium rounded-lg hover:bg-teal-50 transition-colors flex items-center gap-2"
            >
              Start Review
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Learning Progress</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-600">Overall Progress</span>
                <span className="font-medium text-slate-900">{progressPercent}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-lg font-bold text-blue-600">
                    {(stats?.total || 0) - (stats?.mastered || 0) - (stats?.dueForReview || 0)}
                  </span>
                </div>
                <p className="text-xs text-slate-600">New</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-lg font-bold text-amber-600">
                    {stats?.dueForReview || 0}
                  </span>
                </div>
                <p className="text-xs text-slate-600">Learning</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-lg font-bold text-emerald-600">
                    {stats?.mastered || 0}
                  </span>
                </div>
                <p className="text-xs text-slate-600">Mastered</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Recent Words</h2>
            <button
              onClick={() => onNavigate('library')}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              View All
            </button>
          </div>
          {recentWords.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No words yet</p>
              <button
                onClick={() => onNavigate('upload')}
                className="mt-3 text-teal-600 hover:text-teal-700 text-sm font-medium"
              >
                Import your vocabulary
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentWords.map((word) => (
                <div
                  key={word.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-slate-900">{word.word}</p>
                    {word.book_title && (
                      <p className="text-xs text-slate-500">{word.book_title}</p>
                    )}
                  </div>
                  {word.progress?.mastered ? (
                    <Trophy className="h-4 w-4 text-emerald-500" />
                  ) : word.progress?.repetitions ? (
                    <Flame className="h-4 w-4 text-amber-500" />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
