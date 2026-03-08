// Simple test: one Anthropic call. Secrets: ANTHROPIC_API_KEY (Supabase Edge Function Secrets)

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

const DEFAULT_QUESTION =
  "What are the second-order impacts of Iran blocking the Hormuz Strait? Give a short, structured analysis (3–5 bullet points).";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "ANTHROPIC_API_KEY not set. Add it in Supabase Dashboard → Edge Functions → Secrets.",
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let question = DEFAULT_QUESTION;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.question && typeof body.question === "string") question = body.question;
    } catch {
      // keep default
    }
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: "You are a concise analyst. Answer in clear, short bullet points.",
      messages: [{ role: "user", content: question }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(
      JSON.stringify({ error: `Anthropic API error: ${res.status}`, detail: err }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  return new Response(
    JSON.stringify({ question, analysis: text }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
});
