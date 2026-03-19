import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { WordLibrary } from './components/WordLibrary';
import { FileUpload } from './components/FileUpload';
import { Flashcards } from './components/Flashcards';
import { Settings } from './components/Settings';
import { useSettings } from './hooks/useSettings';
import { fetchMWDefinition, playPronunciation, getSpeechFeedback } from './lib/apiService';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleFetchMeaning = useCallback(async (word: string) => {
    if (!settings?.mw_api_key) return null;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const result = await fetchMWDefinition(word, settings.mw_api_key, supabaseUrl, supabaseAnonKey);
    return result;
  }, [settings?.mw_api_key]);

  const handlePlayPronunciation = useCallback(async (word: string) => {
    if (!settings) return;
    await playPronunciation(word, settings);
  }, [settings]);

  const handleSpeechFeedback = useCallback(async (
    word: string,
    spoken: string,
    mode: 'pronunciation' | 'sentence'
  ) => {
    if (!settings) throw new Error('Settings not loaded');
    return getSpeechFeedback(word, spoken, mode, settings);
  }, [settings]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'library':
        return <WordLibrary />;
      case 'upload':
        return <FileUpload />;
      case 'flashcards':
        return (
          <Flashcards
            onFetchMeaning={handleFetchMeaning}
            onPlayPronunciation={handlePlayPronunciation}
            onSpeechFeedback={handleSpeechFeedback}
          />
        );
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
