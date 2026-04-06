import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI feedback not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { word, spoken, mode } = await req.json();

    if (!word || !spoken || !mode) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: word, spoken, mode" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (mode !== "pronunciation" && mode !== "sentence") {
      return new Response(
        JSON.stringify({ error: "Invalid mode. Must be 'pronunciation' or 'sentence'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const feedback = data.choices?.[0]?.message?.content || "Unable to provide feedback.";

    return new Response(
      JSON.stringify({ feedback }),
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
