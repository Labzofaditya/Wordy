import { supabase } from './supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const MAX_WORD_LENGTH = 100;
const MAX_SPOKEN_LENGTH = 500;

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function fetchMWDefinition(
  word: string
): Promise<{ meaning: string; etymology: string } | null> {
  try {
    const token = await getToken();
    if (!token) return null;

    const trimmed = word.trim().slice(0, MAX_WORD_LENGTH);

    const response = await fetch(`${supabaseUrl}/functions/v1/mw-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word: trimmed }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('MW API error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.warn('MW lookup:', trimmed, data.error, data.suggestions?.slice(0, 3));
    }
    return { meaning: data.meaning || '', etymology: data.etymology || '' };
  } catch (error) {
    console.error('MW fetch failed:', error);
    return null;
  }
}

function getLanguageCode(accent: string): string {
  switch (accent) {
    case 'british': return 'en-GB';
    case 'indian':  return 'en-IN';
    default:        return 'en-US';
  }
}

export async function playPronunciation(
  word: string,
  accent: 'american' | 'british' | 'indian'
): Promise<void> {
  try {
    const token = await getToken();
    if (!token) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = getLanguageCode(accent);
      speechSynthesis.speak(utterance);
      return;
    }

    const trimmed = word.trim().slice(0, MAX_WORD_LENGTH);

    const response = await fetch(`${supabaseUrl}/functions/v1/tts-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word: trimmed, accent }),
    });

    if (response.ok) {
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      await audio.play();
      audio.onended = () => URL.revokeObjectURL(audioUrl);
      return;
    }

    const errorData = await response.json().catch(() => ({}));
    if (errorData.error !== 'TTS not configured') {
      console.error('TTS proxy error:', response.status, errorData);
    }
  } catch (error) {
    console.error('Failed to generate pronunciation:', error);
  }

  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = getLanguageCode(accent);
  speechSynthesis.speak(utterance);
}

export async function getSpeechFeedback(
  word: string,
  spoken: string,
  mode: 'pronunciation' | 'sentence'
): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error('Not authenticated');

  const trimmedWord   = word.trim().slice(0, MAX_WORD_LENGTH);
  const trimmedSpoken = spoken.trim().slice(0, MAX_SPOKEN_LENGTH);

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-feedback-proxy`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ word: trimmedWord, spoken: trimmedSpoken, mode }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.error === 'AI feedback not configured') {
      throw new Error('AI feedback is not configured on the server.');
    }
    throw new Error(errorData.error || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.feedback;
}
