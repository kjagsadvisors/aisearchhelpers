import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { crawl, type CrawlResult } from "./crawl";
import { store } from "./store";
import { sendReportEmail } from "./email";
import {
  ProfileSchema,
  QueryPlanSchema,
  ReportSchema,
  type Profile,
  type QueryPlan,
  type Report,
} from "./types";
import { realDemandPhrases } from "./demand";
import { fetchAgenticReport } from "./agentic";
import { askOpenRouter, openRouterModels } from "./openrouter";
import type { FullReport } from "./types";

// Model per stage, overridable by env. The queries stage runs 8+ calls with web
// search - on a low rate-limit API tier, set SCAN_MODEL_QUERIES to a smaller
// model (e.g. claude-sonnet-5) to keep total scan time near one minute.
const MODEL_QUERIES = process.env.SCAN_MODEL_QUERIES ?? "claude-opus-5";
const MODEL_COMPOSE = process.env.SCAN_MODEL_COMPOSE ?? "claude-opus-5";
const FALLBACK_OPTS = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

// Per-call timeout so one stuck request can't hang a scan; SDK still retries inside it.
const client = new Anthropic({ timeout: 180_000 });

async function updateScan(
  scanId: string,
  fields: Parameters<ReturnType<typeof store>["updateScan"]>[1]
): Promise<void> {
  await store().updateScan(scanId, fields);
}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

