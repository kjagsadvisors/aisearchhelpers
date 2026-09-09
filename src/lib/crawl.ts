import { validateTarget } from "./abuse";

export interface CrawlResult {
  finalUrl: string;
  status: number;
  ttfbMs: number;
  htmlExcerpt: string; // stripped, truncated page text + structure
  headings: string[];
  jsonLdTypes: string[];
  hasSitemap: boolean;
  sitemapLastmod: string | null;
  wordCount: number;
  title: string;
  metaDescription: string;
}

const UA =
  "Mozilla/5.0 (compatible; AISearchHelpersBot/1.0; +https://aisearchhelpers.com)";

// Follow redirects manually so every hop passes the SSRF guard.
async function safeFetch(rawUrl: string, timeoutMs = 15000): Promise<{ res: Response; finalUrl: string; ttfbMs: number }> {
  let current = rawUrl;
  for (let hop = 0; hop < 4; hop++) {
    const check = await validateTarget(current);
    if (!check.ok) throw new Error(check.reason);
    const started = Date.now();
    const res = await fetch(check.url.toString(), {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const ttfbMs = Date.now() - started;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect with no location");
      current = new URL(loc, check.url).toString();
      continue;
    }
    return { res, finalUrl: check.url.toString(), ttfbMs };
  }
  throw new Error("Too many redirects");
}

function extract(re: RegExp, html: string): string[] {
  // A non-global regex would loop forever with exec(); force the g flag.
  const global = re.global ? re : new RegExp(re.source, re.flags + "g");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = global.exec(html)) !== null) {
    out.push(m[1]);
    if (m.index === global.lastIndex) global.lastIndex++;
  }
  return out;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function crawl(rawUrl: string): Promise<CrawlResult> {
  const { res, finalUrl, ttfbMs } = await safeFetch(rawUrl);
  if (!res.ok) throw new Error(`Site returned HTTP ${res.status}`);
  const html = (await res.text()).slice(0, 500_000);

  const title = extract(/<title[^>]*>([\s\S]*?)<\/title>/i, html)[0]?.trim() ?? "";
  const metaDescription =
    extract(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i, html)[0] ??
    extract(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i, html)[0] ??
    "";
  const headings = extract(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi, html)
    .map((h) => stripHtml(h))
    .filter(Boolean)
    .slice(0, 40);

  const jsonLdBlocks = extract(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    html
  );
  const jsonLdTypes: string[] = [];
  for (const block of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(block);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const t = item?.["@type"];
        if (typeof t === "string") jsonLdTypes.push(t);
        else if (Array.isArray(t)) jsonLdTypes.push(...t.filter((x) => typeof x === "string"));
      }
    } catch {
      // malformed JSON-LD is itself a finding; ignore here
    }
  }

  const text = stripHtml(html);
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // sitemap check
  let hasSitemap = false;
  let sitemapLastmod: string | null = null;
  try {
    const origin = new URL(finalUrl).origin;
    const { res: smRes } = await safeFetch(`${origin}/sitemap.xml`, 8000);
    if (smRes.ok) {
      const sm = (await smRes.text()).slice(0, 100_000);
      if (/<(urlset|sitemapindex)/i.test(sm)) {
        hasSitemap = true;
        const lastmods = extract(/<lastmod>([^<]+)<\/lastmod>/gi, sm).sort().reverse();
        sitemapLastmod = lastmods[0] ?? null;
      }
    }
  } catch {
    // no sitemap is a finding, not an error
  }

  return {
    finalUrl,
    status: res.status,
    ttfbMs,
    htmlExcerpt: text.slice(0, 20_000),
    headings,
    jsonLdTypes,
    hasSitemap,
    sitemapLastmod,
    wordCount,
    title,
    metaDescription,
  };
}
