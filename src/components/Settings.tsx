import { useState, useEffect } from 'react';
import { Save, Key, Volume2, Brain, Loader2, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

export function Settings() {
  const { settings, loading, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oedApiKey, setOedApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [pronunciationProvider, setPronunciationProvider] = useState<'openai' | 'google'>('openai');
  const [pronunciationAccent, setPronunciationAccent] = useState<'american' | 'british' | 'indian'>('american');
  const [aiFeedbackProvider, setAiFeedbackProvider] = useState<'openai' | 'google'>('openai');

  const [showOed, setShowOed] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

  useEffect(() => {
    if (settings) {
      setOedApiKey(settings.oed_api_key || '');
      setOpenaiApiKey(settings.openai_api_key || '');
      setGoogleApiKey(settings.google_api_key || '');
      setPronunciationProvider(settings.pronunciation_provider);
      setPronunciationAccent(settings.pronunciation_accent);
      setAiFeedbackProvider(settings.ai_feedback_provider);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await updateSettings({
        oed_api_key: oedApiKey || null,
        openai_api_key: openaiApiKey || null,
        google_api_key: googleApiKey || null,
        pronunciation_provider: pronunciationProvider,
        pronunciation_accent: pronunciationAccent,
        ai_feedback_provider: aiFeedbackProvider,
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
        <p className="text-slate-600 mt-1">Configure your API keys and preferences</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Key className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">API Keys</h2>
              <p className="text-sm text-slate-500">Connect external services for definitions and audio</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Oxford English Dictionary API Key
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Format: app_id:app_key (get from developer.oxforddictionaries.com)
              </p>
              <div className="relative">
                <input
                  type={showOed ? 'text' : 'password'}
                  value={oedApiKey}
                  onChange={(e) => setOedApiKey(e.target.value)}
                  className="w-full pr-10 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="app_id:app_key"
                />
                <button
                  type="button"
                  onClick={() => setShowOed(!showOed)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showOed ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                OpenAI API Key
              </label>
              <p className="text-xs text-slate-500 mb-2">
                For text-to-speech and AI feedback (platform.openai.com)
              </p>
              <div className="relative">
                <input
                  type={showOpenai ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  className="w-full pr-10 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowOpenai(!showOpenai)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showOpenai ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Google Cloud API Key
              </label>
              <p className="text-xs text-slate-500 mb-2">
                For text-to-speech and Gemini AI (console.cloud.google.com)
              </p>
              <div className="relative">
                <input
                  type={showGoogle ? 'text' : 'password'}
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="w-full pr-10 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                  placeholder="AIza..."
                />
                <button
                  type="button"
                  onClick={() => setShowGoogle(!showGoogle)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showGoogle ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Volume2 className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Pronunciation</h2>
              <p className="text-sm text-slate-500">Choose your preferred voice settings</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Voice Provider
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="pronunciation_provider"
                    value="openai"
                    checked={pronunciationProvider === 'openai'}
                    onChange={() => setPronunciationProvider('openai')}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-700">OpenAI</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  <input
                    type="radio"
                    name="pronunciation_provider"
                    value="google"
                    checked={pronunciationProvider === 'google'}
                    onChange={() => setPronunciationProvider('google')}
                    className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-slate-700">Google</span>
                </label>
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
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Brain className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">AI Feedback</h2>
              <p className="text-sm text-slate-500">Choose AI provider for speech feedback</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="ai_provider"
                value="openai"
                checked={aiFeedbackProvider === 'openai'}
                onChange={() => setAiFeedbackProvider('openai')}
                className="w-4 h-4 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="text-slate-700 font-medium">OpenAI (GPT-4o-mini)</span>
                <p className="text-xs text-slate-500">Fast and accurate feedback</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="ai_provider"
                value="google"
                checked={aiFeedbackProvider === 'google'}
                onChange={() => setAiFeedbackProvider('google')}
                className="w-4 h-4 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="text-slate-700 font-medium">Google (Gemini)</span>
                <p className="text-xs text-slate-500">Alternative AI provider</p>
              </div>
            </label>
          </div>
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
