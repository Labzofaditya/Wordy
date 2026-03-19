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

function extractDefinition(entry: MWEntry): string {
  if (entry.shortdef && entry.shortdef.length > 0) {
    return entry.shortdef[0];
  }
  return "";
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
    const { word, api_key } = await req.json();

    if (!word || !api_key) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: word, api_key" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mwUrl = `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word.toLowerCase())}?key=${api_key}`;

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

    const entry = data[0] as MWEntry;
    const meaning = extractDefinition(entry);
    const etymology = extractEtymology(entry);

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