async function structured<T>(
  schema: Parameters<typeof zodOutputFormat>[0],
  system: string,
  user: string,
  effort: "low" | "high"
): Promise<T> {
  const response = await client.beta.messages.create({
    model: MODEL_COMPOSE,
    max_tokens: 16000,
    ...FALLBACK_OPTS,
    output_config: { format: zodOutputFormat(schema), effort },
    system,
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Model declined this request");
  }
  return JSON.parse(textOf(response)) as T;
}

function consumerPrompt(query: string): string {
  return `A consumer asks an AI assistant: "${query}"\n\nAnswer exactly as a helpful AI assistant would: recommend specific, named businesses or providers (use web search to find real current options). Keep it under 200 words.`;
}

// One buying-intent query answered the way an AI assistant would answer a consumer.
async function runVisibilityQuery(query: string): Promise<{ query: string; answer: string }> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: consumerPrompt(query) },
  ];
  for (let i = 0; i < 4; i++) {
    const response = await client.beta.messages.create({
      model: MODEL_QUERIES,
      max_tokens: 4000,
      ...FALLBACK_OPTS,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    return { query, answer: textOf(response) };
  }
  return { query, answer: "(query did not complete)" };
}

// Web presence sweep: reviews platforms + Reddit/Quora mentions.
async function runPresenceSweep(profile: Profile, domain: string): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Research the web presence of "${profile.business_name}" (${domain}), a ${profile.category} in ${profile.location}.

Check and report plainly on:
1. Review platforms: do they appear on Google reviews, Yelp, Trustpilot, G2, or industry equivalents? Ratings/review counts if visible.
2. Reddit and Quora: any organic mentions of the brand or domain?
3. Any other citations of the brand on third-party sites.

Use web search. Report only what you actually find, with sources. If nothing is found for a category, say so explicitly - absence is a finding.`,
    },
  ];
  for (let i = 0; i < 4; i++) {
    const response = await client.beta.messages.create({
      model: MODEL_QUERIES,
      max_tokens: 4000,
      ...FALLBACK_OPTS,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    return textOf(response);
  }
  return "(presence sweep did not complete)";
}

function crawlSummary(c: CrawlResult): string {
  return [
    `URL: ${c.finalUrl} (HTTP ${c.status}, TTFB ${c.ttfbMs}ms)`,
    `Title: ${c.title}`,
    `Meta description: ${c.metaDescription || "(none)"}`,
    `Homepage word count: ${c.wordCount}`,
    `H1/H2 headings: ${c.headings.join(" | ") || "(none found)"}`,
    `JSON-LD schema types: ${c.jsonLdTypes.join(", ") || "(none)"}`,
    `Sitemap: ${c.hasSitemap ? `yes, most recent lastmod ${c.sitemapLastmod ?? "unknown"}` : "not found"}`,
    ``,
    `Homepage text excerpt:`,
    c.htmlExcerpt.slice(0, 8000),
  ].join("\n");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runScan(scanId: string, url: string, domain: string): Promise<void> {
  try {
    await updateScan(scanId, { status: "running", step: "Reading your website", progress: 5 });
    const crawled = await crawl(url);

    // agent-readiness check (is-agentic.com) runs in parallel with everything else
    const agenticPromise = fetchAgenticReport(crawled.finalUrl);

    await updateScan(scanId, { step: "Understanding your business", progress: 15 });
    const profile = await structured<Profile>(
      ProfileSchema,
      "You analyze a business website and produce a structured profile. buying_queries must be questions a real consumer would ask an AI assistant when ready to buy - include the location when the business is local.",
      crawlSummary(crawled),
      "low"
    );

    await updateScan(scanId, { step: "Finding what your customers actually search", progress: 22 });
    const demand = await realDemandPhrases(profile);
    let plan: QueryPlan;
    if (demand.length > 0) {
      plan = await structured<QueryPlan>(
        QueryPlanSchema,
        "You select the 8 buying-intent questions to test a business's AI search visibility. You are given REAL Google Autocomplete phrases (evidence of what people actually search) plus the business profile. Prefer queries grounded in the real phrases: pick the ones with clear buying intent relevant to this business, and phrase each as a customer would naturally ask an AI assistant (add the location when the business is local). backed_by must quote the exact real phrase(s) used. Only fall back to inferred queries (max 2) if the real phrases don't cover an important service, and label them honestly.",
        [
          `BUSINESS PROFILE:\n${JSON.stringify({ ...profile, buying_queries: undefined }, null, 2)}`,
          `\nREAL AUTOCOMPLETE PHRASES (actual searches people type):\n${demand.map((d) => `- "${d.phrase}" (from seed "${d.seed}")`).join("\n")}`,
        ].join("\n"),
        "low"
      );
    } else {
      // no demand data reachable - fall back to profiler-inferred queries, labeled as such
      plan = {
        queries: profile.buying_queries.slice(0, 8).map((q) => ({
          query: q,
          backed_by: "Inferred from your services (no search data found)",
        })),
      };
    }
    const planQueries = plan.queries.slice(0, 8);

    await updateScan(scanId, {
      step: "Asking AI assistants your customers' buying questions",
      progress: 30,
    });
    let completed = 0;
    const visibility = await mapWithConcurrency(planQueries, 4, async (q) => {
      const orModels = openRouterModels();
      const [claude, ...others] = await Promise.all([
        runVisibilityQuery(q.query),
        ...orModels.map((m) => askOpenRouter(m.model, consumerPrompt(q.query))),
      ]);
      completed++;
      await updateScan(scanId, {
        progress: 30 + Math.round((completed / planQueries.length) * 35),
      });
      const answers = [{ assistant: "Claude", answer: claude.answer }];
      orModels.forEach((m, i) => {
        const answer = others[i];
        if (answer) answers.push({ assistant: m.label, answer });
      });
      return { query: q.query, backed_by: q.backed_by, answers };
    });

    await updateScan(scanId, { step: "Checking your web presence and citations", progress: 70 });
    const presence = await runPresenceSweep(profile, domain);

    await updateScan(scanId, { step: "Scoring and writing your report", progress: 85 });
    const report = await structured<Report>(
      ReportSchema,
      `You produce an AI Search Visibility report for a business owner. Never use em dashes in any output text. Score honestly from evidence - do not inflate or invent. The 9 factors (use these keys/names): backlinks (Domain Authority Signals), homepage_traffic (Search Visibility), social_proof (Reddit & Quora Presence), depth (Content Depth), structure (Structure & Extractability), freshness (Content Freshness), faq (FAQ & Question Coverage), reviews (Review Platform Presence), speed (Page Speed). For each: score 0-100, one sentence of concrete evidence from the inputs, one specific fix, and a fix_prompt - a complete standalone prompt the owner pastes into Claude Code to implement the fix on their website. Each fix_prompt must name their actual domain, cite the concrete problems found (their real headings, missing schema types, actual page issues), and describe the desired end state; for non-code fixes it should generate the action plan or draft the content instead. Write fix_prompts as if the reader will paste them with zero other context. visibility[] must have one entry per query with mentioned=true only if this exact business was recommended in the answer; copy query and backed_by VERBATIM from the input; assistants[] must have one entry per assistant that answered (names copied verbatim from the [bracketed] labels), each with mentioned=true only if THAT assistant's answer recommended this business; top-level mentioned=true if any assistant did; recommended_instead lists the competitor names that were recommended. headline: one direct second-person sentence stating the core finding. priority_fixes: the 3 changes that would most move AI visibility in 60-90 days. Where evidence is missing for a factor (e.g. backlinks), score conservatively and say the check was indirect.`,
      [
        `BUSINESS PROFILE:\n${JSON.stringify(profile, null, 2)}`,
        `\nTECHNICAL CRAWL:\n${crawlSummary(crawled)}`,
        `\nAI ASSISTANT ANSWERS TO BUYING QUERIES:\n${visibility
          .map(
            (v) =>
              `Q: ${v.query}\nbacked_by: ${v.backed_by}\n` +
              v.answers.map((a) => `[${a.assistant}] answered: ${a.answer}`).join("\n")
          )
          .join("\n\n")}`,
        `\nWEB PRESENCE FINDINGS:\n${presence}`,
      ].join("\n"),
      "high"
    );

    // re-attach demand evidence from the plan in case the composer paraphrased it
    const backing = new Map(visibility.map((v) => [v.query.toLowerCase(), v.backed_by]));
    for (const v of report.visibility) {
      v.backed_by = backing.get(v.query.toLowerCase()) ?? v.backed_by;
    }

    const agentic = await agenticPromise;
    const fullReport: FullReport = {
      ...report,
      ...(agentic ? { agent_readiness: agentic } : {}),
    };

    await updateScan(scanId, {
      status: "done",
      step: "Done",
      progress: 100,
      report: fullReport,
      completed_at: new Date().toISOString(),
    });

    // deliver by email (no-op if Resend isn't configured)
    const lead = await store().getLeadForScan(scanId);
    if (lead?.email) {
      await sendReportEmail(lead.email, lead.first_name, scanId, report);
    }
  } catch (err) {
    console.error(`[scan ${scanId}] failed:`, err);
    const message = err instanceof Error ? err.message : "Scan failed";
    await updateScan(scanId, { status: "error", error: message });
  }
}
