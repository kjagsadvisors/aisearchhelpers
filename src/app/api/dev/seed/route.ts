// Dev-only: seed a completed scan with a sample report so the report page and
// done-screen can be exercised without burning API calls. 404s in production.
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { Report } from "@/lib/types";

const SAMPLE: Report = {
  business_name: "Sample Plumbing Co",
  overall_score: 34,
  headline:
    "AI assistants recommended your competitors 6 out of 8 times — you're invisible where your customers are now searching.",
  visibility: [
    { query: "best plumber in Annapolis MD", mentioned: false, recommended_instead: ["Heidler Plumbing", "F.H. Furr"] },
    { query: "emergency plumber near Annapolis", mentioned: false, recommended_instead: ["Len The Plumber"] },
    { query: "who should I hire to replace a water heater in Annapolis", mentioned: true, recommended_instead: [] },
    { query: "reliable drain cleaning company Anne Arundel County", mentioned: false, recommended_instead: ["Roto-Rooter", "Mr. Rooter"] },
  ],
  factors: [
    { key: "backlinks", name: "Domain Authority Signals", score: 22, evidence: "Few referring domains detected; site is rarely cited by third parties.", fix: "Earn 2-3 links from local chambers, supplier directories, and trade associations." },
    { key: "homepage_traffic", name: "Search Visibility", score: 30, evidence: "Brand rarely appears in web-search results for category queries.", fix: "Target 5 high-intent local queries with dedicated service pages." },
    { key: "social_proof", name: "Reddit & Quora Presence", score: 10, evidence: "No organic mentions found on Reddit or Quora.", fix: "Answer 3 local service questions/month on Reddit with genuine advice." },
    { key: "depth", name: "Content Depth", score: 40, evidence: "Homepage is ~600 words; no long-form service content.", fix: "Publish 2,000+ word guides for each core service." },
    { key: "structure", name: "Structure & Extractability", score: 55, evidence: "Headings exist but aren't question-based; sections run long.", fix: "Rewrite H2s as customer questions with 2-3 sentence direct answers." },
    { key: "freshness", name: "Content Freshness", score: 25, evidence: "Sitemap lastmod is 14 months old.", fix: "Update your top 5 pages this month; refresh quarterly." },
    { key: "faq", name: "FAQ & Question Coverage", score: 20, evidence: "No FAQ section or FAQPage schema found.", fix: "Add a 10-question FAQ answering real buyer questions." },
    { key: "reviews", name: "Review Platform Presence", score: 45, evidence: "Google reviews exist (38); absent from Yelp and Angi.", fix: "Claim Yelp and Angi profiles; drive 5 new reviews/month." },
    { key: "speed", name: "Page Speed", score: 60, evidence: "TTFB ~800ms — acceptable, not fast.", fix: "Enable caching/CDN to bring TTFB under 400ms." },
  ],
  priority_fixes: [
    "Add question-based H2s + a 10-question FAQ with schema to your top 3 service pages — the fastest extractability win.",
    "Refresh every core page (freshness nearly doubles citation likelihood) and keep a quarterly update cadence.",
    "Claim and build out Yelp, Angi, and BBB profiles — review platforms drive 3-6x more AI citations.",
  ],
  summary:
    "Your fundamentals (a working site, some reviews) are in place, but AI assistants have almost nothing to cite: thin content, stale pages, no FAQ coverage, and no third-party footprint on the platforms LLMs trust. The fixes are mechanical and compound: structure + freshness + review presence move first, authority builds behind them.",
};

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const s = store();
  const lead = await s.createLead({
    email: "dev@example.com",
    url: "https://sampleplumbing.example",
    domain: "sampleplumbing.example",
    ip: "dev",
  });
  const scan = await s.createScan({
    lead_id: lead.id,
    url: "https://sampleplumbing.example",
    domain: "sampleplumbing.example",
    status: "done",
    step: "Done",
    progress: 100,
    report: SAMPLE,
    completed_at: new Date().toISOString(),
  });
  return NextResponse.json({ scanId: scan.id, reportUrl: `/r/${scan.id}` });
}
