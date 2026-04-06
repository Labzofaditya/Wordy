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

function getLanguageCode(accent: string): string {
  switch (accent) {
    case 'british':
      return 'en-GB';
    case 'indian':
      return 'en-IN';
    default:
      return 'en-US';
  }
}

export async function playPronunciation(
  word: string,
  accent: 'american' | 'british' | 'indian'
): Promise<void> {
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
