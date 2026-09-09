// Dev-only: seed a completed scan with a sample report so the report page and
// done-screen can be exercised without burning API calls. 404s in production.
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { Report } from "@/lib/types";

const SAMPLE: Report = {
  business_name: "Sample Plumbing Co",
  overall_score: 34,
  headline:
    "AI assistants recommended your competitors 6 out of 8 times. You're invisible where your customers are now searching.",
  visibility: [
    { query: "best plumber in Annapolis MD", backed_by: "Real searches: 'best plumber annapolis md', 'plumber annapolis'", mentioned: false, assistants: [{ name: "ChatGPT (GPT-4o)", mentioned: false }, { name: "Claude", mentioned: false }], recommended_instead: ["Heidler Plumbing", "F.H. Furr"] },
    { query: "emergency plumber near Annapolis", backed_by: "Real searches: 'emergency plumber near me', '24 hour plumber annapolis'", mentioned: false, assistants: [{ name: "ChatGPT (GPT-4o)", mentioned: false }, { name: "Claude", mentioned: false }], recommended_instead: ["Len The Plumber"] },
    { query: "who should I hire to replace a water heater in Annapolis", backed_by: "Real searches: 'water heater replacement annapolis', 'water heater replacement cost'", mentioned: true, assistants: [{ name: "ChatGPT (GPT-4o)", mentioned: false }, { name: "Claude", mentioned: true }], recommended_instead: [] },
    { query: "reliable drain cleaning company Anne Arundel County", backed_by: "Real searches: 'drain cleaning near me', 'drain cleaning anne arundel county'", mentioned: false, assistants: [{ name: "ChatGPT (GPT-4o)", mentioned: false }, { name: "Claude", mentioned: false }], recommended_instead: ["Roto-Rooter", "Mr. Rooter"] },
  ],
  factors: [
    { key: "backlinks", name: "Domain Authority Signals", score: 22, evidence: "Few referring domains detected; site is rarely cited by third parties.", fix_prompt: "My website is sampleplumbing.example (plumbing company in Annapolis, MD). Draft outreach emails and a target list to get listed in the Annapolis Chamber of Commerce directory, local supplier directories, and 3 plumbing trade association member pages, each linking to my domain.", fix: "Earn 2-3 links from local chambers, supplier directories, and trade associations." },
    { key: "homepage_traffic", name: "Search Visibility", score: 30, evidence: "Brand rarely appears in web-search results for category queries.", fix_prompt: "My website is sampleplumbing.example. Create 5 dedicated service pages targeting: 'emergency plumber annapolis', 'water heater replacement annapolis', 'drain cleaning anne arundel county', 'sump pump repair annapolis', 'repiping annapolis'. Each 800+ words, question-based H2s, local specifics.", fix: "Target 5 high-intent local queries with dedicated service pages." },
    { key: "social_proof", name: "Reddit & Quora Presence", score: 10, evidence: "No organic mentions found on Reddit or Quora.", fix_prompt: "I own sampleplumbing.example, a plumbing company in Annapolis. Draft 3 genuinely helpful Reddit answers for common plumbing questions in r/HomeImprovement and r/Plumbing that establish expertise without being promotional.", fix: "Answer 3 local service questions/month on Reddit with genuine advice." },
    { key: "depth", name: "Content Depth", score: 40, evidence: "Homepage is ~600 words; no long-form service content.", fix_prompt: "My site sampleplumbing.example has a ~600 word homepage and no long-form content. Write a 2,000+ word guide 'Water Heater Replacement in Annapolis: Costs, Permits, and How to Choose' with question-based H2s, a TLDR, and an FAQ section.", fix: "Publish 2,000+ word guides for each core service." },
    { key: "structure", name: "Structure & Extractability", score: 55, evidence: "Headings exist but aren't question-based; sections run long.", fix_prompt: "Restructure the pages on sampleplumbing.example: rewrite all H2s as customer questions, keep sections to 120-180 words, add a 2-3 sentence direct answer under each heading, and add a TLDR block at the top of each service page.", fix: "Rewrite H2s as customer questions with 2-3 sentence direct answers." },
    { key: "freshness", name: "Content Freshness", score: 25, evidence: "Sitemap lastmod is 14 months old.", fix_prompt: "Audit the 5 most important pages on sampleplumbing.example and update each with current pricing ranges, this year's local permit requirements for Anne Arundel County, and updated dates, then set up a quarterly refresh checklist.", fix: "Update your top 5 pages this month; refresh quarterly." },
    { key: "faq", name: "FAQ & Question Coverage", score: 20, evidence: "No FAQ section or FAQPage schema found.", fix_prompt: "Add a 10-question FAQ to sampleplumbing.example answering real buyer questions (cost ranges, response times, permits, warranties, service area) with FAQPage JSON-LD schema markup on the page.", fix: "Add a 10-question FAQ answering real buyer questions." },
    { key: "reviews", name: "Review Platform Presence", score: 45, evidence: "Google reviews exist (38); absent from Yelp and Angi.", fix_prompt: "I own Sample Plumbing Co in Annapolis (38 Google reviews, not on Yelp or Angi). Write me a step-by-step plan to claim Yelp and Angi profiles this week, plus 3 SMS templates for asking happy customers for reviews.", fix: "Claim Yelp and Angi profiles; drive 5 new reviews/month." },
    { key: "speed", name: "Page Speed", score: 60, evidence: "TTFB ~800ms. Acceptable, not fast.", fix_prompt: "My site sampleplumbing.example has ~800ms TTFB. Audit what's slowing the response (hosting, caching, render-blocking assets) and implement caching/CDN changes to get TTFB under 400ms.", fix: "Enable caching/CDN to bring TTFB under 400ms." },
  ],
  priority_fixes: [
    "Add question-based H2s + a 10-question FAQ with schema to your top 3 service pages. The fastest extractability win.",
    "Refresh every core page (freshness nearly doubles citation likelihood) and keep a quarterly update cadence.",
    "Claim and build out Yelp, Angi, and BBB profiles. Review platforms drive 3-6x more AI citations.",
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
