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

// Final report shape — stored as jsonb on the scan row
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
      mentioned: z.boolean(),
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
    })
  ),
  priority_fixes: z
    .array(z.string())
    .describe("The 3 highest-impact fixes, ordered"),
  summary: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

export type ScanStatus = "queued" | "running" | "done" | "error";

export interface ScanRow {
  id: string;
  lead_id: string | null;
  url: string;
  domain: string;
  status: ScanStatus;
  step: string | null;
  progress: number;
  report: Report | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}
