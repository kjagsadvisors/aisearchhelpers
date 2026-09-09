// Multi-model visibility via OpenRouter. Optional: skipped when
// OPENROUTER_API_KEY is unset. The assistant lineup is configurable via
// OPENROUTER_MODELS as comma-separated "model|Label" pairs, e.g.
//   OPENROUTER_MODELS=openai/gpt-4o:online|ChatGPT (GPT-4o),meta-llama/llama-3.3-70b-instruct:free|Llama 3.3 (free)
// ":free" models cost $0 per token but have NO web search: they answer from
// model knowledge only, which tests brand recognition, not live AI search.
// Labels for search-less models should say so; the report shows them as-is.

export interface OpenRouterModel {
  model: string;
  label: string;
}

const DEFAULT_MODELS = "openai/gpt-4o:online|ChatGPT (GPT-4o)";

export function openRouterModels(): OpenRouterModel[] {
  if (!process.env.OPENROUTER_API_KEY) return [];
  const raw = process.env.OPENROUTER_MODELS || DEFAULT_MODELS;
  return raw
    .split(",")
    .map((entry) => {
      const [model, label] = entry.split("|").map((x) => x.trim());
      if (!model) return null;
      return { model, label: label || model };
    })
    .filter((m): m is OpenRouterModel => m !== null);
}

export async function askOpenRouter(model: string, consumerPrompt: string): Promise<string | null> {
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
        model,
        messages: [{ role: "user", content: consumerPrompt }],
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      console.warn(`[openrouter] ${model} HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.warn(`[openrouter] ${model} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}
