import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_WORD_LENGTH = 100;
const MAX_SPOKEN_LENGTH = 500;
const VALID_MODES = new Set(["pronunciation", "sentence"]);

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getAllowedOrigin(reqOrigin: string | null): string | null {
  if (ALLOWED_ORIGINS.length === 0) return "*";
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return null;
}

function buildCorsHeaders(reqOrigin: string | null) {
  const origin = getAllowedOrigin(reqOrigin);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

function buildPrompt(word: string, spoken: string, mode: string): string {
  if (mode === "pronunciation") {
    return `The user tried to pronounce the word "${word}" and said "${spoken}".
Provide brief, encouraging feedback on their pronunciation.
If they got it right, congratulate them.
If there were issues, gently point them out and suggest improvements.
Keep response under 50 words.`;
  }
  return `The user was asked to use the word "${word}" in a sentence and said: "${spoken}".
Evaluate their sentence for:
1. Correct usage of the word
2. Grammar
3. Context appropriateness
Give brief, constructive feedback. Keep response under 75 words.`;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const cors = buildCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: rateCheck, error: rateError } = await supabase.rpc("check_and_log_api_usage", {
      p_endpoint: "ai-feedback-proxy",
      p_minute_limit: 10,
      p_day_limit: 100,
    });

    if (rateError || !rateCheck?.allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
        status: 429,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck?.retry_after ?? 60),
        },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI feedback not configured" }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const word   = typeof body?.word   === "string" ? body.word.trim()   : "";
    const spoken = typeof body?.spoken === "string" ? body.spoken.trim() : "";
    const mode   = typeof body?.mode   === "string" ? body.mode.trim()   : "";

    if (!word || !spoken || !mode) {
      return new Response(JSON.stringify({ error: "Missing required parameters: word, spoken, mode" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (word.length > MAX_WORD_LENGTH) {
      return new Response(JSON.stringify({ error: `word exceeds maximum length of ${MAX_WORD_LENGTH}` }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (spoken.length > MAX_SPOKEN_LENGTH) {
      return new Response(JSON.stringify({ error: `spoken text exceeds maximum length of ${MAX_SPOKEN_LENGTH}` }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!VALID_MODES.has(mode)) {
      return new Response(JSON.stringify({ error: "Invalid mode. Must be 'pronunciation' or 'sentence'" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(word, spoken, mode);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a friendly vocabulary tutor helping users learn new words." },
          { role: "user", content: prompt },
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", response.status, errorData);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
        { status: response.status, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content || "Unable to provide feedback.";

    return new Response(
      JSON.stringify({ feedback }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...(buildCorsHeaders(req.headers.get("Origin"))), "Content-Type": "application/json" } }
    );
  }
});
