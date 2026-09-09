import { notFound } from "next/navigation";
import { store } from "@/lib/store";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-400";
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

  const report = data.report as Report;
  const missed = report.visibility.filter((v) => !v.mentioned);
  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL;

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        <header className="flex items-center justify-between">
          <span className="font-bold tracking-tight text-lg">
            AI Search <span className="text-emerald-400">Helpers</span>
          </span>
          <span className="text-sm text-white/40">{data.domain}</span>
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

        {/* Visibility results — the hook */}
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
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm text-white/80">&ldquo;{v.query}&rdquo;</p>
                  <span
                    className={`shrink-0 text-xs font-semibold rounded-full px-2.5 py-1 ${
                      v.mentioned
                        ? "bg-emerald-400/15 text-emerald-300"
                        : "bg-red-400/15 text-red-300"
                    }`}
                  >
                    {v.mentioned ? "Mentioned" : "Not mentioned"}
                  </span>
                </div>
                {!v.mentioned && v.recommended_instead.length > 0 && (
                  <p className="text-xs text-white/40">
                    Recommended instead: {v.recommended_instead.join(", ")}
                  </p>
                )}
                {v.backed_by && (
                  <p className="text-[11px] text-emerald-300/50">{v.backed_by}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Priority fixes */}
        <section className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-6 space-y-4">
          <h2 className="text-lg font-bold text-emerald-300">Your 3 highest-impact fixes</h2>
          <ol className="space-y-3">
            {report.priority_fixes.map((fix, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/85">
                <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-400 text-black font-bold text-xs flex items-center justify-center">
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
              className="block text-center bg-emerald-400 text-black font-semibold rounded-xl px-6 py-3.5 hover:bg-emerald-300 transition-colors"
            >
              Book a free 15-min walkthrough of these fixes
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
                  <span className="text-emerald-300 font-semibold">Fix: </span>
                  {f.fix}
                </p>
              </div>
            ))}
          </div>
        </section>

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
              className="inline-block bg-emerald-400 text-black font-semibold rounded-xl px-8 py-4 hover:bg-emerald-300 transition-colors"
            >
              Get these fixed for you — book a free call
            </a>
          )}
          <p className="text-xs text-white/25">
            Generated by aisearchhelpers.com · Scores reflect a point-in-time scan of public AI assistant responses and your public website.
          </p>
        </footer>
      </div>
    </main>
  );
}
