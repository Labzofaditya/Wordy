import type { UserSettings } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function fetchMWDefinition(
  word: string
): Promise<{ meaning: string; etymology: string } | null> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/mw-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('MW API error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.warn('MW lookup:', word, data.error, data.suggestions?.slice(0, 3));
    }
    return { meaning: data.meaning || '', etymology: data.etymology || '' };
  } catch (error) {
    console.error('MW fetch failed:', error);
    return null;
  }
}

async function generatePronunciationViaProxy(
  word: string,
  accent: string
): Promise<Blob | null> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/tts-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, accent }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error === 'TTS not configured') {
        return null;
      }
      console.error('TTS proxy error:', response.status, errorData);
      return null;
    }

    return await response.blob();
  } catch (error) {
    console.error('Failed to generate pronunciation:', error);
    return null;
  }
}

async function getAIFeedbackViaProxy(
  word: string,
  spoken: string,
  mode: 'pronunciation' | 'sentence'
): Promise<string> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/ai-feedback-proxy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ word, spoken, mode }),
    }
  );

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

export function getAccentConfig(accent: string): { languageCode: string } {
  switch (accent) {
    case 'british':
      return { languageCode: 'en-GB' };
    case 'indian':
      return { languageCode: 'en-IN' };
    default:
      return { languageCode: 'en-US' };
  }
}

export async function playPronunciation(
  word: string,
  settings: UserSettings
): Promise<void> {
  const { languageCode } = getAccentConfig(settings.pronunciation_accent);

  const audioBlob = await generatePronunciationViaProxy(word, settings.pronunciation_accent);

  if (audioBlob) {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    await audio.play();
    audio.onended = () => URL.revokeObjectURL(audioUrl);
  } else {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = languageCode;
    speechSynthesis.speak(utterance);
  }
}

export async function getSpeechFeedback(
  word: string,
  spoken: string,
  mode: 'pronunciation' | 'sentence'
): Promise<string> {
  return getAIFeedbackViaProxy(word, spoken, mode);
}
