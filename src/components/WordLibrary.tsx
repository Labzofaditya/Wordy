import { useState, useMemo } from 'react';
import { Search, Trash2, BookOpen, CheckCircle2, Clock, Sparkles, Pencil, Check, X } from 'lucide-react';
import { useWords } from '../hooks/useWords';
import type { WordWithProgress } from '../types';

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'progress';
type FilterOption = 'all' | 'new' | 'learning' | 'mastered';

export function WordLibrary() {
  const { words, loading, deleteWord, updateWordSpelling } = useWords();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredWords = useMemo(() => {
    let result = [...words];

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (w) =>
          w.word.toLowerCase().includes(searchLower) ||
          w.book_title?.toLowerCase().includes(searchLower) ||
          w.meaning?.toLowerCase().includes(searchLower)
      );
    }

    if (filterBy !== 'all') {
      result = result.filter((w) => {
        if (filterBy === 'mastered') return w.progress?.mastered;
        if (filterBy === 'learning') return w.progress && !w.progress.mastered && w.progress.repetitions > 0;
        if (filterBy === 'new') return !w.progress || w.progress.repetitions === 0;
        return true;
      });
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'alphabetical':
          return a.word.localeCompare(b.word);
        case 'progress':
          const aReps = a.progress?.repetitions || 0;
          const bReps = b.progress?.repetitions || 0;
          return bReps - aReps;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [words, search, sortBy, filterBy]);

  const handleDelete = async (wordId: string) => {
    if (!confirm('Are you sure you want to delete this word?')) return;
    setDeleting(wordId);
    try {
      await deleteWord(wordId);
    } finally {
      setDeleting(null);
    }
  };

  const handleStartEdit = (word: WordWithProgress) => {
    setEditingId(word.id);
    setEditValue(word.word);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleSaveEdit = async (wordId: string) => {
    if (!editValue.trim()) return;
    setSaving(true);
    try {
      await updateWordSpelling(wordId, editValue);
      setEditingId(null);
      setEditValue('');
    } catch (err) {
      console.error('Failed to update word:', err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (word: WordWithProgress) => {
    if (word.progress?.mastered) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
          <CheckCircle2 className="h-3 w-3" />
          Mastered
        </span>
      );
    }
    if (word.progress && word.progress.repetitions > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
          <Clock className="h-3 w-3" />
          Learning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
        <Sparkles className="h-3 w-3" />
        New
      </span>
    );
  };

  const stats = useMemo(() => {
    const mastered = words.filter((w) => w.progress?.mastered).length;
    const learning = words.filter((w) => w.progress && !w.progress.mastered && w.progress.repetitions > 0).length;
    const newWords = words.length - mastered - learning;
    return { mastered, learning, new: newWords, total: words.length };
  }, [words]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Words</h1>
        <p className="text-slate-600 mt-1">{stats.total} words in your library</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setFilterBy('all')}
          className={`p-4 rounded-xl border transition-all ${
            filterBy === 'all' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-sm text-slate-600">Total</p>
        </button>
        <button
          onClick={() => setFilterBy('new')}
          className={`p-4 rounded-xl border transition-all ${
            filterBy === 'new' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
          <p className="text-sm text-slate-600">New</p>
        </button>
        <button
          onClick={() => setFilterBy('learning')}
          className={`p-4 rounded-xl border transition-all ${
            filterBy === 'learning' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-2xl font-bold text-amber-600">{stats.learning}</p>
          <p className="text-sm text-slate-600">Learning</p>
        </button>
        <button
          onClick={() => setFilterBy('mastered')}
          className={`p-4 rounded-xl border transition-all ${
            filterBy === 'mastered' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <p className="text-2xl font-bold text-emerald-600">{stats.mastered}</p>
          <p className="text-sm text-slate-600">Mastered</p>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search words, books, meanings..."
            className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="alphabetical">A to Z</option>
          <option value="progress">By Progress</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-500">Loading words...</p>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No words found</p>
          <p className="text-slate-500 text-sm mt-1">
            {search ? 'Try a different search term' : 'Import your Kindle vocabulary to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredWords.map((word) => (
              <div
                key={word.id}
                className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    {editingId === word.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(word.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="flex-1 px-3 py-1.5 border border-teal-500 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-lg font-semibold"
                          autoFocus
                          disabled={saving}
                        />
                        <button
                          onClick={() => handleSaveEdit(word.id)}
                          disabled={saving || !editValue.trim()}
                          className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={saving}
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold text-slate-900 text-lg">{word.word}</h3>
                        <button
                          onClick={() => handleStartEdit(word)}
                          className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                          title="Edit spelling"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {getStatusBadge(word)}
                      </>
                    )}
                  </div>
                  {word.meaning && (
                    <p className="text-slate-600 text-sm line-clamp-2 mb-2">{word.meaning}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    {word.book_title && (
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {word.book_title}
                      </span>
                    )}
                    {word.progress && (
                      <span>
                        {word.progress.repetitions} reviews
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(word.id)}
                  disabled={deleting === word.id || editingId === word.id}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
