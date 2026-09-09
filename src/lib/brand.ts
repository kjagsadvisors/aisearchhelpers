// White-label branding - every customer-facing surface reads from here.
// An agency deploys their own instance by setting these env vars; with none
// set you get the stock AI Search Helpers brand.
export const brand = {
  // Display name. The last word gets the accent color in the wordmark.
  name: process.env.NEXT_PUBLIC_BRAND_NAME || "AI Search Helpers",
  // Shown in footers and report attribution.
  domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN || "aisearchhelpers.com",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ||
    "Find out what AI assistants tell your customers",
  // Accent color (hex). Pick something readable with black text on top.
  accent: process.env.NEXT_PUBLIC_BRAND_ACCENT || "#34d399",
  accentHover: process.env.NEXT_PUBLIC_BRAND_ACCENT_HOVER || "#6ee7b7",
};

export function brandWordmark(): { head: string; tail: string } {
  const words = brand.name.trim().split(/\s+/);
  if (words.length === 1) return { head: "", tail: words[0] };
  return { head: words.slice(0, -1).join(" "), tail: words[words.length - 1] };
}
