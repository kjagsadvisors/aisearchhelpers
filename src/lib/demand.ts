// Real-demand grounding for buying queries. Google Autocomplete suggestions
// only exist because real people type them - we use them as evidence of actual
// search demand around the business's services, then phrase the AI-assistant
// queries from that evidence instead of inventing them.
import type { Profile } from "./types";

async function autocomplete(seed: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(seed)}`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as unknown[];
    const suggestions = data[1];
    return Array.isArray(suggestions) ? suggestions.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function seedsFor(profile: Profile): string[] {
  const location = profile.location !== "unknown" ? profile.location : "";
  const city = location.split(",")[0]?.trim() ?? "";
  const seeds = new Set<string>();
  for (const service of profile.services.slice(0, 5)) {
    const s = service.toLowerCase();
    seeds.add(`best ${s}`);
    seeds.add(`${s} near me`);
    if (city) {
      seeds.add(`${s} ${city.toLowerCase()}`);
      seeds.add(`best ${s} in ${city.toLowerCase()}`);
    }
    seeds.add(`how much does ${s} cost`);
    seeds.add(`who does ${s}`);
  }
  seeds.add(`best ${profile.category.toLowerCase()}`);
  if (city) seeds.add(`${profile.category.toLowerCase()} ${city.toLowerCase()}`);
  return [...seeds].slice(0, 18);
}

// Returns real search phrases with their seeds, deduped, most relevant first.
export async function realDemandPhrases(
  profile: Profile
): Promise<{ phrase: string; seed: string }[]> {
  const seeds = seedsFor(profile);
  const results: { phrase: string; seed: string }[] = [];
  const seen = new Set<string>();
  // small concurrency; endpoint is fast and unauthenticated
  const chunks: string[][] = [];
  for (let i = 0; i < seeds.length; i += 6) chunks.push(seeds.slice(i, i + 6));
  for (const chunk of chunks) {
    const batches = await Promise.all(chunk.map(async (seed) => ({ seed, phrases: await autocomplete(seed) })));
    for (const { seed, phrases } of batches) {
      for (const phrase of phrases) {
        const key = phrase.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push({ phrase, seed });
        }
      }
    }
  }
  return results.slice(0, 120);
}
