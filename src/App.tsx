import { useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { WordLibrary } from './components/WordLibrary';
import { FileUpload } from './components/FileUpload';
import { Flashcards } from './components/Flashcards';
import { Settings } from './components/Settings';
import { useSettings } from './hooks/useSettings';
import { useRouter } from './hooks/useRouter';
import { fetchMWDefinition, playPronunciation, getSpeechFeedback } from './lib/apiService';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const { currentPage, navigate } = useRouter();

  const handleFetchMeaning = useCallback(async (word: string) => {
    return fetchMWDefinition(word);
  }, []);

  const handlePlayPronunciation = useCallback(async (word: string) => {
    const accent = settings?.pronunciation_accent || 'american';
    await playPronunciation(word, accent);
  }, [settings?.pronunciation_accent]);

  const handleSpeechFeedback = useCallback(async (
    word: string,
    spoken: string,
    mode: 'pronunciation' | 'sentence'
  ) => {
    return getSpeechFeedback(word, spoken, mode);
  }, []);

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
        return <Dashboard onNavigate={navigate} />;
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
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={navigate}>
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
