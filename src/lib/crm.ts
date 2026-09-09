// Auto-sync funnel leads into the kjags CRM (companies / contacts / activities).
// Optional: skipped when CRM_SUPABASE_URL / CRM_SUPABASE_SERVICE_ROLE_KEY are
// unset. Every lead becomes a prospect company + contact with a note activity
// linking their report. Failures log and never block the scan pipeline.
import { createClient } from "@supabase/supabase-js";
import type { Report } from "./types";

function crmClient() {
  const url = process.env.CRM_SUPABASE_URL;
  const key = process.env.CRM_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function syncLeadToCrm(input: {
  scanId: string;
  domain: string;
  url: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  qualifier: string | null;
  report: Report | null;
}): Promise<void> {
  const db = crmClient();
  if (!db) return;
  try {
    // dedupe: this scan already synced
    const { data: existing } = await db
      .from("activities")
      .select("id")
      .eq("metadata->>scan_id", input.scanId)
      .limit(1)
      .maybeSingle();
    if (existing) return;

    // company by domain, else create prospect
    let { data: company } = await db
      .from("companies")
      .select("id")
      .eq("domain", input.domain)
      .limit(1)
      .maybeSingle();
    if (!company) {
      const name = input.report?.business_name || input.domain;
      const { data: created, error } = await db
        .from("companies")
        .insert({
          name,
          domain: input.domain,
          website: input.url,
          notes: "Inbound lead from aisearchhelpers.com free scan",
        })
        .select("id")
        .single();
      if (error) throw error;
      company = created;
    }

    // contact by email, else create
    let { data: contact } = await db
      .from("contacts")
      .select("id")
      .eq("email", input.email)
      .limit(1)
      .maybeSingle();
    if (!contact && company) {
      const { data: created, error } = await db
        .from("contacts")
        .insert({
          company_id: company.id,
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          phone: input.phone,
        })
        .select("id")
        .single();
      if (error) throw error;
      contact = created;
    }

    const score = input.report ? Math.round(input.report.overall_score) : null;
    const missed = input.report
      ? `${input.report.visibility.filter((v) => !v.mentioned).length}/${input.report.visibility.length} buying queries missed`
      : null;
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://aisearchhelpers.com";
    const bodyParts = [
      `Ran a free AI search scan on ${input.domain}.`,
      score !== null ? `Score ${score}/100 (${missed}).` : "Scan did not complete.",
      input.qualifier ? `Revenue: ${input.qualifier}.` : null,
      `Report: ${base}/r/${input.scanId}`,
    ].filter(Boolean);

    await db.from("activities").insert({
      kind: "note",
      body: bodyParts.join(" "),
      company_id: company?.id ?? null,
      contact_id: contact?.id ?? null,
      metadata: { source: "aisearchhelpers", scan_id: input.scanId },
    });
  } catch (err) {
    console.error("[crm] lead sync failed:", err);
  }
}
