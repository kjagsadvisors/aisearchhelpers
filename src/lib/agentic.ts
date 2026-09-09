// Agent-readiness section via the free is-agentic.com public API.
// GET /api/v1/report returns a stored report; if none exists we trigger a scan
// by hitting the scan page, then poll. Best-effort: returns null on any failure
// so the main report never blocks on a third-party service.
import type { AgenticSummary } from "./types";

interface AgenticApiReport {
  score: number | null;
  score_label: string;
  report_url: string;
  scanned_at: string;
  issues?: { name?: string; recommendation?: string | null; result?: string }[];
}

async function getStored(url: string): Promise<AgenticApiReport | null> {
  const res = await fetch(
    `https://is-agentic.com/api/v1/report?url=${encodeURIComponent(url)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) return null;
  return (await res.json()) as AgenticApiReport;
}

export async function fetchAgenticReport(url: string): Promise<AgenticSummary | null> {
  try {
    let report = await getStored(url);
    if (!report) {
      // Start a scan the same way the official CLI does (SSE stream endpoint),
      // consume it until it completes or we time out, then read the stored report.
      try {
        const endpoint = new URL("https://is-agentic.com/api/scan/stream");
        endpoint.searchParams.set("target", url);
        const res = await fetch(endpoint, {
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-store",
            "User-Agent": "aisearchhelpers/1.0 (+https://aisearchhelpers.com)",
          },
          signal: AbortSignal.timeout(120000),
        });
        if (res.ok && res.body) {
          const reader = res.body.getReader();
          while (!(await reader.read()).done) {
            // drain until the scan stream closes
          }
        }
      } catch {
        // stream timeout or failure — fall through to a final report check
      }
      report = await getStored(url);
    }
    if (!report) return null;
    return {
      score: report.score,
      score_label: report.score_label,
      report_url: report.report_url,
      top_issues: (report.issues ?? [])
        .filter((i) => i.name)
        .slice(0, 4)
        .map((i) => ({ name: i.name as string, recommendation: i.recommendation ?? null })),
    };
  } catch {
    return null;
  }
}
