// Multi-model visibility via OpenRouter. Optional: when OPENROUTER_API_KEY is
// set, each buying query is also asked to GPT-4o with web search (":online"),
// so reports can honestly show per-assistant results. Skipped when unset.
const MODEL = process.env.OPENROUTER_VISIBILITY_MODEL || "openai/gpt-4o:online";

// Label shown in reports for this assistant's answers.
export const OPENROUTER_ASSISTANT_LABEL = "ChatGPT (GPT-4o)";

export function openRouterEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function askOpenRouter(consumerPrompt: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        "HTTP-Referer": "https://aisearchhelpers.com",
        "X-Title": "AI Search Helpers",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: consumerPrompt }],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      console.warn(`[openrouter] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn("[openrouter] request failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
