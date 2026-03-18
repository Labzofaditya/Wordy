import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { word, app_id, app_key } = await req.json();

    if (!word || !app_id || !app_key) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: word, app_id, app_key" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const oedUrl = `https://od-api.oxforddictionaries.com/api/v2/entries/en-us/${encodeURIComponent(word.toLowerCase())}`;
    console.log("Fetching from OED:", oedUrl);

    const response = await fetch(oedUrl, {
      headers: {
        "app_id": app_id,
        "app_key": app_key,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OED API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OED API error: ${response.status}`, details: errorText }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const entry = data.results?.[0]?.lexicalEntries?.[0]?.entries?.[0];

    const meaning = entry?.senses?.[0]?.definitions?.[0] || "";
    const etymology = entry?.etymologies?.[0] || "";

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
