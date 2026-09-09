import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import { brand } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { CopyPrompt } from "./CopyPrompt";
import type { FullReport } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function scoreColor(score: number): string {
  if (score >= 70) return "text-[var(--accent)]";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-[var(--accent)]";
  if (score >= 40) return "bg-amber-400";
  return "bg-red-400";
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const data = await store().getScan(id);
  if (!data || data.status !== "done" || !data.report) notFound();

  const report = data.report as FullReport;
  const missed = report.visibility.filter((v) => !v.mentioned);
  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL || `/book?scan=${id}`;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        <header className="flex items-center justify-between gap-3">
          <span className="shrink-0"><Logo /></span>
          <span className="text-sm text-white/40 truncate min-w-0">{data.domain}</span>
        </header>

        {/* Score hero */}
        <section className="text-center space-y-4">
          <p className="text-white/40 uppercase tracking-widest text-xs">AI Search Visibility Score</p>
          <p className={`text-7xl font-extrabold ${scoreColor(report.overall_score)}`}>
            {report.overall_score}
            <span className="text-2xl text-white/30 font-semibold">/100</span>
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold max-w-xl mx-auto leading-snug">
            {report.headline}
          </h1>
        </section>

        {/* Visibility results - the hook */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">
            We asked AI assistants {report.visibility.length} questions your customers ask.
            {missed.length > 0 && (
              <span className="text-red-400"> You were missing from {missed.length}.</span>
            )}
          </h2>
          <div className="space-y-2">
            {report.visibility.map((v) => (
              <div
                key={v.query}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 flex flex-col gap-1"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                  <p className="text-sm text-white/80">&ldquo;{v.query}&rdquo;</p>
                  <div className="sm:shrink-0 flex flex-wrap sm:justify-end gap-1.5">
                    {v.assistants?.length ? (
                      v.assistants.map((a) => (
                        <span
                          key={a.name}
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                            a.mentioned
                              ? "bg-[var(--accent-a15)] text-[var(--accent-hover)]"
                              : "bg-red-400/15 text-red-300"
                          }`}
                        >
                          {a.name} {a.mentioned ? "✓" : "✗"}
                        </span>
                      ))
                    ) : (
                      <span
                        className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                          v.mentioned
                            ? "bg-[var(--accent-a15)] text-[var(--accent-hover)]"
                            : "bg-red-400/15 text-red-300"
                        }`}
                      >
                        {v.mentioned ? "Mentioned" : "Not mentioned"}
                      </span>
                    )}
                  </div>
                </div>
                {!v.mentioned && v.recommended_instead.length > 0 && (
                  <p className="text-xs text-white/40">
                    Recommended instead: {v.recommended_instead.join(", ")}
                  </p>
                )}
                {v.backed_by && (
                  <p className="text-[11px] text-[var(--accent-a60)]">{v.backed_by}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Verify it yourself - the exact prompts */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h2 className="text-lg font-bold">Don&apos;t take our word for it</h2>
          <p className="text-sm text-white/60">
            These are the exact prompts we used. Paste any of them into ChatGPT, Claude, or
            Perplexity and see who gets recommended.
          </p>
          <ul className="space-y-2">
            {report.visibility.map((v) => (
              <li
                key={v.query}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-4 py-2.5"
              >
                <code className="text-xs text-white/75 break-words min-w-0">{v.query}</code>
                <CopyPrompt text={v.query} />
              </li>
            ))}
          </ul>
        </section>

        {/* Priority fixes */}
        <section className="rounded-2xl border border-[var(--accent-a25)] bg-[var(--accent-a06)] p-6 space-y-4">
          <h2 className="text-lg font-bold text-[var(--accent-hover)]">Your 3 highest-impact fixes</h2>
          <ol className="space-y-3">
            {report.priority_fixes.map((fix, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/85">
                <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--accent)] text-black font-bold text-xs flex items-center justify-center">
                  {i + 1}
                </span>
                {fix}
              </li>
            ))}
          </ol>
          {bookingUrl && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-[var(--accent)] text-black font-semibold rounded-xl px-6 py-3.5 hover:bg-[var(--accent-hover)] transition-colors"
            >
              Book a free walkthrough of these fixes
            </a>
          )}
        </section>

        {/* Factor scorecard */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold">The 9 factors that drive AI citations</h2>
          <div className="grid sm:grid-cols-1 gap-3">
            {report.factors.map((f) => (
              <div key={f.key} className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{f.name}</p>
                  <p className={`font-bold ${scoreColor(f.score)}`}>{f.score}</p>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full ${barColor(f.score)}`} style={{ width: `${f.score}%` }} />
                </div>
                <p className="text-xs text-white/50">{f.evidence}</p>
                <p className="text-xs text-white/70">
                  <span className="text-[var(--accent-hover)] font-semibold">Fix: </span>
                  {f.fix}
                </p>
                {f.fix_prompt && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-[var(--accent-a70)] hover:text-[var(--accent-hover)] select-none list-none">
                      ▸ Get the Claude Code prompt to fix this
                    </summary>
                    <div className="mt-2 rounded-lg bg-black/40 border border-white/10 p-3 space-y-2">
                      <pre className="text-[11px] text-white/70 whitespace-pre-wrap break-words font-mono leading-relaxed">{f.fix_prompt}</pre>
                      <CopyPrompt text={f.fix_prompt} />
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Agent readiness (is-agentic.com) */}
        {report.agent_readiness && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">AI Agent Readiness</h2>
              {report.agent_readiness.score !== null && (
                <p className={`text-2xl font-bold ${scoreColor(report.agent_readiness.score)}`}>
                  {report.agent_readiness.score}
                  <span className="text-sm text-white/30">/100</span>
                </p>
              )}
            </div>
            <p className="text-sm text-white/60">
              How well your site works when an AI agent tries to use it: {report.agent_readiness.score_label.toLowerCase()}.
            </p>
            {report.agent_readiness.top_issues.length > 0 && (
              <ul className="space-y-2">
                {report.agent_readiness.top_issues.map((issue) => (
                  <li key={issue.name} className="text-xs text-white/60">
                    <span className="text-white/85 font-medium">{issue.name}</span>
                    {issue.recommendation && <>: {issue.recommendation}</>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-white/30">
              Powered by the open{" "}
              <a href={report.agent_readiness.report_url} className="underline" target="_blank" rel="noopener noreferrer">
                is-agentic.com
              </a>{" "}
              scanner.
            </p>
          </section>
        )}

        {/* Summary */}
        <section className="space-y-3">
          <h2 className="text-lg font-bold">Summary</h2>
          <p className="text-sm text-white/70 leading-relaxed whitespace-pre-line">{report.summary}</p>
        </section>

        <footer className="border-t border-white/10 pt-6 pb-10 text-center space-y-4">
          {bookingUrl && (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-[var(--accent)] text-black font-semibold rounded-xl px-8 py-4 hover:bg-[var(--accent-hover)] transition-colors"
            >
              Get these fixed for you. Book a free call
            </a>
          )}
          <p className="text-xs text-white/25">
            Generated by {brand.domain} · Scores reflect a point-in-time scan of public AI assistant responses and your public website. · <a href="/privacy" className="underline hover:text-white/60">Privacy</a>
          </p>
        </footer>
      </div>
    </main>
  );
}
