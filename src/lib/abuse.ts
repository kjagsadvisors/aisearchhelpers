import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { store } from "./store";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "10minemail.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.dev",
  "throwawaymail.com",
  "yopmail.com",
  "maildrop.cc",
  "getnada.com",
  "dispostable.com",
  "fakeinbox.com",
  "trashmail.com",
  "mytemp.email",
  "mohmal.com",
  "emailondeck.com",
  "mailnesia.com",
  "spamgourmet.com",
  "mintemail.com",
  "tempinbox.com",
  "burnermail.io",
  "inboxkitten.com",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function validateEmail(
  email: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    return { ok: false, reason: "That doesn't look like a valid email." };
  }
  const domain = normalized.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "Please use a permanent email address." };
  }
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx.length) return { ok: false, reason: "That email domain can't receive mail." };
  } catch {
    return { ok: false, reason: "That email domain can't receive mail." };
  }
  return { ok: true };
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return true;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower === "::" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80")
  );
}

// SSRF guard: only public http(s) hosts. Used for the initial URL and every redirect hop.
export async function validateTarget(
  rawUrl: string
): Promise<{ ok: true; url: URL } | { ok: false; reason: string }> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return { ok: false, reason: "That doesn't look like a valid website URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) websites are supported." };
  }
  const host = url.hostname;
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".")
  ) {
    return { ok: false, reason: "That host can't be scanned." };
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIPv4(host)) return { ok: false, reason: "That host can't be scanned." };
  if (ipVersion === 6 && isPrivateIPv6(host)) return { ok: false, reason: "That host can't be scanned." };
  if (ipVersion === 0) {
    try {
      const addrs = await dns.lookup(host, { all: true });
      for (const { address, family } of addrs) {
        if (family === 4 && isPrivateIPv4(address)) return { ok: false, reason: "That host can't be scanned." };
        if (family === 6 && isPrivateIPv6(address)) return { ok: false, reason: "That host can't be scanned." };
      }
    } catch {
      return { ok: false, reason: "We couldn't reach that website. Check the URL?" };
    }
  }
  return { ok: true, url };
}

export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured — skip
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// Rate limits backed by the store; also enforces the global daily cap.
export async function checkRateLimits(
  ip: string,
  email: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const maxPerIp = Number(process.env.MAX_SCANS_PER_IP_PER_DAY ?? 3);
  const maxGlobal = Number(process.env.MAX_SCANS_PER_DAY ?? 50);
  const s = store();

  const [ipCount, globalCount] = await Promise.all([
    s.countRecentByIp(ip, dayAgo),
    s.countScansSince(dayAgo),
  ]);

  if (ipCount >= maxPerIp) {
    return { ok: false, reason: "You've hit the daily scan limit. Try again tomorrow." };
  }
  if (globalCount >= maxGlobal) {
    return { ok: false, reason: "We're at capacity today — try again tomorrow." };
  }

  await s.recordRateEvents(ip, email);
  return { ok: true };
}

// Same-domain scan in the last 7 days → reuse its report for free.
export async function findCachedReport(domain: string) {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return store().findCachedReport(domain, weekAgo);
}
