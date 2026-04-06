import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = Deno.env.get("MW_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Dictionary service not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { word } = await req.json();

    if (!word) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: word" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mwUrl = `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word.toLowerCase())}?key=${apiKey}`;

    const response = await fetch(mwUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Merriam-Webster API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Merriam-Webster API error: ${response.status}`, details: errorText }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ meaning: "", etymology: "", error: "Word not found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (typeof data[0] === "string") {
      return new Response(
        JSON.stringify({ meaning: "", etymology: "", suggestions: data }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
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

    const meaning = allMeanings.join("\n");

    return new Response(
      JSON.stringify({ meaning, etymology }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
