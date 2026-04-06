import { useState, useEffect } from 'react';
import { Save, Volume2, Loader2, Check, AlertCircle, BookOpen } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

export function Settings() {
  const { settings, loading, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pronunciationAccent, setPronunciationAccent] = useState<'american' | 'british' | 'indian'>('american');
  const [showBookTitle, setShowBookTitle] = useState(false);

  useEffect(() => {
    if (settings) {
      setPronunciationAccent(settings.pronunciation_accent);
      setShowBookTitle(settings.show_book_title);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updateSettings({
        pronunciation_accent: pronunciationAccent,
        show_book_title: showBookTitle,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Configure your learning preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Pronunciation</h2>
              <p className="text-sm text-slate-500">Choose your preferred accent</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Accent
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="accent"
                  value="american"
                  checked={pronunciationAccent === 'american'}
                  onChange={() => setPronunciationAccent('american')}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-slate-700">American</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="accent"
                  value="british"
                  checked={pronunciationAccent === 'british'}
                  onChange={() => setPronunciationAccent('british')}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-slate-700">British</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="accent"
                  value="indian"
                  checked={pronunciationAccent === 'indian'}
                  onChange={() => setPronunciationAccent('indian')}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-slate-700">Indian</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Display</h2>
              <p className="text-sm text-slate-500">Customize flashcard appearance</p>
            </div>
          </div>

          <label className="flex items-center justify-between p-4 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
            <div>
              <span className="text-slate-700 font-medium">Show book title</span>
              <p className="text-xs text-slate-500 mt-0.5">Display the source book name on flashcards</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showBookTitle}
              onClick={() => setShowBookTitle(!showBookTitle)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                showBookTitle ? 'bg-teal-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showBookTitle ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700">
          <Check className="h-5 w-5 flex-shrink-0" />
          Settings saved successfully
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 focus:ring-4 focus:ring-teal-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Save className="h-5 w-5" />
        )}
        Save Settings
      </button>
    </div>
  );
}
