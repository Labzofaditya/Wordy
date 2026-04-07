import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_WORD_LENGTH = 100;

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

interface MWEntry {
  meta?: { id?: string };
  fl?: string;
  shortdef?: string[];
  def?: Array<{ sseq?: Array<Array<Array<unknown>>> }>;
  et?: Array<Array<unknown>>;
}

function extractDefinitions(entry: MWEntry): string[] {
  if (entry.shortdef && entry.shortdef.length > 0) {
    return entry.shortdef;
  }
  return [];
}

function extractEtymology(entry: MWEntry): string {
  if (!entry.et || entry.et.length === 0) return "";
  const etParts: string[] = [];
  for (const part of entry.et) {
    if (Array.isArray(part) && part[0] === "text" && typeof part[1] === "string") {
      let text = part[1] as string;
      text = text.replace(/\{it\}/g, "").replace(/\{\/it\}/g, "");
      text = text.replace(/\{.*?\}/g, "");
      etParts.push(text);
    }
  }
  return etParts.join(" ").trim();
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
      p_endpoint: "mw-proxy",
      p_minute_limit: 20,
      p_day_limit: 500,
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

    const apiKey = Deno.env.get("MW_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Dictionary service not configured" }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const word = typeof body?.word === "string" ? body.word.trim() : "";

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

    const mwUrl = `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word.toLowerCase())}?key=${apiKey}`;
    const response = await fetch(mwUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Merriam-Webster API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Merriam-Webster API error: ${response.status}` }),
        { status: response.status, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ meaning: "", etymology: "", error: "Word not found" }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (typeof data[0] === "string") {
      return new Response(
        JSON.stringify({ meaning: "", etymology: "", suggestions: data }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const allMeanings: string[] = [];
    let etymology = "";

    for (const item of data) {
      if (typeof item === "object" && item !== null) {
        const entry = item as MWEntry;
        const partOfSpeech = entry.fl || "";
        const definitions = extractDefinitions(entry);
        if (definitions.length > 0) {
          const prefix = partOfSpeech ? `(${partOfSpeech}) ` : "";
          definitions.forEach((def, idx) => {
            allMeanings.push(`${prefix}${idx + 1}. ${def}`);
          });
        }
        if (!etymology && entry.et) {
          etymology = extractEtymology(entry);
        }
      }
    }

    return new Response(
      JSON.stringify({ meaning: allMeanings.join("\n"), etymology }),
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
