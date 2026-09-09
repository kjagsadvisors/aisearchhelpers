import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import {
  validateEmail,
  validateTarget,
  verifyTurnstile,
  checkRateLimits,
  findCachedReport,
} from "@/lib/abuse";
import { store } from "@/lib/store";
import { runScan } from "@/lib/scan";
import { sendReportEmail } from "@/lib/email";
import type { Report } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let body: { url?: string; email?: string; turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { url, email, turnstileToken } = body;
  if (!url || !email) {
    return NextResponse.json({ error: "Website and email are required" }, { status: 400 });
  }

  if (!(await verifyTurnstile(turnstileToken))) {
    return NextResponse.json({ error: "Bot check failed — refresh and try again" }, { status: 403 });
  }

  const emailCheck = await validateEmail(email);
  if (!emailCheck.ok) {
    return NextResponse.json({ error: emailCheck.reason }, { status: 400 });
  }

  const target = await validateTarget(url);
  if (!target.ok) {
    return NextResponse.json({ error: target.reason }, { status: 400 });
  }
  const domain = target.url.hostname.replace(/^www\./, "");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimits(ip, email);
  if (!rate.ok) {
    return NextResponse.json({ error: rate.reason }, { status: 429 });
  }

  const s = store();
  let lead;
  try {
    lead = await s.createLead({
      email: email.toLowerCase().trim(),
      url: target.url.toString(),
      domain,
      ip,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong — try again" }, { status: 500 });
  }

  const cached = (await findCachedReport(domain)) as Report | null;

  let scan;
  try {
    scan = await s.createScan({
      lead_id: lead.id,
      url: target.url.toString(),
      domain,
      status: cached ? "done" : "queued",
      step: cached ? "Done" : "Queued",
      progress: cached ? 100 : 0,
      report: cached,
      completed_at: cached ? new Date().toISOString() : null,
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong — try again" }, { status: 500 });
  }

  const scanId = scan.id;
  if (cached) {
    after(() => sendReportEmail(email, null, scanId, cached));
  } else {
    after(() => runScan(scanId, target.url.toString(), domain));
  }

  return NextResponse.json({ scanId });
}
