import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_WORD_LENGTH = 100;
const VALID_ACCENTS = new Set(["american", "british", "indian"]);

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getAllowedOrigin(reqOrigin: string | null): string {
  if (ALLOWED_ORIGINS.length === 0) return "*";
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
  return ALLOWED_ORIGINS[0];
}

function buildCorsHeaders(reqOrigin: string | null) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(reqOrigin),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
}

function getVoiceForAccent(accent: string): string {
  switch (accent) {
    case "british": return "fable";
    case "indian":  return "echo";
    default:        return "nova";
  }
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
      p_endpoint: "tts-proxy",
      p_minute_limit: 10,
      p_day_limit: 200,
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
      return new Response(JSON.stringify({ error: "TTS not configured" }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const word = typeof body?.word === "string" ? body.word.trim() : "";
    const accent = typeof body?.accent === "string" && VALID_ACCENTS.has(body.accent)
      ? body.accent
      : "american";

    if (!word) {
      return new Response(JSON.stringify({ error: "Missing required parameter: word" }), {
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

    const voice = getVoiceForAccent(accent);

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "tts-1", input: word, voice }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI TTS error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI TTS error: ${response.status}` }),
        { status: response.status, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      headers: { ...cors, "Content-Type": "audio/mpeg" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...(buildCorsHeaders(req.headers.get("Origin"))), "Content-Type": "application/json" } }
    );
  }
});
