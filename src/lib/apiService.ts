import type { UserSettings } from '../types';

export async function fetchOEDDefinition(
  word: string,
  apiKey: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<{ meaning: string; etymology: string } | null> {
  try {
    const [app_id, app_key] = apiKey.includes(':')
      ? apiKey.split(':')
      : ['', apiKey];

    const response = await fetch(
      `${supabaseUrl}/functions/v1/oed-proxy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ word, app_id, app_key }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OED API error:', response.status, errorData);
      return null;
    }

    const data = await response.json();
    return { meaning: data.meaning || '', etymology: data.etymology || '' };
  } catch (error) {
    console.error('Failed to fetch OED definition:', error);
    return null;
  }
}

export async function generatePronunciationOpenAI(
  word: string,
  apiKey: string,
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova'
): Promise<Blob | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: word,
        voice: voice,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI TTS error:', response.status);
      return null;
    }

    return await response.blob();
  } catch (error) {
    console.error('Failed to generate pronunciation:', error);
    return null;
  }
}

export async function generatePronunciationGoogle(
  word: string,
  apiKey: string,
  languageCode: string = 'en-US'
): Promise<Blob | null> {
  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: word },
          voice: { languageCode, ssmlGender: 'FEMALE' },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      }
    );

    if (!response.ok) {
      console.error('Google TTS error:', response.status);
      return null;
    }

    const data = await response.json();
    const audioContent = data.audioContent;

    const binaryString = atob(audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'audio/mp3' });
  } catch (error) {
    console.error('Failed to generate pronunciation:', error);
    return null;
  }
}

export async function getAIFeedbackOpenAI(
  word: string,
  spoken: string,
  mode: 'pronunciation' | 'sentence',
  apiKey: string
): Promise<string> {
  const prompt = mode === 'pronunciation'
    ? `The user tried to pronounce the word "${word}" and said "${spoken}".
       Provide brief, encouraging feedback on their pronunciation.
       If they got it right, congratulate them.
       If there were issues, gently point them out and suggest improvements.
       Keep response under 50 words.`
    : `The user was asked to use the word "${word}" in a sentence and said: "${spoken}".
       Evaluate their sentence for:
       1. Correct usage of the word
       2. Grammar
       3. Context appropriateness
       Give brief, constructive feedback. Keep response under 75 words.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a friendly vocabulary tutor helping users learn new words.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Failed to get AI feedback:', error);
    throw error;
  }
}

export async function getAIFeedbackGoogle(
  word: string,
  spoken: string,
  mode: 'pronunciation' | 'sentence',
  apiKey: string
): Promise<string> {
  const prompt = mode === 'pronunciation'
    ? `The user tried to pronounce the word "${word}" and said "${spoken}". Provide brief feedback.`
    : `The user used the word "${word}" in: "${spoken}". Evaluate usage and grammar briefly.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to provide feedback.';
  } catch (error) {
    console.error('Failed to get AI feedback:', error);
    throw error;
  }
}

export function getAccentConfig(accent: string): { voice: string; languageCode: string } {
  switch (accent) {
    case 'british':
      return { voice: 'fable', languageCode: 'en-GB' };
    case 'indian':
      return { voice: 'echo', languageCode: 'en-IN' };
    default:
      return { voice: 'nova', languageCode: 'en-US' };
  }
}

export async function playPronunciation(
  word: string,
  settings: UserSettings
): Promise<void> {
  const { voice, languageCode } = getAccentConfig(settings.pronunciation_accent);
  let audioBlob: Blob | null = null;

  if (settings.pronunciation_provider === 'openai' && settings.openai_api_key) {
    audioBlob = await generatePronunciationOpenAI(
      word,
      settings.openai_api_key,
      voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    );
  } else if (settings.pronunciation_provider === 'google' && settings.google_api_key) {
    audioBlob = await generatePronunciationGoogle(word, settings.google_api_key, languageCode);
  }

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
  mode: 'pronunciation' | 'sentence',
  settings: UserSettings
): Promise<string> {
  if (settings.ai_feedback_provider === 'openai' && settings.openai_api_key) {
    return getAIFeedbackOpenAI(word, spoken, mode, settings.openai_api_key);
  } else if (settings.ai_feedback_provider === 'google' && settings.google_api_key) {
    return getAIFeedbackGoogle(word, spoken, mode, settings.google_api_key);
  }
  throw new Error('No AI provider configured. Please add an API key in settings.');
}
