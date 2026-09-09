import { Resend } from "resend";
import { brand } from "./brand";
import type { Report } from "./types";

// Everything interpolated into the email is user- or AI-generated; escape it
// so nobody can smuggle HTML into mail sent from our verified domain.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendReportEmail(
  to: string,
  firstName: string | null,
  scanId: string,
  report: Report
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set - skipping delivery to ${to}`);
    return;
  }
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const booking = process.env.NEXT_PUBLIC_BOOKING_URL || `${base}/book`;
  const reportUrl = `${base}/r/${scanId}`;
  const greeting = firstName ? `Hey ${esc(firstName)},` : "Hey,";
  const missed = report.visibility.filter((v) => !v.mentioned).length;
  const score = Math.round(report.overall_score);

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? `${brand.name} <reports@${brand.domain}>`,
      to,
      subject: `Your AI Search Report: ${score}/100 - ${report.business_name.slice(0, 80)}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
          <p>${greeting}</p>
          <p>Your AI search visibility report for <strong>${esc(report.business_name)}</strong> is ready.</p>
          <p style="font-size:40px;font-weight:800;margin:16px 0">${score}<span style="font-size:20px;color:#777">/100</span></p>
          <p>${esc(report.headline)}</p>
          <p>You were missing from <strong>${missed} of ${report.visibility.length}</strong> of the buying questions we asked AI assistants.</p>
          <p style="margin:24px 0">
            <a href="${esc(reportUrl)}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">View your full report</a>
          </p>
          ${booking ? `<p>Want us to walk you through your top 3 fixes? <a href="${esc(booking)}">Grab a time here</a> - no charge.</p>` : ""}
          <p style="color:#777;font-size:13px;margin-top:32px">${esc(brand.name)} · ${esc(brand.domain)}</p>
        </div>`,
    });
  } catch (err) {
    console.error("[email] delivery failed:", err);
  }
}
