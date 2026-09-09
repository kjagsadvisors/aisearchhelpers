import { z } from "zod";

// What the profiler extracts from the crawled site
export const ProfileSchema = z.object({
  business_name: z.string(),
  category: z.string(),
  location: z.string().describe("City/region if determinable, else 'unknown'"),
  services: z.array(z.string()),
  buying_queries: z
    .array(z.string())
    .describe(
      "8 questions a real customer would ask an AI assistant when shopping for this business's services, e.g. 'best roofing company in Annapolis'"
    ),
});
export type Profile = z.infer<typeof ProfileSchema>;

// The 8 queries we actually run, each carrying its demand evidence
export const QueryPlanSchema = z.object({
  queries: z.array(
    z.object({
      query: z.string().describe("The question phrased as a customer would ask an AI assistant"),
      backed_by: z
        .string()
        .describe(
          "Demand evidence: the exact real autocomplete phrase(s) this query is grounded in, e.g. \"Real searches: 'best plumber annapolis', 'plumber near me annapolis'\". Use 'Inferred from your services (no search data found)' only when nothing matched."
        ),
    })
  ),
});
export type QueryPlan = z.infer<typeof QueryPlanSchema>;

// Final report shape - stored as jsonb on the scan row
export const ReportSchema = z.object({
  business_name: z.string(),
  overall_score: z.number().min(0).max(100),
  headline: z
    .string()
    .describe("One punchy sentence summarizing the finding, second person"),
  visibility: z.array(
    z.object({
      query: z.string(),
      backed_by: z.string().describe("Copied verbatim from the query plan"),
      mentioned: z.boolean().describe("true if ANY assistant recommended this business"),
      assistants: z
        .array(z.object({ name: z.string(), mentioned: z.boolean() }))
        .describe(
          "One entry per assistant asked (copy names verbatim from the input, e.g. 'Claude', 'ChatGPT (GPT-4o)'); mentioned=true only if that assistant's own answer recommended this business"
        ),
      recommended_instead: z.array(z.string()),
    })
  ),
  factors: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      score: z.number().min(0).max(100),
      evidence: z.string(),
      fix: z.string(),
      fix_prompt: z
        .string()
        .describe(
          "A complete, standalone prompt the business owner can paste into Claude Code (or ChatGPT) to implement this fix. Must include their actual domain and the concrete specifics from the evidence (real page issues, missing schema types, actual heading problems), state the desired outcome, and require nothing else from this report. For non-code fixes (reviews, Reddit presence, directories), make it a prompt that produces the concrete action plan or drafts the content."
        ),
    })
  ),
  priority_fixes: z
    .array(z.string())
    .describe("The 3 highest-impact fixes, ordered"),
  summary: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

// Agent-readiness summary from is-agentic.com - attached after composition,
// not produced by the composer.
export interface AgenticSummary {
  score: number | null;
  score_label: string;
  report_url: string;
  top_issues: { name: string; recommendation: string | null }[];
}

export type FullReport = Report & { agent_readiness?: AgenticSummary };

export type ScanStatus = "queued" | "running" | "done" | "error";

export interface ScanRow {
  id: string;
  lead_id: string | null;
  url: string;
  domain: string;
  status: ScanStatus;
  step: string | null;
  progress: number;
  report: FullReport | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}
