// Daily follow-up: leads whose scan finished 24-96h ago, who haven't booked
// and haven't been nudged, get one email pointing back at their report and
// the booking page. Triggered by Vercel Cron; guarded by CRON_SECRET.
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { serviceClient } from "@/lib/supabase";
import { brand } from "@/lib/brand";
import type { FullReport } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ skipped: "no database" });
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ skipped: "no resend" });

  const db = serviceClient();
  const resend = new Resend(apiKey);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://aisearchhelpers.com";

  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const fourDaysAgo = new Date(Date.now() - 96 * 3600_000).toISOString();

  const { data: scans } = await db
    .from("scans")
    .select("id, domain, report, lead_id, completed_at")
    .eq("status", "done")
    .gte("completed_at", fourDaysAgo)
    .lte("completed_at", dayAgo)
    .not("lead_id", "is", null)
    .limit(50);

  let sent = 0;
  for (const scan of scans ?? []) {
    const { data: lead } = await db
      .from("leads")
      .select("id, email, first_name, followup_sent_at")
      .eq("id", scan.lead_id)
      .maybeSingle();
    if (!lead?.email || lead.followup_sent_at) continue;

    const { data: booked } = await db
      .from("bookings")
      .select("id")
      .eq("email", lead.email.toLowerCase())
      .limit(1)
      .maybeSingle();
    if (booked) {
      await db.from("leads").update({ followup_sent_at: new Date().toISOString() }).eq("id", lead.id);
      continue;
    }

    const report = scan.report as FullReport | null;
    const score = report ? Math.round(report.overall_score) : null;
    const topFix = report?.priority_fixes?.[0];
    const greeting = lead.first_name ? `Hey ${esc(lead.first_name)},` : "Hey,";

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? `${brand.name} <reports@${brand.domain}>`,
        to: lead.email,
        subject: score !== null ? `Your ${scan.domain} fixes are still waiting (${score}/100)` : `Your ${scan.domain} report is still waiting`,
        html: `
          <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
            <p>${greeting}</p>
            <p>Your AI search report for <strong>${esc(scan.domain)}</strong> is sitting at${score !== null ? ` <strong>${score}/100</strong>` : ""} and nothing has changed yet.</p>
            ${topFix ? `<p>The single highest-impact fix from your report:</p><blockquote style="border-left:3px solid #34d399;margin:12px 0;padding:4px 14px;color:#333">${esc(topFix)}</blockquote>` : ""}
            <p>If you want, we'll walk through it together and you can decide what to do yourself vs. hand off. Short Teams call, free.</p>
            <p style="margin:24px 0">
              <a href="${esc(`${base}/book?scan=${scan.id}`)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Pick a time</a>
              &nbsp;&nbsp;<a href="${esc(`${base}/r/${scan.id}`)}" style="color:#555">Re-read your report</a>
            </p>
            <p style="color:#777;font-size:13px;margin-top:32px">${esc(brand.name)} · ${esc(brand.domain)}</p>
          </div>`,
      });
      await db.from("leads").update({ followup_sent_at: new Date().toISOString() }).eq("id", lead.id);
      sent++;
    } catch (err) {
      console.error(`[followup] send failed for lead ${lead.id}:`, err);
    }
  }

  return NextResponse.json({ sent, considered: scans?.length ?? 0 });
}
