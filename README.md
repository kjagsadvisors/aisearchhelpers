# AI Search Helpers

Free AI search visibility scanner + lead funnel. Enter a website, and it asks AI
assistants the buying questions that business's customers actually search — then
scores the site against the nine factors that drive AI citations and delivers a
report with receipts.

Live at [aisearchhelpers.com](https://aisearchhelpers.com).

## How a scan works

1. **Crawl** — fetches the homepage, sitemap, JSON-LD schema, and measures response time (SSRF-guarded, public hosts only).
2. **Profile** — Claude infers the business's category, location, and services.
3. **Real demand** — pulls Google Autocomplete phrases seeded from those services. Autocomplete suggestions only exist because real people type them, so every tested query is grounded in live search demand (and labeled honestly when it isn't).
4. **Visibility queries** — asks an AI assistant (with live web search) each buying question and records whether the business is recommended, and who is recommended instead.
5. **Presence sweep** — checks review platforms, Reddit/Quora mentions, and third-party citations.
6. **Agent readiness** — pulls the site's score from the open [is-agentic.com](https://is-agentic.com) scanner.
7. **Compose** — scores the nine citation factors (from [SE Ranking's 129k-site study](https://seranking.com/blog/how-to-optimize-for-chatgpt/)) with evidence and a concrete fix each.

The funnel is typeform-style: the scan kicks off the moment an email is
submitted and runs while the remaining steps collect the lead, so the report is
ready (or nearly) when the form ends. No fake progress bars.

## Stack

Next.js (App Router) · Claude API (Opus 5, with per-stage model overrides) ·
Supabase (or a zero-config in-memory store for local dev) · Resend · Tailwind.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in at least ANTHROPIC_API_KEY
npm run dev
```

With no Supabase env vars it runs on an in-memory store (data lost on restart).
`POST /api/dev/seed` creates a sample report in dev for styling work.

See [.env.example](.env.example) for all configuration, and
[supabase/migration.sql](supabase/migration.sql) for the schema.

## Abuse controls

Email MX + disposable-domain validation, per-IP and global daily scan caps,
7-day per-domain report cache, SSRF guards on every crawl hop, optional
Cloudflare Turnstile.

## License

MIT
